import os
import unittest
from importlib import reload
from types import SimpleNamespace
from unittest.mock import patch

import jwt
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.config as config
from app.db import Base
from app.models import Subject
from app.schemas import SubjectAccessOut, UserOut


class AuthConfigTests(unittest.TestCase):
    def test_admin_emails_are_normalized(self):
        try:
            with patch.dict(
                os.environ,
                {
                    "ADMIN_EMAILS": " Admin@Example.com,second@example.com ,,,",
                    "SUPABASE_URL": "https://example.supabase.co",
                    "SUPABASE_JWKS_URL": "https://example.supabase.co/auth/v1/.well-known/jwks.json",
                    "SUPABASE_JWT_ISSUER": "https://example.supabase.co/auth/v1",
                    "SUPABASE_JWT_AUDIENCE": "authenticated",
                },
                clear=False,
            ):
                reload(config)

                self.assertEqual(config.settings.admin_emails, {"admin@example.com", "second@example.com"})
                self.assertEqual(config.settings.supabase_jwt_audience, "authenticated")
        finally:
            reload(config)


class AccessModelTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)

    def _add_owner_subject_and_grant(self, db):
        from app.models import SubjectAccess, User

        user = User(
            id="user-1",
            supabase_user_id="supabase-1",
            email="owner@example.com",
            app_role="creator",
        )
        subject = Subject(
            id="subject-1",
            title="Shared Subject",
            owner_user_id="user-1",
            visibility="public_requested",
        )
        grant = SubjectAccess(
            id="access-1",
            subject_id="subject-1",
            user_id="user-1",
            access_level="owner",
        )
        db.add_all([user, subject, grant])
        db.commit()
        return user, subject, grant

    def test_user_subject_access_and_visibility_models_persist(self):
        db = self.SessionLocal()
        try:
            self._add_owner_subject_and_grant(db)

            stored = db.get(Subject, "subject-1")
            self.assertEqual(stored.owner_user_id, "user-1")
            self.assertEqual(stored.visibility, "public_requested")
            self.assertEqual(stored.access_grants[0].access_level, "owner")
            self.assertEqual(stored.owner.email, "owner@example.com")
        finally:
            db.close()

    def test_invalid_user_app_role_is_rejected(self):
        from app.models import User

        db = self.SessionLocal()
        try:
            db.add(
                User(
                    id="user-1",
                    supabase_user_id="supabase-1",
                    email="owner@example.com",
                    app_role="manager",
                )
            )

            with self.assertRaises(IntegrityError):
                db.commit()
        finally:
            db.close()

    def test_duplicate_subject_access_for_same_subject_and_user_is_rejected(self):
        from app.models import SubjectAccess

        db = self.SessionLocal()
        try:
            self._add_owner_subject_and_grant(db)
            db.add(
                SubjectAccess(
                    id="access-2",
                    subject_id="subject-1",
                    user_id="user-1",
                    access_level="edit",
                )
            )

            with self.assertRaises(IntegrityError):
                db.commit()
        finally:
            db.close()

    def test_invalid_subject_visibility_is_rejected(self):
        from app.models import User

        db = self.SessionLocal()
        try:
            db.add(
                User(
                    id="user-1",
                    supabase_user_id="supabase-1",
                    email="owner@example.com",
                    app_role="creator",
                )
            )
            db.add(
                Subject(
                    id="subject-1",
                    title="Shared Subject",
                    owner_user_id="user-1",
                    visibility="shared",
                )
            )

            with self.assertRaises(IntegrityError):
                db.commit()
        finally:
            db.close()

    def test_invalid_subject_access_level_is_rejected(self):
        from app.models import SubjectAccess, User

        db = self.SessionLocal()
        try:
            db.add(
                User(
                    id="user-1",
                    supabase_user_id="supabase-1",
                    email="owner@example.com",
                    app_role="creator",
                )
            )
            db.add(
                Subject(
                    id="subject-1",
                    title="Shared Subject",
                    owner_user_id="user-1",
                    visibility="private",
                )
            )
            db.add(
                SubjectAccess(
                    id="access-1",
                    subject_id="subject-1",
                    user_id="user-1",
                    access_level="admin",
                )
            )

            with self.assertRaises(IntegrityError):
                db.commit()
        finally:
            db.close()

    def test_user_and_subject_access_schemas_serialize_orm_models(self):
        db = self.SessionLocal()
        try:
            user, _, grant = self._add_owner_subject_and_grant(db)

            user_out = UserOut.model_validate(user)
            grant_out = SubjectAccessOut.model_validate(grant)

            self.assertEqual(user_out.id, "user-1")
            self.assertEqual(user_out.email, "owner@example.com")
            self.assertEqual(user_out.app_role, "creator")
            self.assertEqual(grant_out.id, "access-1")
            self.assertEqual(grant_out.subject_id, "subject-1")
            self.assertEqual(grant_out.user_id, "user-1")
            self.assertEqual(grant_out.access_level, "owner")
        finally:
            db.close()


class AuthResolutionTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)

    def test_profile_is_created_as_admin_when_email_matches_admin_env(self):
        from app.auth import get_or_create_user_from_claims
        from app.models import APP_ROLE_ADMIN

        db = self.SessionLocal()
        try:
            user = get_or_create_user_from_claims(
                db,
                {"sub": "supabase-admin", "email": "Admin@Example.com"},
                admin_emails={"admin@example.com"},
            )
            db.commit()
            self.assertEqual(user.app_role, APP_ROLE_ADMIN)
            self.assertEqual(user.email, "admin@example.com")
        finally:
            db.close()

    def test_existing_user_role_is_not_downgraded_on_login(self):
        from app.auth import get_or_create_user_from_claims
        from app.models import APP_ROLE_CREATOR, User

        db = self.SessionLocal()
        try:
            db.add(
                User(
                    id="user-1",
                    supabase_user_id="supabase-creator",
                    email="creator@example.com",
                    app_role=APP_ROLE_CREATOR,
                )
            )
            db.commit()
            user = get_or_create_user_from_claims(
                db,
                {"sub": "supabase-creator", "email": "creator@example.com"},
                admin_emails=set(),
            )
            self.assertEqual(user.app_role, APP_ROLE_CREATOR)
        finally:
            db.close()

    def test_invalid_jwt_validation_maps_to_401(self):
        from app.auth import validate_supabase_jwt

        with (
            patch("app.auth.settings.supabase_jwks_url", "https://example.supabase.co/jwks.json"),
            patch("app.auth.PyJWKClient") as jwks_client,
            patch("app.auth.jwt.decode", side_effect=jwt.InvalidTokenError("bad token")),
        ):
            jwks_client.return_value.get_signing_key_from_jwt.return_value = SimpleNamespace(key="key")

            with self.assertRaises(HTTPException) as exc:
                validate_supabase_jwt("malformed-token")

        self.assertEqual(exc.exception.status_code, 401)
        self.assertEqual(exc.exception.detail, "Invalid authentication token")

    def test_created_profile_persists_after_session_closes(self):
        from app.auth import get_or_create_user_from_claims
        from app.models import User

        db = self.SessionLocal()
        try:
            user = get_or_create_user_from_claims(
                db,
                {"sub": "supabase-reader", "email": "reader@example.com"},
                admin_emails=set(),
            )
            user_id = user.id
        finally:
            db.close()

        db = self.SessionLocal()
        try:
            stored = db.get(User, user_id)
            self.assertIsNotNone(stored)
            self.assertEqual(stored.supabase_user_id, "supabase-reader")
            self.assertEqual(stored.email, "reader@example.com")
        finally:
            db.close()

    def test_existing_user_email_collision_raises_controlled_http_exception(self):
        from app.auth import get_or_create_user_from_claims
        from app.models import APP_ROLE_READER, User

        db = self.SessionLocal()
        try:
            db.add_all(
                [
                    User(
                        id="user-1",
                        supabase_user_id="supabase-1",
                        email="first@example.com",
                        app_role=APP_ROLE_READER,
                    ),
                    User(
                        id="user-2",
                        supabase_user_id="supabase-2",
                        email="second@example.com",
                        app_role=APP_ROLE_READER,
                    ),
                ]
            )
            db.commit()

            with self.assertRaises(HTTPException) as exc:
                get_or_create_user_from_claims(
                    db,
                    {"sub": "supabase-1", "email": "second@example.com"},
                    admin_emails=set(),
                )

            self.assertEqual(exc.exception.status_code, 409)
            self.assertEqual(exc.exception.detail, "Email is already associated with another user")
        finally:
            db.close()

    def test_require_user_rejects_anonymous_auth_context(self):
        from app.auth import AuthContext, require_user

        with self.assertRaises(HTTPException) as exc:
            require_user(AuthContext(user=None))

        self.assertEqual(exc.exception.status_code, 401)
        self.assertEqual(exc.exception.detail, "Authentication required")

    def test_require_admin_rejects_non_admin_user(self):
        from app.auth import require_admin
        from app.models import APP_ROLE_READER, User

        user = User(
            id="user-1",
            supabase_user_id="supabase-reader",
            email="reader@example.com",
            app_role=APP_ROLE_READER,
        )

        with self.assertRaises(HTTPException) as exc:
            require_admin(user)

        self.assertEqual(exc.exception.status_code, 403)
        self.assertEqual(exc.exception.detail, "Admin access required")


class SubjectAccessTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)

    def test_public_subject_can_be_read_without_user(self):
        from app.access import can_edit_subject, can_read_subject
        from app.models import SUBJECT_VISIBILITY_PUBLIC

        subject = Subject(id="subject-1", title="Public", visibility=SUBJECT_VISIBILITY_PUBLIC)
        self.assertTrue(can_read_subject(None, subject))
        self.assertFalse(can_edit_subject(None, subject))

    def test_signed_in_user_can_study_public_subject(self):
        from app.access import can_study_subject
        from app.models import SUBJECT_VISIBILITY_PUBLIC, User

        user = User(id="reader", supabase_user_id="reader-sub", email="reader@example.com", app_role="reader")
        subject = Subject(id="subject-1", title="Public", visibility=SUBJECT_VISIBILITY_PUBLIC)
        self.assertTrue(can_study_subject(user, subject))

    def test_anonymous_user_cannot_study_public_subject(self):
        from app.access import require_subject_study
        from app.models import SUBJECT_VISIBILITY_PUBLIC

        subject = Subject(id="subject-1", title="Public", visibility=SUBJECT_VISIBILITY_PUBLIC)

        with self.assertRaises(HTTPException) as exc:
            require_subject_study(None, subject)

        self.assertEqual(exc.exception.status_code, 401)
        self.assertEqual(exc.exception.detail, "Authentication required to study")

    def test_authenticated_outsider_cannot_study_private_subject(self):
        from app.access import require_subject_study
        from app.models import User

        outsider = User(id="outsider", supabase_user_id="out-sub", email="out@example.com", app_role="reader")
        subject = Subject(id="subject-1", title="Private", owner_user_id="owner", visibility="private")

        with self.assertRaises(HTTPException) as exc:
            require_subject_study(outsider, subject)

        self.assertEqual(exc.exception.status_code, 403)
        self.assertEqual(exc.exception.detail, "Subject access required to study")

    def test_admin_has_effective_read_and_edit_access_to_private_subject(self):
        from app.access import can_edit_subject, can_read_subject
        from app.models import APP_ROLE_ADMIN, User

        admin = User(id="admin", supabase_user_id="admin-sub", email="admin@example.com", app_role=APP_ROLE_ADMIN)
        subject = Subject(id="subject-1", title="Private", owner_user_id="owner", visibility="private")

        self.assertTrue(can_read_subject(admin, subject))
        self.assertTrue(can_edit_subject(admin, subject))

    def test_private_subject_requires_grant_or_owner(self):
        from app.access import can_edit_subject, can_read_subject
        from app.models import SubjectAccess, User

        db = self.SessionLocal()
        try:
            owner = User(id="owner", supabase_user_id="owner-sub", email="owner@example.com", app_role="creator")
            reader = User(id="reader", supabase_user_id="reader-sub", email="reader@example.com", app_role="reader")
            editor = User(id="editor", supabase_user_id="editor-sub", email="editor@example.com", app_role="reader")
            outsider = User(id="outsider", supabase_user_id="out-sub", email="out@example.com", app_role="reader")
            subject = Subject(id="subject-1", title="Private", owner_user_id="owner", visibility="private")
            db.add_all(
                [
                    owner,
                    reader,
                    editor,
                    outsider,
                    subject,
                    SubjectAccess(id="grant-read", subject_id="subject-1", user_id="reader", access_level="read"),
                    SubjectAccess(id="grant-edit", subject_id="subject-1", user_id="editor", access_level="edit"),
                ]
            )
            db.commit()
            stored = db.get(Subject, "subject-1")
            self.assertTrue(can_read_subject(owner, stored))
            self.assertTrue(can_read_subject(reader, stored))
            self.assertTrue(can_edit_subject(editor, stored))
            self.assertFalse(can_edit_subject(reader, stored))
            self.assertFalse(can_read_subject(outsider, stored))
        finally:
            db.close()

    def test_require_subject_read_returns_404_for_inaccessible_private_subject(self):
        from app.access import require_subject_read
        from app.models import User

        outsider = User(id="outsider", supabase_user_id="out-sub", email="out@example.com", app_role="reader")
        subject = Subject(id="subject-1", title="Private", owner_user_id="owner", visibility="private")

        with self.assertRaises(HTTPException) as exc:
            require_subject_read(outsider, subject)

        self.assertEqual(exc.exception.status_code, 404)
        self.assertEqual(exc.exception.detail, "Subject not found")

    def test_require_subject_edit_returns_403_for_read_only_user(self):
        from app.access import require_subject_edit
        from app.models import SubjectAccess, User

        reader = User(id="reader", supabase_user_id="reader-sub", email="reader@example.com", app_role="reader")
        subject = Subject(id="subject-1", title="Private", visibility="private")
        subject.access_grants = [
            SubjectAccess(id="grant-read", subject_id="subject-1", user_id="reader", access_level="read")
        ]

        with self.assertRaises(HTTPException) as exc:
            require_subject_edit(reader, subject)

        self.assertEqual(exc.exception.status_code, 403)
        self.assertEqual(exc.exception.detail, "Edit access required")

    def test_grant_owner_access_creates_owner_grant(self):
        from app.access import grant_owner_access
        from app.models import SubjectAccess, User

        db = self.SessionLocal()
        try:
            user = User(id="user-1", supabase_user_id="user-sub", email="user@example.com", app_role="creator")
            subject = Subject(id="subject-1", title="Private", visibility="private")
            db.add_all([user, subject])
            grant = grant_owner_access(db, subject, user)
            db.commit()

            stored_grant = db.get(SubjectAccess, grant.id)
            stored_subject = db.get(Subject, "subject-1")
            self.assertIsNotNone(stored_grant)
            self.assertEqual(stored_grant.subject_id, "subject-1")
            self.assertEqual(stored_grant.user_id, "user-1")
            self.assertEqual(stored_grant.access_level, "owner")
            self.assertIsNone(stored_subject.owner_user_id)
        finally:
            db.close()

    def test_grant_owner_access_updates_existing_read_grant_to_owner(self):
        from app.access import grant_owner_access
        from app.models import SubjectAccess, User

        db = self.SessionLocal()
        try:
            user = User(id="user-1", supabase_user_id="user-sub", email="user@example.com", app_role="reader")
            subject = Subject(id="subject-1", title="Private", visibility="private")
            existing = SubjectAccess(id="grant-read", subject_id="subject-1", user_id="user-1", access_level="read")
            db.add_all([user, subject, existing])
            db.commit()

            grant = grant_owner_access(db, subject, user)
            db.commit()

            stored_grants = db.query(SubjectAccess).filter(SubjectAccess.subject_id == "subject-1").all()
            stored_subject = db.get(Subject, "subject-1")
            self.assertEqual(grant.id, "grant-read")
            self.assertEqual(len(stored_grants), 1)
            self.assertEqual(stored_grants[0].access_level, "owner")
            self.assertIsNone(stored_subject.owner_user_id)
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
