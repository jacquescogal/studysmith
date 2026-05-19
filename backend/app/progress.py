import json
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from statistics import median
from typing import Optional

from sqlalchemy.orm import Session

from app.models import QuestionCard, QuestionCardReviewEvent, StudyCard, study_card_topic_chips


def mastery_score(card: QuestionCard) -> Optional[float]:
    difficulty = card.difficulty
    if difficulty is None or difficulty <= 0:
        return None
    return max(0.0, min(10.0, 10.0 - float(difficulty)))


def mastery_tier(score: Optional[float]) -> str:
    if score is None:
        return "unknown"
    if score <= 3:
        return "low"
    if score <= 6:
        return "medium"
    return "high"


def progress_start(range_value: str, now: datetime) -> Optional[datetime]:
    if range_value == "7d":
        return now - timedelta(days=7)
    if range_value == "30d":
        return now - timedelta(days=30)
    if range_value == "90d":
        return now - timedelta(days=90)
    if range_value == "all":
        return None
    return now - timedelta(days=30)


def question_refs(card: QuestionCard) -> list[str]:
    try:
        refs = json.loads(card.study_card_refs_json or "[]")
    except json.JSONDecodeError:
        return []
    return [ref for ref in refs if isinstance(ref, str)]


def allowed_study_ids(
    db: Session,
    note_group_id: str,
    chip_ids: list[str],
) -> Optional[set[str]]:
    if not chip_ids:
        return None
    rows = (
        db.query(StudyCard.id)
        .join(study_card_topic_chips, StudyCard.id == study_card_topic_chips.c.study_card_id)
        .filter(
            StudyCard.note_group_id == note_group_id,
            study_card_topic_chips.c.chip_id.in_(chip_ids),
        )
        .distinct()
        .all()
    )
    return {row[0] for row in rows}


def filter_cards_by_studies(
    cards: list[QuestionCard],
    allowed_ids: Optional[set[str]],
) -> list[QuestionCard]:
    if allowed_ids is None:
        return cards
    return [card for card in cards if any(ref in allowed_ids for ref in question_refs(card))]


def build_note_group_progress(
    db: Session,
    note_group_id: str,
    range_value: str = "30d",
    chip_ids: Optional[list[str]] = None,
    now: Optional[datetime] = None,
) -> dict:
    current = now or datetime.now(timezone.utc)
    start = progress_start(range_value, current)
    allowed_ids = allowed_study_ids(db, note_group_id, chip_ids or [])
    cards = db.query(QuestionCard).filter(QuestionCard.note_group_id == note_group_id).all()
    cards = filter_cards_by_studies(cards, allowed_ids)
    card_ids = {card.id for card in cards}
    query = db.query(QuestionCardReviewEvent).filter(
        QuestionCardReviewEvent.note_group_id == note_group_id
    )
    if start is not None:
        query = query.filter(QuestionCardReviewEvent.reviewed_at >= start)
    events = [event for event in query.all() if event.question_card_id in card_ids]

    total_reviews = len(events)
    correct_count = sum(1 for event in events if event.correct)
    response_times = [event.response_time_ms for event in events]
    reviewed_card_ids = {event.question_card_id for event in events}
    mastery_scores = [score for score in (mastery_score(card) for card in cards) if score is not None]
    high_mastery_count = sum(1 for score in mastery_scores if mastery_tier(score) == "high")
    distribution = Counter(mastery_tier(mastery_score(card)) for card in cards)

    buckets = defaultdict(list)
    for event in events:
        reviewed_at = event.reviewed_at or current
        buckets[reviewed_at.date().isoformat()].append(event)

    average_mastery = round(sum(mastery_scores) / len(mastery_scores), 1) if mastery_scores else None
    average_difficulty = (
        round(sum(card.difficulty or 0 for card in cards) / len(cards), 2) if cards else None
    )
    trend = []
    for key in sorted(buckets):
        bucket_events = buckets[key]
        bucket_correct = sum(1 for event in bucket_events if event.correct)
        review_count = len(bucket_events)
        trend.append(
            {
                "date": key,
                "success_rate": round((bucket_correct / review_count) * 100, 1)
                if review_count
                else 0.0,
                "review_count": review_count,
                "correct": bucket_correct,
                "incorrect": review_count - bucket_correct,
                "average_mastery": average_mastery,
                "average_difficulty": average_difficulty,
            }
        )

    reviews_by_card = defaultdict(list)
    for event in events:
        reviews_by_card[event.question_card_id].append(event)

    needs_attention = []
    for card in cards:
        card_events = reviews_by_card[card.id]
        card_reviews = len(card_events)
        card_correct = sum(1 for event in card_events if event.correct)
        card_success = round((card_correct / card_reviews) * 100, 1) if card_reviews else None
        card_mastery = mastery_score(card)
        reason = ""
        if card.stale:
            reason = "stale"
        elif card.lapses and card.lapses >= 2:
            reason = "repeated lapses"
        elif card_success is not None and card_success < 60:
            reason = "low success"
        elif card_mastery is not None and mastery_tier(card_mastery) == "low":
            reason = "low Mastery"
        if reason:
            needs_attention.append(
                {
                    "id": card.id,
                    "prompt": card.prompt,
                    "mastery": round(card_mastery, 1) if card_mastery is not None else None,
                    "success_rate": card_success,
                    "reviews": card_reviews,
                    "lapses": card.lapses or 0,
                    "difficulty": card.difficulty,
                    "stale": bool(card.stale),
                    "reason": reason,
                }
            )

    return {
        "summary": {
            "success_rate": round((correct_count / total_reviews) * 100, 1)
            if total_reviews
            else 0.0,
            "mastery_percentage": round((high_mastery_count / len(cards)) * 100, 1)
            if cards
            else 0.0,
            "reviewed_card_count": len(reviewed_card_ids),
            "question_count": len(cards),
            "total_reviews": total_reviews,
            "median_response_time_ms": int(median(response_times)) if response_times else None,
        },
        "trend": trend,
        "activity": trend,
        "mastery_distribution": {
            "low": distribution["low"],
            "medium": distribution["medium"],
            "high": distribution["high"],
            "unknown": distribution["unknown"],
        },
        "needs_attention": needs_attention[:5],
    }
