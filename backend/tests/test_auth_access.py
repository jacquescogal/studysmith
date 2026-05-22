import os
import unittest
from importlib import reload
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.config as config
from app.db import Base
from app.models import Subject


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

    def test_user_subject_access_and_visibility_models_persist(self):
        from app.models import SubjectAccess, User

        db = self.SessionLocal()
        try:
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

            stored = db.get(Subject, "subject-1")
            self.assertEqual(stored.owner_user_id, "user-1")
            self.assertEqual(stored.visibility, "public_requested")
            self.assertEqual(stored.access_grants[0].access_level, "owner")
            self.assertEqual(stored.owner.email, "owner@example.com")
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
