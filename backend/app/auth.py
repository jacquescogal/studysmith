from dataclasses import dataclass
from typing import Optional

import jwt
from fastapi import Depends, Header, HTTPException
from jwt import PyJWKClient
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import APP_ROLE_ADMIN, APP_ROLE_READER, User


@dataclass(frozen=True)
class AuthContext:
    user: Optional[User]

    @property
    def is_authenticated(self) -> bool:
        return self.user is not None


def _bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    return token.strip()


def validate_supabase_jwt(token: str) -> dict:
    if not settings.supabase_jwks_url:
        raise HTTPException(status_code=500, detail="Supabase JWT validation is not configured")
    jwks_client = PyJWKClient(settings.supabase_jwks_url)
    signing_key = jwks_client.get_signing_key_from_jwt(token)
    options = {"verify_aud": bool(settings.supabase_jwt_audience)}
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        audience=settings.supabase_jwt_audience or None,
        issuer=settings.supabase_jwt_issuer or None,
        options=options,
    )


def get_or_create_user_from_claims(
    db: Session,
    claims: dict,
    admin_emails: set[str] | None = None,
) -> User:
    supabase_user_id = str(claims.get("sub") or "").strip()
    email = str(claims.get("email") or "").strip().lower()
    if not supabase_user_id or not email:
        raise HTTPException(status_code=401, detail="Invalid authentication token")

    user = db.query(User).filter(User.supabase_user_id == supabase_user_id).one_or_none()
    if user:
        if user.email != email:
            user.email = email
        return user

    role = APP_ROLE_ADMIN if email in (admin_emails or settings.admin_emails) else APP_ROLE_READER
    user = User(supabase_user_id=supabase_user_id, email=email, app_role=role)
    db.add(user)
    db.flush()
    return user


def get_auth_context(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> AuthContext:
    token = _bearer_token(authorization)
    if not token:
        return AuthContext(user=None)
    claims = validate_supabase_jwt(token)
    user = get_or_create_user_from_claims(db, claims)
    return AuthContext(user=user)


def require_user(auth: AuthContext = Depends(get_auth_context)) -> User:
    if not auth.user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return auth.user


def require_admin(user: User = Depends(require_user)) -> User:
    if user.app_role != APP_ROLE_ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
