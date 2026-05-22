import os
import unittest
from importlib import reload
from unittest.mock import patch

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


if __name__ == "__main__":
    unittest.main()
