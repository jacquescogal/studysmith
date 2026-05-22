import os
import unittest
from importlib import reload
from unittest.mock import patch

import app.config as config


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


if __name__ == "__main__":
    unittest.main()
