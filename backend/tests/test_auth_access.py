import os
import unittest
from datetime import datetime, timedelta, timezone
from importlib import reload
from types import SimpleNamespace
from unittest.mock import patch

import jwt
from fastapi import HTTPException
from fastapi.testclient import TestClient
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

    def test_postgres_database_url_uses_psycopg_driver(self):
        try:
            with patch.dict(
                os.environ,
                {"DATABASE_URL": "postgresql://user:pass@example.supabase.co/postgres"},
                clear=False,
            ):
                reload(config)

                self.assertEqual(
                    config.settings.database_url,
                    "postgresql+psycopg://user:pass@example.supabase.co/postgres",
                )
        finally:
            reload(config)


class AuthSchemaCompatibilityTests(unittest.TestCase):
    def test_subject_auth_columns_are_added_to_existing_sqlite_table(self):
        from sqlalchemy import text
        from app.main import _ensure_subject_access_columns

        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        with engine.connect() as conn:
            conn.execute(text("CREATE TABLE subjects (id VARCHAR PRIMARY KEY, title VARCHAR NOT NULL)"))
            conn.commit()

        _ensure_subject_access_columns(engine)

        with engine.connect() as conn:
            columns = {row[1] for row in conn.execute(text("PRAGMA table_info(subjects)"))}
        self.assertIn("owner_user_id", columns)
        self.assertIn("visibility", columns)


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


class AdminRoutesTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)

    def test_admin_can_promote_user(self):
        from app.main import update_user_role
        from app.models import APP_ROLE_ADMIN, APP_ROLE_CREATOR, User
        from app.schemas import UserRoleUpdate

        db = self.SessionLocal()
        try:
            admin = User(id="admin", supabase_user_id="admin-sub", email="admin@example.com", app_role=APP_ROLE_ADMIN)
            reader = User(id="reader", supabase_user_id="reader-sub", email="reader@example.com", app_role="reader")
            db.add_all([admin, reader])
            db.commit()
            updated = update_user_role("reader", UserRoleUpdate(app_role=APP_ROLE_CREATOR), db=db, current_user=admin)
            self.assertEqual(updated.app_role, APP_ROLE_CREATOR)
        finally:
            db.close()

    def test_admin_can_reject_invalid_role(self):
        from app.main import update_user_role
        from app.models import APP_ROLE_ADMIN, User
        from app.schemas import UserRoleUpdate

        db = self.SessionLocal()
        try:
            admin = User(id="admin", supabase_user_id="admin-sub", email="admin@example.com", app_role=APP_ROLE_ADMIN)
            reader = User(id="reader", supabase_user_id="reader-sub", email="reader@example.com", app_role="reader")
            db.add_all([admin, reader])
            db.commit()

            with self.assertRaises(HTTPException) as exc:
                update_user_role("reader", UserRoleUpdate(app_role="manager"), db=db, current_user=admin)

            self.assertEqual(exc.exception.status_code, 400)
            self.assertEqual(exc.exception.detail, "Invalid app role")
        finally:
            db.close()

    def test_listing_public_requests_backfills_missing_short_code(self):
        from app.main import list_public_subject_requests
        from app.models import APP_ROLE_ADMIN, SUBJECT_VISIBILITY_PUBLIC_REQUESTED, SubjectShortCode, User

        db = self.SessionLocal()
        try:
            admin = User(id="admin", supabase_user_id="admin-sub", email="admin@example.com", app_role=APP_ROLE_ADMIN)
            subject = Subject(id="subject-1", title="Subject", visibility=SUBJECT_VISIBILITY_PUBLIC_REQUESTED)
            db.add_all([admin, subject])
            db.commit()

            subjects = list_public_subject_requests(db=db, current_user=admin)

            self.assertEqual(len(subjects), 1)
            self.assertIsNotNone(subjects[0].short_code)
            self.assertIsNotNone(db.query(SubjectShortCode).filter_by(subject_id="subject-1").one_or_none())
        finally:
            db.close()

    def test_admin_can_approve_public_subject(self):
        from app.main import approve_public_subject
        from app.models import APP_ROLE_ADMIN, SUBJECT_VISIBILITY_PUBLIC, SUBJECT_VISIBILITY_PUBLIC_REQUESTED, User

        db = self.SessionLocal()
        try:
            admin = User(id="admin", supabase_user_id="admin-sub", email="admin@example.com", app_role=APP_ROLE_ADMIN)
            subject = Subject(id="subject-1", title="Subject", visibility=SUBJECT_VISIBILITY_PUBLIC_REQUESTED)
            db.add_all([admin, subject])
            db.commit()
            updated = approve_public_subject("subject-1", db=db, current_user=admin)
            self.assertEqual(updated.visibility, SUBJECT_VISIBILITY_PUBLIC)
        finally:
            db.close()

    def test_admin_cannot_approve_subject_without_public_request(self):
        from app.main import approve_public_subject
        from app.models import APP_ROLE_ADMIN, SUBJECT_VISIBILITY_PRIVATE, User

        db = self.SessionLocal()
        try:
            admin = User(id="admin", supabase_user_id="admin-sub", email="admin@example.com", app_role=APP_ROLE_ADMIN)
            subject = Subject(id="subject-1", title="Subject", visibility=SUBJECT_VISIBILITY_PRIVATE)
            db.add_all([admin, subject])
            db.commit()

            with self.assertRaises(HTTPException) as exc:
                approve_public_subject("subject-1", db=db, current_user=admin)

            self.assertEqual(exc.exception.status_code, 400)
            self.assertEqual(exc.exception.detail, "Subject has not requested public visibility")
        finally:
            db.close()

    def test_approving_public_subject_backfills_missing_short_code(self):
        from app.main import approve_public_subject
        from app.models import APP_ROLE_ADMIN, SUBJECT_VISIBILITY_PUBLIC_REQUESTED, SubjectShortCode, User

        db = self.SessionLocal()
        try:
            admin = User(id="admin", supabase_user_id="admin-sub", email="admin@example.com", app_role=APP_ROLE_ADMIN)
            subject = Subject(id="subject-1", title="Subject", visibility=SUBJECT_VISIBILITY_PUBLIC_REQUESTED)
            db.add_all([admin, subject])
            db.commit()

            updated = approve_public_subject("subject-1", db=db, current_user=admin)

            self.assertIsNotNone(updated.short_code)
            self.assertIsNotNone(db.query(SubjectShortCode).filter_by(subject_id="subject-1").one_or_none())
        finally:
            db.close()

    def test_admin_can_keep_subject_private(self):
        from app.main import keep_subject_private
        from app.models import APP_ROLE_ADMIN, SUBJECT_VISIBILITY_PRIVATE, SUBJECT_VISIBILITY_PUBLIC_REQUESTED, User

        db = self.SessionLocal()
        try:
            admin = User(id="admin", supabase_user_id="admin-sub", email="admin@example.com", app_role=APP_ROLE_ADMIN)
            subject = Subject(id="subject-1", title="Subject", visibility=SUBJECT_VISIBILITY_PUBLIC_REQUESTED)
            db.add_all([admin, subject])
            db.commit()
            updated = keep_subject_private("subject-1", db=db, current_user=admin)
            self.assertEqual(updated.visibility, SUBJECT_VISIBILITY_PRIVATE)
        finally:
            db.close()

    def test_admin_cannot_keep_private_subject_without_public_request(self):
        from app.main import keep_subject_private
        from app.models import APP_ROLE_ADMIN, SUBJECT_VISIBILITY_PUBLIC, User

        db = self.SessionLocal()
        try:
            admin = User(id="admin", supabase_user_id="admin-sub", email="admin@example.com", app_role=APP_ROLE_ADMIN)
            subject = Subject(id="subject-1", title="Subject", visibility=SUBJECT_VISIBILITY_PUBLIC)
            db.add_all([admin, subject])
            db.commit()

            with self.assertRaises(HTTPException) as exc:
                keep_subject_private("subject-1", db=db, current_user=admin)

            self.assertEqual(exc.exception.status_code, 400)
            self.assertEqual(exc.exception.detail, "Subject has not requested public visibility")
        finally:
            db.close()

    def test_keeping_subject_private_backfills_missing_short_code(self):
        from app.main import keep_subject_private
        from app.models import APP_ROLE_ADMIN, SUBJECT_VISIBILITY_PUBLIC_REQUESTED, SubjectShortCode, User

        db = self.SessionLocal()
        try:
            admin = User(id="admin", supabase_user_id="admin-sub", email="admin@example.com", app_role=APP_ROLE_ADMIN)
            subject = Subject(id="subject-1", title="Subject", visibility=SUBJECT_VISIBILITY_PUBLIC_REQUESTED)
            db.add_all([admin, subject])
            db.commit()

            updated = keep_subject_private("subject-1", db=db, current_user=admin)

            self.assertIsNotNone(updated.short_code)
            self.assertIsNotNone(db.query(SubjectShortCode).filter_by(subject_id="subject-1").one_or_none())
        finally:
            db.close()


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


class SubjectRouteAuthorizationTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)

    def test_reader_cannot_create_subject(self):
        from app.main import create_subject
        from app.models import User
        from app.schemas import SubjectCreate

        db = self.SessionLocal()
        try:
            reader = User(id="reader", supabase_user_id="reader-sub", email="reader@example.com", app_role="reader")
            db.add(reader)
            db.commit()
            with self.assertRaises(Exception) as raised:
                create_subject(SubjectCreate(title="Subject", description=""), db=db, current_user=reader)
        finally:
            db.close()

        self.assertEqual(getattr(raised.exception, "status_code", None), 403)

    def test_creator_create_subject_sets_owner_and_owner_grant(self):
        from app.main import create_subject
        from app.models import SubjectAccess, User
        from app.schemas import SubjectCreate

        db = self.SessionLocal()
        try:
            creator = User(
                id="creator",
                supabase_user_id="creator-sub",
                email="creator@example.com",
                app_role="creator",
            )
            db.add(creator)
            db.commit()
            subject = create_subject(SubjectCreate(title="Subject", description=""), db=db, current_user=creator)
            grant = db.query(SubjectAccess).filter(SubjectAccess.subject_id == subject.id).one()
            self.assertEqual(subject.owner_user_id, "creator")
            self.assertEqual(grant.access_level, "owner")
        finally:
            db.close()

    def test_short_code_failure_rolls_back_subject_and_owner_grant(self):
        from app.main import create_subject
        from app.models import SubjectAccess, User
        from app.schemas import SubjectCreate

        db = self.SessionLocal()
        try:
            creator = User(
                id="creator",
                supabase_user_id="creator-sub",
                email="creator@example.com",
                app_role="creator",
            )
            db.add(creator)
            db.commit()
            with patch("app.main.ensure_subject_short_code", side_effect=RuntimeError("short code failed")):
                with self.assertRaises(RuntimeError):
                    create_subject(SubjectCreate(title="Subject", description=""), db=db, current_user=creator)

            self.assertEqual(db.query(Subject).count(), 0)
            self.assertEqual(db.query(SubjectAccess).count(), 0)
        finally:
            db.close()

    def test_duplicate_title_returns_409_for_creator(self):
        from app.main import create_subject
        from app.models import User
        from app.schemas import SubjectCreate

        db = self.SessionLocal()
        try:
            creator = User(
                id="creator",
                supabase_user_id="creator-sub",
                email="creator@example.com",
                app_role="creator",
            )
            db.add_all([creator, Subject(title="Subject", owner_user_id="creator")])
            db.commit()

            with self.assertRaises(HTTPException) as exc:
                create_subject(SubjectCreate(title="Subject", description=""), db=db, current_user=creator)

            self.assertEqual(exc.exception.status_code, 409)
            self.assertEqual(exc.exception.detail, "Subject title must be unique")
        finally:
            db.close()

    def test_empty_title_returns_400_for_creator(self):
        from app.main import create_subject
        from app.models import User
        from app.schemas import SubjectCreate

        db = self.SessionLocal()
        try:
            creator = User(
                id="creator",
                supabase_user_id="creator-sub",
                email="creator@example.com",
                app_role="creator",
            )
            db.add(creator)
            db.commit()

            with self.assertRaises(HTTPException) as exc:
                create_subject(SubjectCreate(title="  ", description=""), db=db, current_user=creator)

            self.assertEqual(exc.exception.status_code, 400)
            self.assertEqual(exc.exception.detail, "Title cannot be empty")
        finally:
            db.close()

    def test_admin_create_subject_sets_owner_and_owner_grant(self):
        from app.main import create_subject
        from app.models import APP_ROLE_ADMIN, SubjectAccess, User
        from app.schemas import SubjectCreate

        db = self.SessionLocal()
        try:
            admin = User(
                id="admin",
                supabase_user_id="admin-sub",
                email="admin@example.com",
                app_role=APP_ROLE_ADMIN,
            )
            db.add(admin)
            db.commit()
            subject = create_subject(SubjectCreate(title="Subject", description=""), db=db, current_user=admin)
            grant = db.query(SubjectAccess).filter(SubjectAccess.subject_id == subject.id).one()
            self.assertEqual(subject.owner_user_id, "admin")
            self.assertEqual(grant.user_id, "admin")
            self.assertEqual(grant.access_level, "owner")
        finally:
            db.close()

    def test_subject_owner_can_request_public_review(self):
        from app.main import request_subject_public
        from app.models import SUBJECT_VISIBILITY_PUBLIC_REQUESTED, User

        db = self.SessionLocal()
        try:
            creator = User(id="creator", supabase_user_id="creator-sub", email="creator@example.com", app_role="creator")
            subject = Subject(id="subject-1", title="Subject", owner_user_id=creator.id, visibility="private")
            db.add_all([creator, subject])
            db.commit()

            result = request_subject_public("subject-1", db=db, current_user=creator)

            self.assertEqual(result.visibility, SUBJECT_VISIBILITY_PUBLIC_REQUESTED)
        finally:
            db.close()

    def test_subject_owner_can_grant_and_revoke_subject_access(self):
        from app.main import delete_subject_access, upsert_subject_access
        from app.models import SubjectAccess, User
        from app.schemas import SubjectAccessGrantUpdate

        db = self.SessionLocal()
        try:
            owner = User(id="owner", supabase_user_id="owner-sub", email="owner@example.com", app_role="creator")
            reader = User(id="reader", supabase_user_id="reader-sub", email="reader@example.com", app_role="reader")
            subject = Subject(id="subject-1", title="Subject", owner_user_id=owner.id, visibility="private")
            db.add_all([owner, reader, subject])
            db.commit()

            grant = upsert_subject_access(
                "subject-1",
                "reader",
                SubjectAccessGrantUpdate(access_level="read"),
                db=db,
                current_user=owner,
            )
            self.assertEqual(grant.user_id, reader.id)
            self.assertEqual(grant.access_level, "read")

            updated = upsert_subject_access(
                "subject-1",
                "reader",
                SubjectAccessGrantUpdate(access_level="edit"),
                db=db,
                current_user=owner,
            )
            self.assertEqual(updated.access_level, "edit")

            result = delete_subject_access("subject-1", "reader", db=db, current_user=owner)
            self.assertEqual(result, {"deleted": True})
            self.assertEqual(db.query(SubjectAccess).count(), 0)
        finally:
            db.close()

    def test_edit_grant_cannot_manage_subject_access(self):
        from app.main import upsert_subject_access
        from app.models import SubjectAccess, User
        from app.schemas import SubjectAccessGrantUpdate

        db = self.SessionLocal()
        try:
            owner = User(id="owner", supabase_user_id="owner-sub", email="owner@example.com", app_role="creator")
            editor = User(id="editor", supabase_user_id="editor-sub", email="editor@example.com", app_role="reader")
            reader = User(id="reader", supabase_user_id="reader-sub", email="reader@example.com", app_role="reader")
            subject = Subject(id="subject-1", title="Subject", owner_user_id=owner.id, visibility="private")
            grant = SubjectAccess(id="editor-grant", subject_id=subject.id, user_id=editor.id, access_level="edit")
            db.add_all([owner, editor, reader, subject, grant])
            db.commit()

            with self.assertRaises(HTTPException) as exc:
                upsert_subject_access(
                    "subject-1",
                    "reader",
                    SubjectAccessGrantUpdate(access_level="read"),
                    db=db,
                    current_user=editor,
                )

            self.assertEqual(exc.exception.status_code, 403)
        finally:
            db.close()


class PublicSubjectRoutesTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)

    def test_public_subjects_only_returns_public_subjects(self):
        from app.main import list_public_subjects
        from app.models import SUBJECT_VISIBILITY_PUBLIC

        db = self.SessionLocal()
        try:
            db.add_all(
                [
                    Subject(id="private", title="Private", visibility="private"),
                    Subject(id="public", title="Public", visibility=SUBJECT_VISIBILITY_PUBLIC),
                ]
            )
            db.commit()
            subjects = list_public_subjects(db=db)
            self.assertEqual([subject.id for subject in subjects], ["public"])
        finally:
            db.close()

    def test_public_subject_output_excludes_owner_user_id(self):
        from app.models import SUBJECT_VISIBILITY_PUBLIC
        from app.schemas import PublicSubjectOut

        db = self.SessionLocal()
        try:
            subject = Subject(
                id="public",
                title="Public",
                description="Description",
                goal="Goal",
                scope="Scope",
                owner_user_id="owner-user-id",
                visibility=SUBJECT_VISIBILITY_PUBLIC,
            )
            db.add(subject)
            db.commit()
            db.refresh(subject)

            payload = PublicSubjectOut.model_validate(subject).model_dump()

            self.assertEqual(payload["id"], "public")
            self.assertEqual(payload["title"], "Public")
            self.assertEqual(payload["visibility"], SUBJECT_VISIBILITY_PUBLIC)
            self.assertIn("short_code", payload)
            self.assertIn("created_at", payload)
            self.assertIn("updated_at", payload)
            self.assertNotIn("owner_user_id", payload)
        finally:
            db.close()


class RouteAccessEnforcementTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)

    def _seed_private_course(self, db):
        from app.models import (
            Job,
            Module,
            NoteGroup,
            QuestionCard,
            StudyCard,
            SubjectAccess,
            User,
        )

        owner = User(id="owner", supabase_user_id="owner-sub", email="owner@example.com", app_role="creator")
        reader = User(id="reader", supabase_user_id="reader-sub", email="reader@example.com", app_role="reader")
        editor = User(id="editor", supabase_user_id="editor-sub", email="editor@example.com", app_role="reader")
        outsider = User(
            id="outsider",
            supabase_user_id="outsider-sub",
            email="outsider@example.com",
            app_role="reader",
        )
        private_subject = Subject(
            id="private-subject",
            title="Private Subject",
            owner_user_id="owner",
            visibility="private",
        )
        public_subject = Subject(id="public-subject", title="Public Subject", visibility="public")
        outsider_subject = Subject(
            id="outsider-subject",
            title="Outsider Subject",
            owner_user_id="outsider",
            visibility="private",
        )
        module = Module(id="module-1", subject_id="private-subject", title="Private Module")
        public_module = Module(id="public-module", subject_id="public-subject", title="Public Module")
        outsider_module = Module(id="outsider-module", subject_id="outsider-subject", title="Outsider Module")
        note_group = NoteGroup(
            id="note-group-1",
            module_id="module-1",
            title="Note Group",
            raw_text="raw",
            source="same-source",
            source_normalized="same-source",
        )
        inaccessible_duplicate = NoteGroup(
            id="note-group-secret",
            module_id="outsider-module",
            title="Secret Duplicate",
            raw_text="raw",
            source="same-source",
            source_normalized="same-source",
        )
        study_card = StudyCard(id="study-card-1", note_group_id="note-group-1", title="Study", content="Content")
        question_card = QuestionCard(
            id="question-card-1",
            note_group_id="note-group-1",
            type="mcq",
            prompt="Prompt?",
            options_json='["A", "B"]',
            correct_option_indices_json="[0]",
            option_explanations_json="[]",
            study_card_refs_json='["study-card-1"]',
            stale=False,
        )
        job = Job(id="job-1", type="note_group_auto_generation", status="queued", note_group_id="note-group-1")
        db.add_all(
            [
                owner,
                reader,
                editor,
                outsider,
                private_subject,
                public_subject,
                outsider_subject,
                module,
                public_module,
                outsider_module,
                note_group,
                inaccessible_duplicate,
                study_card,
                question_card,
                job,
                SubjectAccess(
                    id="reader-grant",
                    subject_id="private-subject",
                    user_id="reader",
                    access_level="read",
                ),
                SubjectAccess(
                    id="editor-grant",
                    subject_id="private-subject",
                    user_id="editor",
                    access_level="edit",
                ),
            ]
        )
        db.commit()
        return owner, reader, editor, outsider

    def _client(self, db):
        from app.db import get_db
        from app.main import app

        def override_db():
            yield db

        app.dependency_overrides[get_db] = override_db
        self.addCleanup(app.dependency_overrides.clear)
        return TestClient(app)

    def test_private_subject_read_requires_owner_or_grant(self):
        from app.main import get_subject

        db = self.SessionLocal()
        try:
            owner, reader, _, outsider = self._seed_private_course(db)
            client = self._client(db)

            self.assertEqual(client.get("/subjects/private-subject").status_code, 401)
            with self.assertRaises(HTTPException) as exc:
                get_subject("private-subject", db=db, current_user=outsider)
            self.assertEqual(exc.exception.status_code, 404)

            self.assertEqual(get_subject("private-subject", db=db, current_user=owner).id, "private-subject")
            self.assertEqual(get_subject("private-subject", db=db, current_user=reader).id, "private-subject")
        finally:
            db.close()

    def test_list_subjects_returns_only_readable_subjects(self):
        from app.main import list_subjects

        db = self.SessionLocal()
        try:
            _, reader, _, _ = self._seed_private_course(db)

            subjects = list_subjects(db=db, current_user=reader)

            self.assertEqual({subject.id for subject in subjects}, {"private-subject", "public-subject"})
        finally:
            db.close()

    def test_subject_modules_require_read_and_module_creation_requires_edit(self):
        from app.main import create_subject_module, list_subject_modules
        from app.schemas import ModuleCreate

        db = self.SessionLocal()
        try:
            _, reader, editor, outsider = self._seed_private_course(db)
            client = self._client(db)

            self.assertEqual(client.get("/subjects/private-subject/modules").status_code, 401)
            with self.assertRaises(HTTPException) as exc:
                list_subject_modules("private-subject", db=db, current_user=outsider)
            self.assertEqual(exc.exception.status_code, 404)

            self.assertEqual([module.id for module in list_subject_modules("private-subject", db=db, current_user=reader)], ["module-1"])
            with self.assertRaises(HTTPException) as exc:
                create_subject_module(
                    "private-subject",
                    ModuleCreate(title="Reader Module"),
                    db=db,
                    current_user=reader,
                )
            self.assertEqual(exc.exception.status_code, 403)

            module = create_subject_module(
                "private-subject",
                ModuleCreate(title="Editor Module"),
                db=db,
                current_user=editor,
            )
            self.assertEqual(module.subject_id, "private-subject")
        finally:
            db.close()

    def test_private_module_note_group_and_study_card_reads_require_access(self):
        from app.main import get_module, get_note_group, get_study_card

        db = self.SessionLocal()
        try:
            _, reader, _, outsider = self._seed_private_course(db)
            client = self._client(db)

            self.assertEqual(client.get("/modules/module-1").status_code, 401)
            for route_call, item_id in (
                (get_module, "module-1"),
                (get_note_group, "note-group-1"),
                (get_study_card, "study-card-1"),
            ):
                with self.assertRaises(HTTPException) as exc:
                    route_call(item_id, db=db, current_user=outsider)
                self.assertEqual(exc.exception.status_code, 404)
                self.assertEqual(route_call(item_id, db=db, current_user=reader).id, item_id)
        finally:
            db.close()

    def test_reader_cannot_mutate_subject_module_note_group_or_cards_but_editor_can(self):
        from app.main import (
            update_module,
            update_note_group_title,
            update_question_card,
            update_study_card,
            update_subject,
        )
        from app.schemas import ModuleUpdate, NoteGroupTitleUpdate, QuestionCardUpdate, StudyCardUpdate, SubjectUpdate

        db = self.SessionLocal()
        try:
            _, reader, editor, _ = self._seed_private_course(db)
            attempts = (
                (update_subject, ("private-subject", SubjectUpdate(description="reader"), db, reader)),
                (update_module, ("module-1", ModuleUpdate(description="reader"), db, reader)),
                (update_note_group_title, ("note-group-1", NoteGroupTitleUpdate(title="Reader"), db, reader)),
                (update_study_card, ("study-card-1", StudyCardUpdate(title="Reader"), db, reader)),
                (update_question_card, ("question-card-1", QuestionCardUpdate(prompt="Reader?"), db, reader)),
            )
            for route_call, args in attempts:
                with self.assertRaises(HTTPException) as exc:
                    route_call(args[0], args[1], db=args[2], current_user=args[3])
                self.assertEqual(exc.exception.status_code, 403)

            with patch("app.main._upsert_study_card_embedding"):
                self.assertEqual(
                    update_study_card(
                        "study-card-1",
                        StudyCardUpdate(title="Editor"),
                        db=db,
                        current_user=editor,
                    ).title,
                    "Editor",
                )
        finally:
            db.close()

    def test_review_question_and_chat_require_signed_in_read_access(self):
        from app.main import chat, review_question
        from app.schemas import ChatRequest, QuestionCardReview

        db = self.SessionLocal()
        try:
            _, reader, _, outsider = self._seed_private_course(db)
            client = self._client(db)

            self.assertEqual(client.post("/question-cards/question-card-1/review", json={"correct": True, "response_time_ms": 1, "answer_option_indices": [0]}).status_code, 401)
            with self.assertRaises(HTTPException) as exc:
                review_question(
                    "question-card-1",
                    QuestionCardReview(correct=True, response_time_ms=1, answer_option_indices=[0]),
                    db=db,
                    current_user=outsider,
                )
            self.assertEqual(exc.exception.status_code, 403)

            with patch("app.main.get_collection") as collection, patch("app.main.embed_texts", return_value=[[0.1]]), patch(
                "app.main.generate_chat_response",
                return_value={"answer": "ok", "used_ref_ids": ["study-card-1"]},
            ):
                collection.return_value.query.return_value = {
                    "ids": [["study-card-1"]],
                    "documents": [["Content"]],
                }
                result = chat(ChatRequest(module_id="module-1", message="Hi"), db=db, current_user=reader)
            self.assertEqual(result["answer"], "ok")

            with self.assertRaises(HTTPException) as exc:
                chat(ChatRequest(module_id="module-1", message="Hi"), db=db, current_user=outsider)
            self.assertEqual(exc.exception.status_code, 404)
        finally:
            db.close()

    def test_reader_review_uses_personal_learning_state_without_mutating_shared_question_card(self):
        from app.main import list_review_question_cards, review_question
        from app.models import QuestionCard, QuestionCardLearningState, QuestionCardReviewEvent
        from app.schemas import QuestionCardReview

        db = self.SessionLocal()
        try:
            _, reader, _, _ = self._seed_private_course(db)
            card = db.get(QuestionCard, "question-card-1")
            original_due_at = card.due_at
            original_reps = card.reps
            original_difficulty = card.difficulty

            result = review_question(
                "question-card-1",
                QuestionCardReview(correct=True, response_time_ms=1, answer_option_indices=[0]),
                db=db,
                current_user=reader,
            )

            db.refresh(card)
            event = db.query(QuestionCardReviewEvent).one()
            self.assertEqual(event.user_id, reader.id)
            self.assertEqual(card.due_at, original_due_at)
            self.assertEqual(card.reps, original_reps)
            self.assertEqual(card.difficulty, original_difficulty)
            self.assertEqual(result["id"], card.id)
            self.assertEqual(result["due_at"], event.next_due_at)
            self.assertIsNotNone(result["last_review_at"])
            self.assertNotEqual(event.next_due_at, original_due_at)

            learning_state = (
                db.query(QuestionCardLearningState)
                .filter(
                    QuestionCardLearningState.question_card_id == card.id,
                    QuestionCardLearningState.user_id == reader.id,
                )
                .one()
            )
            learning_state.due_at = datetime.now(timezone.utc) + timedelta(days=10)
            db.commit()

            due_cards = list_review_question_cards("note-group-1", mode="due", limit=10, db=db, current_user=reader)
            self.assertEqual(due_cards["question_cards"], [])
        finally:
            db.close()

    def test_global_jobs_list_is_not_anonymous(self):
        db = self.SessionLocal()
        try:
            self._seed_private_course(db)
            client = self._client(db)

            self.assertEqual(client.get("/jobs").status_code, 401)
        finally:
            db.close()

    def test_source_check_filters_inaccessible_duplicate_metadata(self):
        from app.main import check_note_group_source
        from app.schemas import NoteGroupSourceCheckRequest

        db = self.SessionLocal()
        try:
            _, reader, _, _ = self._seed_private_course(db)

            result = check_note_group_source(
                NoteGroupSourceCheckRequest(source="same-source"),
                db=db,
                current_user=reader,
            )

            self.assertEqual([duplicate["id"] for duplicate in result["duplicates"]], ["note-group-1"])
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
