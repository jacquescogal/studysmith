from unittest.mock import patch

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app
from app.auth import require_user
from app.models import APP_ROLE_READER, PendingRegistration, User, UsernameReservation
from app.supabase_auth_client import SupabaseAuthClient, get_supabase_auth_client


class FakeSupabaseAuthClient:
    def __init__(self):
        self.signups = []
        self.logins = []
        self.password_resets = []
        self.fail_signup = False
        self.fail_password_reset = False

    def sign_up(self, *, email, password):
        self.signups.append({"email": email, "password": password})
        if self.fail_signup:
            raise ValueError("Supabase rejected signup")
        return {"user": {"id": "supabase-new", "email": email}, "session": None}

    def sign_in_with_password(self, *, email, password):
        self.logins.append({"email": email, "password": password})
        if password != "correct-password":
            raise ValueError("Invalid login credentials")
        return {
            "access_token": "access-token",
            "refresh_token": "refresh-token",
            "expires_in": 3600,
            "token_type": "bearer",
            "user": {"id": "supabase-user", "email": email},
        }

    def reset_password_for_email(self, *, email, redirect_to):
        self.password_resets.append({"email": email, "redirect_to": redirect_to})
        if self.fail_password_reset:
            raise ValueError("Supabase rejected recovery")


def build_client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    fake_supabase = FakeSupabaseAuthClient()

    def override_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_supabase_auth_client] = lambda: fake_supabase
    return TestClient(app), SessionLocal, fake_supabase


def teardown_function():
    app.dependency_overrides.clear()


def test_supabase_auth_client_wraps_request_errors_as_value_error():
    client = SupabaseAuthClient(
        supabase_url="https://example.supabase.co",
        secret_key="secret",
    )

    with patch(
        "app.supabase_auth_client.httpx.post",
        side_effect=httpx.RequestError("network down"),
    ):
        with pytest.raises(ValueError, match="Supabase authentication request failed"):
            client.sign_up(email="new@example.com", password="Secretpass1")


def test_supabase_auth_client_sends_recovery_redirect_as_query_parameter():
    client = SupabaseAuthClient(
        supabase_url="https://example.supabase.co",
        secret_key="secret",
    )

    with patch("app.supabase_auth_client.httpx.post") as post:
        post.return_value = httpx.Response(200, json={})

        client.reset_password_for_email(
            email="reader@example.com",
            redirect_to="http://localhost:5173/account/update-password",
        )

    request_url = post.call_args.args[0]
    assert request_url == (
        "https://example.supabase.co/auth/v1/recover"
        "?redirect_to=http%3A%2F%2Flocalhost%3A5173%2Faccount%2Fupdate-password"
    )
    assert post.call_args.kwargs["json"] == {"email": "reader@example.com"}


def test_register_creates_pending_registration_with_normalized_email_and_username():
    client, SessionLocal, fake_supabase = build_client()

    response = client.post(
        "/auth/register",
        json={
            "email": "  New.User@Example.COM  ",
            "username": "Reader_One",
            "password": "Secretpass1",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"message": "Check your email to confirm your account."}
    assert fake_supabase.signups == [
        {"email": "new.user@example.com", "password": "Secretpass1"}
    ]

    db = SessionLocal()
    try:
        assert db.query(User).filter(User.email == "new.user@example.com").one_or_none() is None
        pending = (
            db.query(PendingRegistration)
            .filter(PendingRegistration.email == "new.user@example.com")
            .one()
        )
        assert pending.username == "Reader_One"
        assert pending.username_normalized == "reader_one"
        reservation = (
            db.query(UsernameReservation)
            .filter(UsernameReservation.username_normalized == "reader_one")
            .one()
        )
        assert reservation.username_normalized == "reader_one"
    finally:
        db.close()


def test_register_rejects_weak_password_before_supabase_signup():
    client, _, fake_supabase = build_client()

    response = client.post(
        "/auth/register",
        json={
            "email": "new.user@example.com",
            "username": "Reader_One",
            "password": "short1!",
        },
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "Password must be at least 10 characters and include at least 3 of: uppercase letter, lowercase letter, number, symbol"
    }
    assert fake_supabase.signups == []


def test_register_existing_email_returns_generic_success_even_when_username_is_taken():
    client, SessionLocal, fake_supabase = build_client()
    db = SessionLocal()
    try:
        db.add(
            User(
                supabase_user_id="existing-sub",
                email="existing@example.com",
                username="Existing_One",
                username_normalized="existing_one",
                app_role=APP_ROLE_READER,
            )
        )
        db.commit()
    finally:
        db.close()

    response = client.post(
        "/auth/register",
        json={
            "email": " Existing@Example.COM ",
            "username": "Existing_One",
            "password": "Secretpass1",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"message": "Check your email to confirm your account."}
    assert fake_supabase.signups == []


def test_register_rejects_duplicate_user_normalized_username():
    client, SessionLocal, fake_supabase = build_client()
    db = SessionLocal()
    try:
        db.add(
            UsernameReservation(username_normalized="reader_one")
        )
        db.commit()
    finally:
        db.close()

    response = client.post(
        "/auth/register",
        json={
            "email": "new@example.com",
            "username": "reader_ONE",
            "password": "Secretpass1",
        },
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Username is already taken"}
    assert fake_supabase.signups == []


def test_register_rejects_legacy_duplicate_user_username_without_reservation():
    client, SessionLocal, fake_supabase = build_client()
    db = SessionLocal()
    try:
        db.add(
            User(
                supabase_user_id="existing-sub",
                email="existing@example.com",
                username="Reader_One",
                username_normalized="reader_one",
                app_role=APP_ROLE_READER,
            )
        )
        db.commit()
    finally:
        db.close()

    response = client.post(
        "/auth/register",
        json={
            "email": "new@example.com",
            "username": "reader_ONE",
            "password": "Secretpass1",
        },
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Username is already taken"}
    assert fake_supabase.signups == []


def test_register_rejects_duplicate_pending_normalized_username():
    client, SessionLocal, fake_supabase = build_client()
    db = SessionLocal()
    try:
        db.add(
            UsernameReservation(username_normalized="reader_one")
        )
        db.commit()
    finally:
        db.close()

    response = client.post(
        "/auth/register",
        json={
            "email": "new@example.com",
            "username": "reader_ONE",
            "password": "Secretpass1",
        },
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Username is already taken"}
    assert fake_supabase.signups == []


def test_register_rejects_legacy_duplicate_pending_username_without_reservation():
    client, SessionLocal, fake_supabase = build_client()
    db = SessionLocal()
    try:
        db.add(
            PendingRegistration(
                email="pending@example.com",
                username="Reader_One",
                username_normalized="reader_one",
            )
        )
        db.commit()
    finally:
        db.close()

    response = client.post(
        "/auth/register",
        json={
            "email": "new@example.com",
            "username": "reader_ONE",
            "password": "Secretpass1",
        },
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Username is already taken"}
    assert fake_supabase.signups == []


def test_register_signup_failure_returns_controlled_error():
    client, SessionLocal, fake_supabase = build_client()
    fake_supabase.fail_signup = True

    response = client.post(
        "/auth/register",
        json={
            "email": "new@example.com",
            "username": "Reader_One",
            "password": "Secretpass1",
        },
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Registration failed"}
    db = SessionLocal()
    try:
        assert (
            db.query(PendingRegistration)
            .filter(PendingRegistration.email == "new@example.com")
            .one_or_none()
            is None
        )
        assert (
            db.query(UsernameReservation)
            .filter(UsernameReservation.username_normalized == "reader_one")
            .one_or_none()
            is None
        )
    finally:
        db.close()


def test_register_signup_failure_logs_supabase_error(caplog):
    client, _, fake_supabase = build_client()
    fake_supabase.fail_signup = True

    with caplog.at_level("ERROR", logger="app.main"):
        response = client.post(
            "/auth/register",
            json={
                "email": "new@example.com",
                "username": "Reader_One",
                "password": "Secretpass1",
            },
        )

    assert response.status_code == 400
    assert "Supabase signup failed" in caplog.text
    assert "new@example.com" in caplog.text
    assert "Supabase rejected signup" in caplog.text


def test_login_with_email_creates_confirmed_user_from_pending_registration():
    client, SessionLocal, fake_supabase = build_client()
    db = SessionLocal()
    try:
        db.add_all(
            [
                PendingRegistration(
                    email="reader@example.com",
                    username="Reader_One",
                    username_normalized="reader_one",
                ),
                UsernameReservation(username_normalized="reader_one"),
            ]
        )
        db.commit()
    finally:
        db.close()

    response = client.post(
        "/auth/login",
        json={"identifier": " Reader@Example.COM ", "password": "correct-password"},
    )

    assert response.status_code == 200
    assert fake_supabase.logins == [
        {"email": "reader@example.com", "password": "correct-password"}
    ]
    body = response.json()
    assert body["user"]["email"] == "reader@example.com"
    assert body["user"]["username"] == "Reader_One"

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "reader@example.com").one()
        assert user.supabase_user_id == "supabase-user"
        assert user.username == "Reader_One"
        assert user.username_normalized == "reader_one"
        assert (
            db.query(PendingRegistration)
            .filter(PendingRegistration.email == "reader@example.com")
            .one_or_none()
            is None
        )
        assert (
            db.query(UsernameReservation)
            .filter(UsernameReservation.username_normalized == "reader_one")
            .one_or_none()
            is not None
        )
    finally:
        db.close()


def test_login_with_email_creates_confirmed_user_from_pending_registration_without_reservation():
    client, SessionLocal, fake_supabase = build_client()
    db = SessionLocal()
    try:
        db.add(
            PendingRegistration(
                email="reader@example.com",
                username="Reader_One",
                username_normalized="reader_one",
            ),
        )
        db.commit()
    finally:
        db.close()

    response = client.post(
        "/auth/login",
        json={"identifier": " Reader@Example.COM ", "password": "correct-password"},
    )

    assert response.status_code == 200
    assert fake_supabase.logins == [
        {"email": "reader@example.com", "password": "correct-password"}
    ]
    body = response.json()
    assert body["user"]["email"] == "reader@example.com"
    assert body["user"]["username"] == "Reader_One"

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "reader@example.com").one()
        assert user.supabase_user_id == "supabase-user"
        assert user.username == "Reader_One"
        assert user.username_normalized == "reader_one"
        assert db.query(PendingRegistration).filter(PendingRegistration.email == "reader@example.com").one_or_none() is None
        assert (
            db.query(UsernameReservation)
            .filter(UsernameReservation.username_normalized == "reader_one")
            .one_or_none()
            is not None
        )
    finally:
        db.close()


def test_login_with_pending_username_creates_confirmed_user_from_pending_registration():
    client, SessionLocal, fake_supabase = build_client()
    db = SessionLocal()
    try:
        db.add_all(
            [
                PendingRegistration(
                    email="reader@example.com",
                    username="Reader_One",
                    username_normalized="reader_one",
                ),
                UsernameReservation(username_normalized="reader_one"),
            ]
        )
        db.commit()
    finally:
        db.close()

    response = client.post(
        "/auth/login",
        json={"identifier": "reader_ONE", "password": "correct-password"},
    )

    assert response.status_code == 200
    assert fake_supabase.logins == [
        {"email": "reader@example.com", "password": "correct-password"}
    ]
    body = response.json()
    assert body["user"]["email"] == "reader@example.com"
    assert body["user"]["username"] == "Reader_One"

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "reader@example.com").one()
        assert user.supabase_user_id == "supabase-user"
        assert user.username == "Reader_One"
        assert user.username_normalized == "reader_one"
        assert db.query(PendingRegistration).filter(PendingRegistration.email == "reader@example.com").one_or_none() is None
    finally:
        db.close()


def test_login_with_username_resolves_email_and_returns_session_with_display_username():
    client, SessionLocal, fake_supabase = build_client()
    db = SessionLocal()
    try:
        db.add(
            User(
                supabase_user_id="supabase-user",
                email="reader@example.com",
                username="Reader_One",
                username_normalized="reader_one",
                app_role=APP_ROLE_READER,
            )
        )
        db.commit()
    finally:
        db.close()

    response = client.post(
        "/auth/login",
        json={"identifier": "reader_ONE", "password": "correct-password"},
    )

    assert response.status_code == 200
    assert fake_supabase.logins == [
        {"email": "reader@example.com", "password": "correct-password"}
    ]
    body = response.json()
    assert body["session"] == {
        "access_token": "access-token",
        "refresh_token": "refresh-token",
        "expires_in": 3600,
        "token_type": "bearer",
    }
    assert body["user"]["email"] == "reader@example.com"
    assert body["user"]["username"] == "Reader_One"


def test_login_failure_uses_generic_error():
    client, SessionLocal, fake_supabase = build_client()
    db = SessionLocal()
    try:
        db.add(
            User(
                supabase_user_id="supabase-user",
                email="reader@example.com",
                username="Reader_One",
                username_normalized="reader_one",
                app_role=APP_ROLE_READER,
            )
        )
        db.commit()
    finally:
        db.close()

    response = client.post(
        "/auth/login",
        json={"identifier": "Reader_One", "password": "wrong-password"},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid username/email or password"}
    assert fake_supabase.logins == [
        {"email": "reader@example.com", "password": "wrong-password"}
    ]


def test_forgot_password_returns_generic_success_and_records_reset_request():
    client, _, fake_supabase = build_client()

    response = client.post(
        "/auth/forgot-password",
        json={"email": "  Reader@Example.COM  "},
    )

    assert response.status_code == 200
    assert response.json() == {
        "message": "If an account exists for that email, a reset link has been sent."
    }
    assert fake_supabase.password_resets == [
        {
            "email": "reader@example.com",
            "redirect_to": "http://localhost:5173/account/update-password",
        }
    ]


def test_forgot_password_failure_logs_supabase_error_but_returns_generic_success(caplog):
    client, _, fake_supabase = build_client()
    fake_supabase.fail_password_reset = True

    with caplog.at_level("ERROR", logger="app.main"):
        response = client.post(
            "/auth/forgot-password",
            json={"email": "reader@example.com"},
        )

    assert response.status_code == 200
    assert response.json() == {
        "message": "If an account exists for that email, a reset link has been sent."
    }
    assert "Supabase password reset failed" in caplog.text
    assert "reader@example.com" in caplog.text
    assert "Supabase rejected recovery" in caplog.text


def test_update_username_rejects_duplicate_normalized_username():
    client, SessionLocal, _ = build_client()
    db = SessionLocal()
    try:
        current_user = User(
            supabase_user_id="current-sub",
            email="current@example.com",
            username="Current_One",
            username_normalized="current_one",
            app_role=APP_ROLE_READER,
        )
        db.add_all([current_user, UsernameReservation(username_normalized="reader_one")])
        db.commit()
        db.refresh(current_user)

        app.dependency_overrides[require_user] = lambda: current_user

        response = client.post(
            "/auth/update-username",
            json={"username": "reader_ONE"},
        )

        assert response.status_code == 409
        assert response.json() == {"detail": "Username is already taken"}
    finally:
        db.close()


def test_update_username_rejects_duplicate_reserved_normalized_username():
    client, SessionLocal, _ = build_client()
    db = SessionLocal()
    try:
        current_user = User(
            supabase_user_id="current-sub",
            email="current@example.com",
            username="Current_One",
            username_normalized="current_one",
            app_role=APP_ROLE_READER,
        )
        db.add_all(
            [
                current_user,
                UsernameReservation(username_normalized="reader_one"),
            ]
        )
        db.commit()
        db.refresh(current_user)

        app.dependency_overrides[require_user] = lambda: current_user

        response = client.post(
            "/auth/update-username",
            json={"username": "reader_ONE"},
        )

        assert response.status_code == 409
        assert response.json() == {"detail": "Username is already taken"}
    finally:
        db.close()


def test_update_username_sets_display_and_normalized_username_for_current_user():
    client, SessionLocal, _ = build_client()
    db = SessionLocal()
    try:
        current_user = User(
            supabase_user_id="current-sub",
            email="current@example.com",
            username="Current_One",
            username_normalized="current_one",
            app_role=APP_ROLE_READER,
        )
        db.add(current_user)
        db.add(UsernameReservation(username_normalized="current_one"))
        db.commit()
        db.refresh(current_user)

        app.dependency_overrides[require_user] = lambda: current_user

        response = client.post(
            "/auth/update-username",
            json={"username": "New_Display_42"},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["id"] == current_user.id
        assert body["email"] == "current@example.com"
        assert body["username"] == "New_Display_42"

        db.refresh(current_user)
        assert current_user.username == "New_Display_42"
        assert current_user.username_normalized == "new_display_42"
        assert (
            db.query(UsernameReservation)
            .filter(UsernameReservation.username_normalized == "new_display_42")
            .one_or_none()
            is not None
        )
        assert (
            db.query(UsernameReservation)
            .filter(UsernameReservation.username_normalized == "current_one")
            .one_or_none()
            is None
        )
    finally:
        db.close()


def test_update_username_allows_same_normalized_username_display_case_change():
    client, SessionLocal, _ = build_client()
    db = SessionLocal()
    try:
        current_user = User(
            supabase_user_id="current-sub",
            email="current@example.com",
            username="Current_One",
            username_normalized="current_one",
            app_role=APP_ROLE_READER,
        )
        db.add_all(
            [
                current_user,
                UsernameReservation(username_normalized="current_one"),
            ]
        )
        db.commit()
        db.refresh(current_user)

        app.dependency_overrides[require_user] = lambda: current_user

        response = client.post(
            "/auth/update-username",
            json={"username": "current_ONE"},
        )

        assert response.status_code == 200
        assert response.json()["username"] == "current_ONE"

        db.refresh(current_user)
        assert current_user.username == "current_ONE"
        assert current_user.username_normalized == "current_one"
        assert db.query(UsernameReservation).count() == 1
        assert (
            db.query(UsernameReservation)
            .filter(UsernameReservation.username_normalized == "current_one")
            .one_or_none()
            is not None
        )
    finally:
        db.close()


def test_update_username_repairs_missing_reservation_for_same_normalized_username():
    client, SessionLocal, _ = build_client()
    db = SessionLocal()
    try:
        current_user = User(
            supabase_user_id="current-sub",
            email="current@example.com",
            username="Current_One",
            username_normalized="current_one",
            app_role=APP_ROLE_READER,
        )
        db.add(current_user)
        db.commit()
        db.refresh(current_user)

        app.dependency_overrides[require_user] = lambda: current_user

        response = client.post(
            "/auth/update-username",
            json={"username": "current_ONE"},
        )

        assert response.status_code == 200
        assert response.json()["username"] == "current_ONE"

        db.refresh(current_user)
        assert current_user.username == "current_ONE"
        assert current_user.username_normalized == "current_one"
        assert (
            db.query(UsernameReservation)
            .filter(UsernameReservation.username_normalized == "current_one")
            .one_or_none()
            is not None
        )
    finally:
        db.close()
