import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app.models import UsernameReservation
from app.username import normalize_username, validate_username


def test_normalize_username_trims_and_lowercases():
    assert normalize_username("  JacquesC_42  ") == "jacquesc_42"


@pytest.mark.parametrize("value", ["ab", "a" * 31, "has-dash", "has space", "has.dot", ""])
def test_validate_username_rejects_invalid_values(value):
    with pytest.raises(HTTPException) as exc_info:
        validate_username(value)
    assert exc_info.value.status_code == 400


def test_validate_username_preserves_display_case_and_returns_normalized_value():
    display, normalized = validate_username("JacquesC_42")
    assert display == "JacquesC_42"
    assert normalized == "jacquesc_42"


def test_username_reservation_rejects_non_normalized_username():
    with pytest.raises(HTTPException) as exc_info:
        UsernameReservation(username_normalized="Reader_One")

    assert exc_info.value.status_code == 400


def test_username_reservation_enforces_unique_normalized_username():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        db.add(UsernameReservation(username_normalized="reader_one"))
        db.commit()

        db.add(UsernameReservation(username_normalized="reader_one"))
        with pytest.raises(IntegrityError):
            db.commit()
    finally:
        db.close()
