from dataclasses import dataclass
from typing import Optional

import jwt
from fastapi import Depends, Header, HTTPException
from jwt import PyJWKClient
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import (
    APP_ROLE_ADMIN,
    APP_ROLE_CREATOR,
    APP_ROLE_READER,
    PendingRegistration,
    User,
    UsernameReservation,
)

SUPABASE_JWT_ALGORITHMS = ["ES256", "RS256"]


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
    try:
        jwks_client = PyJWKClient(settings.supabase_jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        options = {"verify_aud": bool(settings.supabase_jwt_audience)}
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=SUPABASE_JWT_ALGORITHMS,
            audience=settings.supabase_jwt_audience or None,
            issuer=settings.supabase_jwt_issuer or None,
            options=options,
        )
    except (jwt.PyJWTError, jwt.exceptions.PyJWKClientError) as exc:
        raise HTTPException(status_code=401, detail="Invalid authentication token") from exc


def _email_owner(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).one_or_none()


def _email_collision() -> HTTPException:
    return HTTPException(status_code=409, detail="Email is already associated with another user")


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
            existing_email_owner = _email_owner(db, email)
            if existing_email_owner and existing_email_owner.id != user.id:
                raise _email_collision()
            user.email = email
            try:
                db.commit()
                db.refresh(user)
            except IntegrityError as exc:
                db.rollback()
                existing_email_owner = _email_owner(db, email)
                if existing_email_owner and existing_email_owner.supabase_user_id != supabase_user_id:
                    raise _email_collision() from exc
                raise HTTPException(status_code=409, detail="User profile could not be updated") from exc
        return user

    existing_email_owner = _email_owner(db, email)
    if existing_email_owner:
        raise _email_collision()

    pending_registration = (
        db.query(PendingRegistration)
        .filter(PendingRegistration.email == email)
        .one_or_none()
    )
    role = APP_ROLE_ADMIN if email in (admin_emails or settings.admin_emails) else APP_ROLE_READER
    user = User(
        supabase_user_id=supabase_user_id,
        email=email,
        username=pending_registration.username if pending_registration else None,
        username_normalized=(
            pending_registration.username_normalized if pending_registration else None
        ),
        app_role=role,
    )
    db.add(user)
    if pending_registration:
        if pending_registration.username_normalized:
            reservation = (
                db.query(UsernameReservation)
                .filter(
                    UsernameReservation.username_normalized
                    == pending_registration.username_normalized
                )
                .one_or_none()
            )
            if reservation is None:
                db.add(
                    UsernameReservation(
                        username_normalized=pending_registration.username_normalized
                    )
                )
        db.delete(pending_registration)
    try:
        db.commit()
        db.refresh(user)
        return user
    except IntegrityError as exc:
        db.rollback()
        user = db.query(User).filter(User.supabase_user_id == supabase_user_id).one_or_none()
        if user:
            return user
        existing_email_owner = _email_owner(db, email)
        if existing_email_owner:
            raise _email_collision() from exc
        raise HTTPException(status_code=409, detail="User profile could not be created") from exc


def get_auth_context(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> AuthContext:
    token = _bearer_token(authorization)
    if not token:
        return AuthContext(user=None)
    try:
        claims = validate_supabase_jwt(token)
        user = get_or_create_user_from_claims(db, claims)
    except HTTPException as exc:
        if exc.status_code == 401:
            return AuthContext(user=None)
        raise
    return AuthContext(user=user)


def require_user(auth: AuthContext = Depends(get_auth_context)) -> User:
    if not auth.user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return auth.user


def optional_user(auth: AuthContext = Depends(get_auth_context)) -> Optional[User]:
    return auth.user


def require_admin(user: User = Depends(require_user)) -> User:
    if user.app_role != APP_ROLE_ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def require_creator(user: User = Depends(require_user)) -> User:
    if user.app_role not in {APP_ROLE_CREATOR, APP_ROLE_ADMIN}:
        raise HTTPException(status_code=403, detail="Creator access required")
    return user
