from datetime import datetime, timezone
from typing import Optional

from fsrs import Card, Rating, Scheduler, State

from app.models import QuestionCard

scheduler = Scheduler()


def _normalize_datetime(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _coerce_state(value) -> State:
    if isinstance(value, State):
        return value
    if value in (None, 0):
        return State.Learning
    return State(int(value))


def card_from_question(card: QuestionCard) -> Card:
    return Card(
        due=_normalize_datetime(card.due_at) or datetime.now(timezone.utc),
        stability=card.stability or None,
        difficulty=card.difficulty or None,
        state=_coerce_state(card.state),
        step=card.step if card.step is not None else 0,
        last_review=_normalize_datetime(card.last_review_at),
    )


def apply_card_to_question(card: Card, question: QuestionCard) -> None:
    question.due_at = card.due
    question.stability = float(card.stability) if card.stability is not None else 0.0
    question.difficulty = float(card.difficulty) if card.difficulty is not None else 0.0
    question.state = int(card.state.value)
    question.step = card.step
    question.last_review_at = card.last_review


def initialize_question_card(question: QuestionCard, now: Optional[datetime] = None) -> None:
    current = now or datetime.now(timezone.utc)
    card = Card(due=current, state=State.Learning, step=0)
    apply_card_to_question(card, question)


def review_question_card(
    question: QuestionCard,
    rating: Rating,
    now: datetime,
    review_duration_ms: Optional[int] = None,
) -> None:
    card = card_from_question(question)
    next_card, _ = scheduler.review_card(
        card, rating, review_datetime=now, review_duration=review_duration_ms
    )
    apply_card_to_question(next_card, question)
