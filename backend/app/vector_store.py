from dataclasses import dataclass
from math import sqrt
from typing import Iterable, Optional, Sequence

from sqlalchemy.orm import Session

from app.models import StudyCard, StudyCardEmbedding


@dataclass(frozen=True)
class EmbeddingSearchResult:
    study_card_id: str
    content: str
    distance: float


def _embedding_values(embedding) -> list[float]:
    if hasattr(embedding, "tolist"):
        embedding = embedding.tolist()
    return [float(value) for value in embedding]


def _cosine_distance(left, right) -> float:
    left_values = _embedding_values(left)
    right_values = _embedding_values(right)
    dot = sum(a * b for a, b in zip(left_values, right_values))
    left_norm = sqrt(sum(value * value for value in left_values))
    right_norm = sqrt(sum(value * value for value in right_values))
    if not left_norm or not right_norm:
        return 1.0
    return 1.0 - (dot / (left_norm * right_norm))


def _is_postgres(db: Session) -> bool:
    bind = db.get_bind()
    return bind is not None and bind.url.get_backend_name() == "postgresql"


def upsert_study_card_embedding(
    db: Session,
    card: StudyCard,
    module_id: str,
    embedding: Sequence[float],
) -> StudyCardEmbedding:
    row = db.get(StudyCardEmbedding, card.id)
    if row is None:
        row = StudyCardEmbedding(study_card_id=card.id)
        db.add(row)
    row.module_id = module_id
    row.note_group_id = card.note_group_id
    row.content = card.content
    row.embedding = list(embedding)
    return row


def upsert_study_card_embeddings(
    db: Session,
    records: Iterable[tuple[StudyCard, str, Sequence[float]]],
) -> list[StudyCardEmbedding]:
    rows = []
    for card, module_id, embedding in records:
        rows.append(upsert_study_card_embedding(db, card, module_id, embedding))
    return rows


def delete_study_card_embeddings(db: Session, study_card_ids: Sequence[str]) -> None:
    ids = [study_card_id for study_card_id in study_card_ids if study_card_id]
    if not ids:
        return
    db.query(StudyCardEmbedding).filter(
        StudyCardEmbedding.study_card_id.in_(ids)
    ).delete(synchronize_session=False)


def query_study_card_embeddings(
    db: Session,
    query_embedding: Sequence[float],
    module_id: str,
    note_group_id: Optional[str] = None,
    limit: int = 20,
) -> list[EmbeddingSearchResult]:
    limit = max(1, min(int(limit or 20), 100))
    base_query = db.query(StudyCardEmbedding).filter(
        StudyCardEmbedding.module_id == module_id
    )
    if note_group_id:
        base_query = base_query.filter(StudyCardEmbedding.note_group_id == note_group_id)

    if _is_postgres(db):
        distance = StudyCardEmbedding.embedding.cosine_distance(list(query_embedding)).label("distance")
        postgres_query = db.query(StudyCardEmbedding, distance).filter(
            StudyCardEmbedding.module_id == module_id
        )
        if note_group_id:
            postgres_query = postgres_query.filter(StudyCardEmbedding.note_group_id == note_group_id)
        rows = postgres_query.order_by(distance).limit(limit).all()
        return [
            EmbeddingSearchResult(
                study_card_id=row.study_card_id,
                content=row.content,
                distance=float(distance_value or 0.0),
            )
            for row, distance_value in rows
        ]

    rows = base_query.all()
    ranked = sorted(
        (
            EmbeddingSearchResult(
                study_card_id=row.study_card_id,
                content=row.content,
                distance=_cosine_distance(row.embedding, query_embedding),
            )
            for row in rows
        ),
        key=lambda result: result.distance,
    )
    return ranked[:limit]
