PASSWORD_POLICY_MESSAGE = (
    "Password must be at least 10 characters and include at least 3 of: "
    "uppercase letter, lowercase letter, number, symbol"
)


def password_policy_status(password: str) -> dict[str, bool]:
    value = str(password or "")
    return {
        "length": len(value) >= 10,
        "uppercase": any(character.isupper() for character in value),
        "lowercase": any(character.islower() for character in value),
        "number": any(character.isdigit() for character in value),
        "symbol": any(not character.isalnum() and not character.isspace() for character in value),
    }


def password_meets_policy(password: str) -> bool:
    status = password_policy_status(password)
    category_count = sum(
        1
        for key in ("uppercase", "lowercase", "number", "symbol")
        if status[key]
    )
    return status["length"] and category_count >= 3
