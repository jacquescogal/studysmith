from urllib.parse import urlencode

import httpx
from fastapi import HTTPException

from app.config import settings


class SupabaseAuthClient:
    def __init__(self, *, supabase_url: str, secret_key: str):
        self.supabase_url = supabase_url.rstrip("/")
        self.secret_key = secret_key

    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self.secret_key,
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/json",
        }

    def _post(self, path: str, payload: dict) -> dict:
        try:
            response = httpx.post(
                f"{self.supabase_url}{path}",
                headers=self._headers(),
                json=payload,
                timeout=15,
            )
        except httpx.RequestError as exc:
            raise ValueError("Supabase authentication request failed") from exc
        if response.status_code >= 400:
            raise ValueError(response.text)
        return response.json()

    def sign_up(self, *, email: str, password: str) -> dict:
        return self._post("/auth/v1/signup", {"email": email, "password": password})

    def sign_in_with_password(self, *, email: str, password: str) -> dict:
        return self._post(
            "/auth/v1/token?grant_type=password",
            {"email": email, "password": password},
        )

    def reset_password_for_email(self, *, email: str, redirect_to: str) -> dict:
        query = urlencode({"redirect_to": redirect_to})
        return self._post(
            f"/auth/v1/recover?{query}",
            {"email": email},
        )


def get_supabase_auth_client() -> SupabaseAuthClient:
    if not settings.supabase_url or not settings.supabase_secret_key:
        raise HTTPException(status_code=500, detail="Supabase Auth is not configured")
    return SupabaseAuthClient(
        supabase_url=settings.supabase_url,
        secret_key=settings.supabase_secret_key,
    )
