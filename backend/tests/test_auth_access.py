import asyncio
import json
import os
import unittest
from datetime import datetime, timedelta, timezone
from importlib import reload
from pathlib import Path
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
from app.schemas import SubjectAccessOut, SubjectActivityEventOut, UserOut


class AuthConfigTests(unittest.TestCase):
    def test_env_files_load_from_root_then_backend_without_overrides(self):
        calls = []

        def fake_load_dotenv(path, override=False):
            calls.append((Path(path), override))

        config._load_env_files(load=fake_load_dotenv)

        self.assertEqual(
            calls,
            [
                (config.REPO_ROOT / ".env", False),
                (config.BASE_DIR / ".env", False),
            ],
        )

    def test_admin_emails_are_normalized(self):
        try:
            with patch.dict(
                os.environ,
                {
                    "ADMIN_EMAILS": " Admin@Example.com,second@example.com ,,,",
                    "SUPABASE_URL": "https://example.supabase.co",
                    "SUPABASE_SECRET_KEY": "sb_secret_test",
                    "SUPABASE_JWKS_URL": "https://example.supabase.co/auth/v1/.well-known/jwks.json",
                    "SUPABASE_JWT_ISSUER": "https://example.supabase.co/auth/v1",
                    "SUPABASE_JWT_AUDIENCE": "authenticated",
                },
                clear=False,
            ):
                reload(config)

                self.assertEqual(config.settings.admin_emails, {"admin@example.com", "second@example.com"})
                self.assertEqual(config.settings.supabase_secret_key, "sb_secret_test")
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
                    access_level="maintainer",
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
                    access_level="edit",
                )
            )

            with self.assertRaises(IntegrityError):
                db.commit()
        finally:
            db.close()

    def test_user_and_subject_access_schemas_serialize_orm_models(self):
        from app.models import SubjectActivityEvent

        db = self.SessionLocal()
        try:
            user, _, grant = self._add_owner_subject_and_grant(db)
            event = SubjectActivityEvent(
                id="event-1",
                subject_id="subject-1",
                actor_user_id="user-1",
                event_type="created",
                entity_type="module",
                entity_id="module-1",
                entity_title="Module",
            )
            db.add(event)
            db.commit()

            user_out = UserOut.model_validate(user)
            grant_out = SubjectAccessOut.model_validate(grant)
            event_out = SubjectActivityEventOut.model_validate(event)

            self.assertEqual(user_out.id, "user-1")
            self.assertEqual(user_out.email, "owner@example.com")
            self.assertEqual(user_out.app_role, "creator")
            self.assertEqual(grant_out.id, "access-1")
            self.assertEqual(grant_out.subject_id, "subject-1")
            self.assertEqual(grant_out.user_id, "user-1")
            self.assertEqual(grant_out.access_level, "owner")
            self.assertEqual(event_out.id, "event-1")
            self.assertEqual(event_out.actor_user_id, "user-1")
            self.assertEqual(event_out.actor_email, "owner@example.com")
            self.assertEqual(event_out.event_type, "created")
            self.assertEqual(event_out.entity_type, "module")
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

    def test_jwt_validation_allows_supabase_es256_signing_keys(self):
        from app.auth import validate_supabase_jwt

        expected_claims = {"sub": "supabase-user", "email": "user@example.com"}

        def fake_decode(token, key, algorithms, audience, issuer, options):
            if "ES256" not in algorithms:
                raise jwt.InvalidAlgorithmError("The specified alg value is not allowed")
            return expected_claims

        with (
            patch("app.auth.settings.supabase_jwks_url", "https://example.supabase.co/jwks.json"),
            patch("app.auth.PyJWKClient") as jwks_client,
            patch("app.auth.jwt.decode", side_effect=fake_decode),
        ):
            jwks_client.return_value.get_signing_key_from_jwt.return_value = SimpleNamespace(key="ec-key")

            claims = validate_supabase_jwt("es256-token")

        self.assertEqual(claims, expected_claims)

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

    def test_current_user_profile_returns_authenticated_user(self):
        from app.main import get_current_user_profile
        from app.models import APP_ROLE_ADMIN, User

        user = User(
            id="admin",
            supabase_user_id="admin-sub",
            email="admin@example.com",
            app_role=APP_ROLE_ADMIN,
        )

        result = get_current_user_profile(current_user=user)

        self.assertEqual(result.id, "admin")
        self.assertEqual(result.email, "admin@example.com")
        self.assertEqual(result.app_role, APP_ROLE_ADMIN)

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
            maintainer = User(id="maintainer", supabase_user_id="maintainer-sub", email="maintainer@example.com", app_role="reader")
            outsider = User(id="outsider", supabase_user_id="out-sub", email="out@example.com", app_role="reader")
            subject = Subject(id="subject-1", title="Private", owner_user_id="owner", visibility="private")
            db.add_all(
                [
                    owner,
                    reader,
                    maintainer,
                    outsider,
                    subject,
                    SubjectAccess(id="grant-reader", subject_id="subject-1", user_id="reader", access_level="reader"),
                    SubjectAccess(id="grant-maintainer", subject_id="subject-1", user_id="maintainer", access_level="maintainer"),
                ]
            )
            db.commit()
            stored = db.get(Subject, "subject-1")
            self.assertTrue(can_read_subject(owner, stored))
            self.assertTrue(can_read_subject(reader, stored))
            self.assertTrue(can_edit_subject(maintainer, stored))
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
            SubjectAccess(id="grant-reader", subject_id="subject-1", user_id="reader", access_level="reader")
        ]

        with self.assertRaises(HTTPException) as exc:
            require_subject_edit(reader, subject)

        self.assertEqual(exc.exception.status_code, 403)
        self.assertEqual(exc.exception.detail, "Maintainer access required")

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

    def test_grant_owner_access_updates_existing_reader_grant_to_owner(self):
        from app.access import grant_owner_access
        from app.models import SubjectAccess, User

        db = self.SessionLocal()
        try:
            user = User(id="user-1", supabase_user_id="user-sub", email="user@example.com", app_role="reader")
            subject = Subject(id="subject-1", title="Private", visibility="private")
            existing = SubjectAccess(id="grant-reader", subject_id="subject-1", user_id="user-1", access_level="reader")
            db.add_all([user, subject, existing])
            db.commit()

            grant = grant_owner_access(db, subject, user)
            db.commit()

            stored_grants = db.query(SubjectAccess).filter(SubjectAccess.subject_id == "subject-1").all()
            stored_subject = db.get(Subject, "subject-1")
            self.assertEqual(grant.id, "grant-reader")
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
                SubjectAccessGrantUpdate(access_level="reader"),
                db=db,
                current_user=owner,
            )
            self.assertEqual(grant.user_id, reader.id)
            self.assertEqual(grant.access_level, "reader")

            updated = upsert_subject_access(
                "subject-1",
                "reader",
                SubjectAccessGrantUpdate(access_level="maintainer"),
                db=db,
                current_user=owner,
            )
            self.assertEqual(updated.access_level, "maintainer")

            result = delete_subject_access("subject-1", "reader", db=db, current_user=owner)
            self.assertEqual(result, {"deleted": True})
            self.assertEqual(db.query(SubjectAccess).count(), 0)
        finally:
            db.close()

    def test_maintainer_can_manage_non_owner_subject_access(self):
        from app.main import upsert_subject_access
        from app.models import SubjectAccess, User
        from app.schemas import SubjectAccessGrantUpdate

        db = self.SessionLocal()
        try:
            owner = User(id="owner", supabase_user_id="owner-sub", email="owner@example.com", app_role="creator")
            maintainer = User(id="maintainer", supabase_user_id="maintainer-sub", email="maintainer@example.com", app_role="reader")
            reader = User(id="reader", supabase_user_id="reader-sub", email="reader@example.com", app_role="reader")
            subject = Subject(id="subject-1", title="Subject", owner_user_id=owner.id, visibility="private")
            grant = SubjectAccess(id="maintainer-grant", subject_id=subject.id, user_id=maintainer.id, access_level="maintainer")
            db.add_all([owner, maintainer, reader, subject, grant])
            db.commit()

            updated = upsert_subject_access(
                "subject-1",
                "reader",
                SubjectAccessGrantUpdate(access_level="reader"),
                db=db,
                current_user=maintainer,
            )
            self.assertEqual(updated.access_level, "reader")

            with self.assertRaises(HTTPException) as exc:
                upsert_subject_access(
                    "subject-1",
                    "reader",
                    SubjectAccessGrantUpdate(access_level="owner"),
                    db=db,
                    current_user=maintainer,
                )

            self.assertEqual(exc.exception.status_code, 403)
        finally:
            db.close()

    def test_owner_transfer_demotes_previous_owner_to_maintainer(self):
        from app.main import upsert_subject_access
        from app.models import SubjectAccess, User
        from app.schemas import SubjectAccessGrantUpdate
        from sqlalchemy import text

        db = self.SessionLocal()
        try:
            db.execute(
                text(
                    "CREATE UNIQUE INDEX uq_test_subject_access_single_owner "
                    "ON subject_access(subject_id) WHERE access_level = 'owner'"
                )
            )
            owner = User(id="owner", supabase_user_id="owner-sub", email="owner@example.com", app_role="creator")
            next_owner = User(id="next-owner", supabase_user_id="next-owner-sub", email="next@example.com", app_role="creator")
            subject = Subject(id="subject-1", title="Subject", owner_user_id=owner.id, visibility="private")
            owner_grant = SubjectAccess(id="owner-grant", subject_id=subject.id, user_id=owner.id, access_level="owner")
            next_owner_grant = SubjectAccess(
                id="next-owner-grant",
                subject_id=subject.id,
                user_id=next_owner.id,
                access_level="reader",
            )
            db.add_all([owner, next_owner, subject, owner_grant, next_owner_grant])
            db.commit()

            grant = upsert_subject_access(
                "subject-1",
                "next-owner",
                SubjectAccessGrantUpdate(access_level="owner"),
                db=db,
                current_user=owner,
            )

            db.refresh(subject)
            self.assertEqual(subject.owner_user_id, "next-owner")
            self.assertEqual(grant.access_level, "owner")
            self.assertEqual(owner_grant.access_level, "maintainer")
            self.assertEqual(next_owner_grant.access_level, "owner")
        finally:
            db.close()

    def test_owner_cannot_downgrade_their_own_owner_grant(self):
        from app.main import upsert_subject_access
        from app.models import SubjectAccess, User
        from app.schemas import SubjectAccessGrantUpdate

        db = self.SessionLocal()
        try:
            owner = User(id="owner", supabase_user_id="owner-sub", email="owner@example.com", app_role="creator")
            subject = Subject(id="subject-1", title="Subject", owner_user_id=owner.id, visibility="private")
            owner_grant = SubjectAccess(
                id="owner-grant",
                subject_id=subject.id,
                user_id=owner.id,
                access_level="owner",
            )
            db.add_all([owner, subject, owner_grant])
            db.commit()

            with self.assertRaises(HTTPException) as exc:
                upsert_subject_access(
                    "subject-1",
                    "owner",
                    SubjectAccessGrantUpdate(access_level="maintainer"),
                    db=db,
                    current_user=owner,
                )

            db.refresh(subject)
            db.refresh(owner_grant)
            self.assertEqual(exc.exception.status_code, 400)
            self.assertEqual(exc.exception.detail, "Transfer ownership before changing the owner role")
            self.assertEqual(subject.owner_user_id, "owner")
            self.assertEqual(owner_grant.access_level, "owner")
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
            SubjectShortCode,
            ModuleShortCode,
            NoteGroupShortCode,
            TopicChip,
            TopicChipShortCode,
            User,
        )

        owner = User(id="owner", supabase_user_id="owner-sub", email="owner@example.com", app_role="creator")
        reader = User(id="reader", supabase_user_id="reader-sub", email="reader@example.com", app_role="reader")
        maintainer = User(
            id="maintainer",
            supabase_user_id="maintainer-sub",
            email="maintainer@example.com",
            app_role="reader",
        )
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
        public_topic = TopicChip(id="public-topic", module_id="public-module", label="Public Topic")
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
        job = Job(id="job-1", type="NOTE_GROUP_AUTO_GENERATION", status="queued", note_group_id="note-group-1")
        db.add_all(
            [
                owner,
                reader,
                maintainer,
                outsider,
                private_subject,
                public_subject,
                outsider_subject,
                module,
                public_module,
                outsider_module,
                public_topic,
                note_group,
                inaccessible_duplicate,
                study_card,
                question_card,
                job,
                SubjectAccess(
                    id="reader-grant",
                    subject_id="private-subject",
                    user_id="reader",
                    access_level="reader",
                ),
                SubjectAccess(
                    id="maintainer-grant",
                    subject_id="private-subject",
                    user_id="maintainer",
                    access_level="maintainer",
                ),
                SubjectShortCode(subject_id="private-subject", short_code="priv"),
                SubjectShortCode(subject_id="public-subject", short_code="pub"),
                ModuleShortCode(module_id="module-1", short_code="privmod"),
                ModuleShortCode(module_id="public-module", short_code="mod"),
                NoteGroupShortCode(note_group_id="note-group-1", short_code="ng"),
                TopicChipShortCode(topic_chip_id="public-topic", short_code="topic"),
            ]
        )
        db.commit()
        return owner, reader, maintainer, outsider

    def _client(self, db, user=None):
        from app.auth import AuthContext, get_auth_context
        import app.db as db_module

        original_engine = db_module.engine
        original_session_kwargs = dict(db_module.SessionLocal.kw)
        db_module.engine = db.get_bind()
        db_module.SessionLocal.configure(bind=db.get_bind())
        self.addCleanup(setattr, db_module, "engine", original_engine)
        self.addCleanup(db_module.SessionLocal.configure, **original_session_kwargs)

        from app.db import get_db
        from app.main import app

        def override_db():
            yield db

        app.dependency_overrides[get_db] = override_db
        if user is not None:
            app.dependency_overrides[get_auth_context] = lambda: AuthContext(user=user)
        self.addCleanup(app.dependency_overrides.clear)
        return TestClient(app)

    def _read_sse_event(self, line_source):
        event_name = None
        data_lines = []
        lines = line_source.iter_lines() if hasattr(line_source, "iter_lines") else line_source
        for line in lines:
            if isinstance(line, bytes):
                line = line.decode("utf-8")
            if line == "":
                if event_name or data_lines:
                    payload = json.loads("\n".join(data_lines)) if data_lines else None
                    return event_name, payload
                continue
            if line.startswith(":"):
                continue
            if line.startswith("event:"):
                event_name = line.split(":", 1)[1].strip()
                continue
            if line.startswith("data:"):
                data_lines.append(line.split(":", 1)[1].lstrip())
        self.fail("Stream closed before delivering an SSE event")

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

    def test_anonymous_user_can_restore_public_subject_route_only(self):
        db = self.SessionLocal()
        try:
            self._seed_private_course(db)
            client = self._client(db)

            public_response = client.get("/routes/app/subject/pub")
            private_response = client.get("/routes/app/subject/priv")
            public_modules_response = client.get("/subjects/public-subject/modules")
            private_modules_response = client.get("/subjects/private-subject/modules")

            self.assertEqual(public_response.status_code, 200)
            self.assertEqual(public_response.json()["subject_id"], "public-subject")
            self.assertEqual(private_response.status_code, 404)
            self.assertEqual(public_modules_response.status_code, 200)
            self.assertEqual(public_modules_response.json()[0]["id"], "public-module")
            self.assertEqual(private_modules_response.status_code, 404)
        finally:
            db.close()

    def test_list_subjects_returns_only_readable_subjects(self):
        from app.main import list_subjects

        db = self.SessionLocal()
        try:
            _, reader, _, _ = self._seed_private_course(db)

            subjects = list_subjects(db=db, current_user=reader)

            self.assertEqual({subject.id for subject in subjects}, {"private-subject", "public-subject"})
            levels_by_id = {subject.id: subject.current_user_access_level for subject in subjects}
            self.assertEqual(levels_by_id["private-subject"], "reader")
            self.assertEqual(levels_by_id["public-subject"], "reader")
        finally:
            db.close()

    def test_subject_modules_require_read_and_module_creation_requires_maintainer(self):
        from app.main import create_subject_module, list_subject_modules
        from app.schemas import ModuleCreate

        db = self.SessionLocal()
        try:
            _, reader, maintainer, outsider = self._seed_private_course(db)
            client = self._client(db)

            self.assertEqual(client.get("/subjects/private-subject/modules").status_code, 404)
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
                ModuleCreate(title="Maintainer Module"),
                db=db,
                current_user=maintainer,
            )
            self.assertEqual(module.subject_id, "private-subject")
        finally:
            db.close()

    def test_module_creation_records_subject_activity_for_maintainers(self):
        from app.main import create_subject_module, list_subject_activity
        from app.models import SubjectActivityEvent
        from app.schemas import ModuleCreate

        db = self.SessionLocal()
        try:
            _, reader, maintainer, _ = self._seed_private_course(db)

            create_subject_module(
                "private-subject",
                ModuleCreate(title="Maintainer Module"),
                db=db,
                current_user=maintainer,
            )

            event = db.query(SubjectActivityEvent).one()
            self.assertEqual(event.subject_id, "private-subject")
            self.assertEqual(event.actor_user_id, "maintainer")
            self.assertEqual(event.event_type, "created")
            self.assertEqual(event.entity_type, "module")
            self.assertEqual(event.entity_title, "Maintainer Module")

            with self.assertRaises(HTTPException) as exc:
                list_subject_activity("private-subject", db=db, current_user=reader)
            self.assertEqual(exc.exception.status_code, 403)

            activity = list_subject_activity("private-subject", db=db, current_user=maintainer)
            self.assertEqual(len(activity), 1)
            self.assertEqual(activity[0]["actor_email"], "maintainer@example.com")
            self.assertEqual(activity[0]["entity_title"], "Maintainer Module")
        finally:
            db.close()

    def test_private_module_note_group_and_study_card_reads_require_access(self):
        from app.main import get_module, get_note_group, get_study_card

        db = self.SessionLocal()
        try:
            _, reader, _, outsider = self._seed_private_course(db)
            client = self._client(db)

            self.assertEqual(client.get("/modules/module-1").status_code, 404)
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

    def test_readers_do_not_see_unfinished_note_group_generation_placeholders(self):
        from app.main import (
            get_module_overview,
            get_note_group,
            list_note_groups,
            resolve_note_group_app_route,
        )
        from app.models import NoteGroup, NoteGroupShortCode

        db = self.SessionLocal()
        try:
            _, reader, maintainer, _ = self._seed_private_course(db)
            db.add(
                NoteGroup(
                    id="note-group-generating",
                    module_id="module-1",
                    title="Generating placeholder",
                    raw_text="raw",
                    generation_status="generating",
                )
            )
            db.add(NoteGroupShortCode(note_group_id="note-group-generating", short_code="gen"))
            db.commit()

            reader_note_groups = list_note_groups("module-1", chip_ids=None, db=db, current_user=reader)
            maintainer_note_groups = list_note_groups("module-1", chip_ids=None, db=db, current_user=maintainer)
            reader_overview = get_module_overview("module-1", chip_ids=None, db=db, current_user=reader)

            self.assertEqual([group.id for group in reader_note_groups], ["note-group-1"])
            self.assertEqual(
                {group.id for group in maintainer_note_groups},
                {"note-group-1", "note-group-generating"},
            )
            self.assertEqual(
                [group.id for group in reader_overview["note_groups"]],
                ["note-group-1"],
            )
            with self.assertRaises(HTTPException) as exc:
                get_note_group("note-group-generating", db=db, current_user=reader)
            self.assertEqual(exc.exception.status_code, 404)
            self.assertEqual(
                get_note_group("note-group-generating", db=db, current_user=maintainer).id,
                "note-group-generating",
            )
            with self.assertRaises(HTTPException) as route_exc:
                resolve_note_group_app_route(
                    "priv",
                    "privmod",
                    "gen",
                    db=db,
                    current_user=reader,
                )
            self.assertEqual(route_exc.exception.status_code, 404)
            maintainer_route_response = resolve_note_group_app_route(
                "priv",
                "privmod",
                "gen",
                db=db,
                current_user=maintainer,
            )
            self.assertEqual(
                maintainer_route_response["note_group_id"],
                "note-group-generating",
            )
        finally:
            db.close()

    def test_reader_cannot_mutate_subject_module_note_group_or_cards_but_maintainer_can(self):
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
            _, reader, maintainer, _ = self._seed_private_course(db)
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
                        StudyCardUpdate(title="Maintainer"),
                        db=db,
                        current_user=maintainer,
                    ).title,
                    "Maintainer",
                )
        finally:
            db.close()

    def test_maintainer_cannot_delete_subject_but_owner_can(self):
        from app.main import delete_subject

        db = self.SessionLocal()
        try:
            owner, _, maintainer, _ = self._seed_private_course(db)

            with self.assertRaises(HTTPException) as exc:
                delete_subject("private-subject", db=db, current_user=maintainer)
            self.assertEqual(exc.exception.status_code, 403)
            self.assertEqual(exc.exception.detail, "Owner access required")

            self.assertEqual(delete_subject("private-subject", db=db, current_user=owner), {"deleted": True})
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

            with patch(
                "app.main.query_study_card_embeddings",
                return_value=[
                    SimpleNamespace(study_card_id="study-card-1", content="Content")
                ],
            ), patch("app.main.embed_texts", return_value=[[0.1]]), patch(
                "app.main.generate_chat_response",
                return_value={"answer": "ok", "used_ref_ids": ["study-card-1"]},
            ):
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

    def test_maintainers_and_admins_can_list_module_jobs(self):
        db = self.SessionLocal()
        try:
            from app.models import APP_ROLE_ADMIN, User

            owner, reader, maintainer, outsider = self._seed_private_course(db)
            admin = User(id="admin", supabase_user_id="admin-sub", email="admin@example.com", app_role=APP_ROLE_ADMIN)
            db.add(admin)
            db.commit()

            owner_response = self._client(db, owner).get(
                "/jobs?type=NOTE_GROUP_AUTO_GENERATION&status=queued,running,failed,cancelled&module_id=module-1"
            )
            maintainer_response = self._client(db, maintainer).get(
                "/jobs?type=NOTE_GROUP_AUTO_GENERATION&status=queued,running,failed,cancelled&module_id=module-1"
            )
            admin_response = self._client(db, admin).get(
                "/jobs?type=NOTE_GROUP_AUTO_GENERATION&status=queued,running,failed,cancelled&module_id=module-1"
            )
            reader_response = self._client(db, reader).get(
                "/jobs?type=NOTE_GROUP_AUTO_GENERATION&status=queued&module_id=module-1"
            )
            global_response = self._client(db, reader).get("/jobs")
            outsider_response = self._client(db, outsider).get(
                "/jobs?type=NOTE_GROUP_AUTO_GENERATION&status=queued&module_id=module-1"
            )
            maintainer_job_response = self._client(db, maintainer).get("/jobs/job-1")
            reader_job_response = self._client(db, reader).get("/jobs/job-1")

            self.assertEqual(owner_response.status_code, 200)
            self.assertEqual(maintainer_response.status_code, 200)
            self.assertEqual(admin_response.status_code, 200)
            self.assertEqual([job["id"] for job in maintainer_response.json()], ["job-1"])
            self.assertEqual(reader_response.status_code, 403)
            self.assertEqual(global_response.status_code, 403)
            self.assertEqual(outsider_response.status_code, 404)
            self.assertEqual(maintainer_job_response.status_code, 200)
            self.assertEqual(reader_job_response.status_code, 403)
        finally:
            db.close()

    def test_module_generation_workflow_snapshot_and_stream_require_maintainer_access(self):
        from app.generation_workflow import initialize_job_workflow, start_job_stage
        from app.models import JOB_STAGE_TITLE, Job

        db = self.SessionLocal()
        try:
            owner, reader, maintainer, outsider = self._seed_private_course(db)
            job = db.get(Job, "job-1")
            initialize_job_workflow(db, job, "raw text", "unique-id", "Stay in scope")
            start_job_stage(db, job, JOB_STAGE_TITLE)
            db.commit()

            anonymous_snapshot = self._client(db).get("/modules/module-1/generation-workflow")
            anonymous_stream = self._client(db).get("/modules/module-1/generation-workflow/events")
            reader_snapshot = self._client(db, reader).get("/modules/module-1/generation-workflow")
            reader_stream = self._client(db, reader).get("/modules/module-1/generation-workflow/events")
            outsider_snapshot = self._client(db, outsider).get("/modules/module-1/generation-workflow")
            outsider_stream = self._client(db, outsider).get("/modules/module-1/generation-workflow/events")
            owner_snapshot = self._client(db, owner).get("/modules/module-1/generation-workflow")

            self.assertEqual(anonymous_snapshot.status_code, 401)
            self.assertEqual(anonymous_stream.status_code, 401)
            self.assertEqual(reader_snapshot.status_code, 403)
            self.assertEqual(reader_stream.status_code, 403)
            self.assertEqual(outsider_snapshot.status_code, 404)
            self.assertEqual(outsider_stream.status_code, 404)
            self.assertEqual(owner_snapshot.status_code, 200)
            self.assertEqual(owner_snapshot.json()["module_id"], "module-1")
            self.assertEqual([item["job"]["id"] for item in owner_snapshot.json()["jobs"]], ["job-1"])
            self.assertEqual(owner_snapshot.json()["jobs"][0]["current_stage"], JOB_STAGE_TITLE)
            self.assertEqual(owner_snapshot.json()["jobs"][0]["note_group"]["title"], "Note Group")

            from app.main import (
                _module_generation_workflow_event_stream,
                stream_module_generation_workflow,
            )

            class FakeRequest:
                async def is_disconnected(self):
                    return False

            stream_response = stream_module_generation_workflow(
                "module-1",
                FakeRequest(),
                db=db,
                current_user=maintainer,
            )
            self.assertEqual(stream_response.media_type, "text/event-stream")

            async def read_initial_snapshot():
                stream = _module_generation_workflow_event_stream(FakeRequest(), self.SessionLocal, "module-1")
                try:
                    return await stream.__anext__()
                finally:
                    await stream.aclose()

            event_name, payload = self._read_sse_event(
                asyncio.run(read_initial_snapshot()).splitlines()
            )
            self.assertEqual(event_name, "snapshot")
            self.assertEqual(payload["module_id"], "module-1")
            self.assertEqual([item["job"]["id"] for item in payload["jobs"]], ["job-1"])
            self.assertEqual(payload["jobs"][0]["current_stage"], JOB_STAGE_TITLE)
        finally:
            db.close()

    def test_job_workflow_snapshot_returns_stages_and_logs_for_maintainers_only(self):
        from app.generation_workflow import (
            append_job_log,
            initialize_job_workflow,
            set_stage_progress,
            start_job_stage,
        )
        from app.models import JOB_STAGE_STUDY_CARDS, Job

        db = self.SessionLocal()
        try:
            _, reader, maintainer, _ = self._seed_private_course(db)
            job = db.get(Job, "job-1")
            initialize_job_workflow(db, job, "raw text", "unique-id", "Stay in scope")
            start_job_stage(db, job, JOB_STAGE_STUDY_CARDS)
            set_stage_progress(db, job, JOB_STAGE_STUDY_CARDS, 2, 5, message="Created 2 Study Cards")
            append_job_log(db, job, JOB_STAGE_STUDY_CARDS, "Kept examples literal", {"level": "info"})
            db.commit()

            anonymous_response = self._client(db).get("/jobs/job-1/workflow")
            reader_response = self._client(db, reader).get("/jobs/job-1/workflow")
            maintainer_response = self._client(db, maintainer).get("/jobs/job-1/workflow")

            self.assertEqual(anonymous_response.status_code, 401)
            self.assertEqual(reader_response.status_code, 403)
            self.assertEqual(maintainer_response.status_code, 200)

            payload = maintainer_response.json()
            self.assertEqual(payload["job"]["id"], "job-1")
            self.assertEqual(payload["current_stage"], JOB_STAGE_STUDY_CARDS)
            self.assertEqual(payload["note_group"]["title"], "Note Group")
            study_cards_stage = next(stage for stage in payload["stages"] if stage["stage"] == JOB_STAGE_STUDY_CARDS)
            self.assertEqual(study_cards_stage["progress_current"], 2)
            self.assertEqual(study_cards_stage["progress_total"], 5)
            self.assertEqual(payload["logs"][-1]["metadata"], {"level": "info"})
        finally:
            db.close()

    def test_auto_job_queue_and_plain_cancel_publish_workflow_events(self):
        db = self.SessionLocal()
        try:
            _, _, maintainer, _ = self._seed_private_course(db)
            client = self._client(db, maintainer)

            queued_events = []
            with (
                patch("app.generation_events.generation_event_bus.publish", queued_events.append),
                patch("app.main.enqueue_auto_job", return_value=True),
            ):
                response = client.post(
                    "/note-groups/auto",
                    json={
                        "module_id": "module-1",
                        "raw_text": "A new source body for generation.",
                        "source": "new-source",
                    },
                )

            self.assertEqual(response.status_code, 200)
            self.assertEqual([event.event for event in queued_events], ["workflow_queued"])

            cancelled_events = []
            with patch("app.generation_events.generation_event_bus.publish", cancelled_events.append):
                cancel_response = client.post("/jobs/job-1/cancel")

            self.assertEqual(cancel_response.status_code, 200)
            self.assertEqual(cancel_response.json()["status"], "cancelled")
            self.assertEqual([event.event for event in cancelled_events], ["workflow_cancelled"])
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
