import re

from fastapi import HTTPException

USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_]{3,30}$")


def normalize_username(value: str) -> str:
    return str(value or "").strip().lower()


def validate_username(value: str) -> tuple[str, str]:
    display = str(value or "").strip()
    if not USERNAME_PATTERN.fullmatch(display):
        raise HTTPException(
            status_code=400,
            detail="Username must be 3-30 characters and use only letters, numbers, and underscores",
        )
    return display, display.lower()
