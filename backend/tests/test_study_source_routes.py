from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import AuthContext, get_auth_context
from app.db import Base, get_db
from app.main import app
from app.models import Module, NoteGroup, StudyCard, StudyCardSourceRange, Subject, SubjectAccess, TopicChip, User


@pytest.fixture
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        owner = User(id="owner", supabase_user_id="owner-sub", email="owner@example.com", app_role="creator")
        reader = User(id="reader", supabase_user_id="reader-sub", email="reader@example.com", app_role="reader")
        subject = Subject(id="subject-1", title="Subject", owner_user_id=owner.id)
        reader_access = SubjectAccess(
            id="reader-access",
            subject_id=subject.id,
            user_id=reader.id,
            access_level="reader",
        )
        module = Module(id="module-1", subject_id=subject.id, title="Module")
        parent = TopicChip(id="concept-parent", module_id=module.id, label="Parent", sort_order=1)
        child = TopicChip(
            id="concept-child",
            module_id=module.id,
            parent_topic_id=parent.id,
            label="Child",
            sort_order=2,
        )
        note_a = NoteGroup(
            id="note-a",
            module_id=module.id,
            title="First",
            raw_text="first raw",
            cleaned_text_markdown="first source",
            formatted_sections_json='[{"study_card_id":"card-parent","title":"Parent","content":"parent","anchor":"parent"}]',
            sort_order=None,
            created_at=datetime.utcnow() + timedelta(minutes=2),
        )
        note_b = NoteGroup(
            id="note-b",
            module_id=module.id,
            title="Second",
            raw_text="second raw",
            cleaned_text_markdown="second source",
            sort_order=1,
            created_at=datetime.utcnow() + timedelta(minutes=1),
        )
        note_hidden = NoteGroup(
            id="note-hidden",
            module_id=module.id,
            title="Hidden",
            raw_text="hidden raw",
            cleaned_text_markdown="hidden source",
            generation_status="generating",
            sort_order=0,
            created_at=datetime.utcnow(),
        )
        card_parent = StudyCard(
            id="card-parent",
            note_group_id=note_a.id,
            title="Parent Card",
            content="parent content",
            created_at=datetime.utcnow() + timedelta(minutes=1),
        )
        card_child = StudyCard(
            id="card-child",
            note_group_id=note_a.id,
            title="Child Card",
            content="child content",
            created_at=datetime.utcnow() + timedelta(minutes=2),
        )
        card_b = StudyCard(
            id="card-b",
            note_group_id=note_b.id,
            title="Second Card",
            content="second content",
            created_at=datetime.utcnow(),
        )
        card_hidden = StudyCard(
            id="card-hidden",
            note_group_id=note_hidden.id,
            title="Hidden Card",
            content="hidden content",
            created_at=datetime.utcnow() - timedelta(minutes=1),
        )
        card_parent.topic_chips.extend([parent, child])
        card_child.topic_chips.append(child)
        card_hidden.topic_chips.append(parent)
        db.add_all(
            [
                owner,
                reader,
                subject,
                reader_access,
                module,
                parent,
                child,
                note_a,
                note_b,
                note_hidden,
                card_parent,
                card_child,
                card_b,
                card_hidden,
                StudyCardSourceRange(
                    id="range-parent",
                    note_group_id=note_a.id,
                    study_card_id=card_parent.id,
                    start_index=0,
                    end_index=6,
                ),
                StudyCardSourceRange(
                    id="range-child",
                    note_group_id=note_a.id,
                    study_card_id=card_child.id,
                    start_index=7,
                    end_index=12,
                ),
                StudyCardSourceRange(
                    id="range-b",
                    note_group_id=note_b.id,
                    study_card_id=card_b.id,
                    start_index=0,
                    end_index=6,
                ),
                StudyCardSourceRange(
                    id="range-hidden",
                    note_group_id=note_hidden.id,
                    study_card_id=card_hidden.id,
                    start_index=0,
                    end_index=6,
                ),
            ]
        )
        db.commit()
        auth_user_id = {"id": "reader"}

        def override_db():
            yield db

        app.dependency_overrides[get_db] = override_db
        app.dependency_overrides[get_auth_context] = lambda: AuthContext(user=db.get(User, auth_user_id["id"]))
        test_client = TestClient(app)
        test_client.auth_user_id = auth_user_id
        yield test_client
    finally:
        app.dependency_overrides.clear()
        db.close()


def test_module_study_sources_follow_note_group_order(client):
    response = client.get("/modules/module-1/study-sources")
    assert response.status_code == 200
    payload = response.json()
    assert [group["id"] for group in payload["note_groups"]] == ["note-b", "note-a"]
    assert payload["note_groups"][0]["title"] == "Second"
    assert payload["note_groups"][0]["cleaned_text_markdown"] == "second source"
    assert [card["id"] for card in payload["note_groups"][0]["study_cards"]] == ["card-b"]
    assert payload["note_groups"][0]["study_cards"][0]["source_ranges"] == [
        {"start_index": 0, "end_index": 6}
    ]


def test_module_study_sources_hide_non_readable_note_groups_for_readers(client):
    response = client.get("/modules/module-1/study-sources")
    assert response.status_code == 200
    payload = response.json()
    assert "note-hidden" not in [group["id"] for group in payload["note_groups"]]
    assert "card-hidden" not in [
        card["id"] for group in payload["note_groups"] for card in group["study_cards"]
    ]


def test_concept_study_sources_respect_descendant_toggle_and_dedupe(client):
    included = client.get("/concepts/concept-parent/study-sources").json()
    assert [card["id"] for group in included["note_groups"] for card in group["study_cards"]] == [
        "card-parent",
        "card-child",
    ]

    direct_only = client.get("/concepts/concept-parent/study-sources?include_descendants=false").json()
    assert [card["id"] for group in direct_only["note_groups"] for card in group["study_cards"]] == [
        "card-parent",
    ]
