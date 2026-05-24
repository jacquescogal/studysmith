import json
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector

from app.config import settings
from app.db import Base

DEFAULT_MODULE_SETTINGS = {
    "auto_question_count": 30,
    "additional_generation_instructions": "",
}

APP_ROLE_READER = "reader"
APP_ROLE_CREATOR = "creator"
APP_ROLE_ADMIN = "admin"
APP_ROLES = {APP_ROLE_READER, APP_ROLE_CREATOR, APP_ROLE_ADMIN}

SUBJECT_VISIBILITY_PRIVATE = "private"
SUBJECT_VISIBILITY_PUBLIC_REQUESTED = "public_requested"
SUBJECT_VISIBILITY_PUBLIC = "public"
SUBJECT_VISIBILITIES = {
    SUBJECT_VISIBILITY_PRIVATE,
    SUBJECT_VISIBILITY_PUBLIC_REQUESTED,
    SUBJECT_VISIBILITY_PUBLIC,
}

SUBJECT_ACCESS_READER = "reader"
SUBJECT_ACCESS_MAINTAINER = "maintainer"
SUBJECT_ACCESS_OWNER = "owner"
SUBJECT_ACCESS_LEVELS = {
    SUBJECT_ACCESS_READER,
    SUBJECT_ACCESS_MAINTAINER,
    SUBJECT_ACCESS_OWNER,
}

SUBJECT_ACTIVITY_CREATED = "created"
SUBJECT_ACTIVITY_DELETED = "deleted"
SUBJECT_ACTIVITY_EVENT_TYPES = {
    SUBJECT_ACTIVITY_CREATED,
    SUBJECT_ACTIVITY_DELETED,
}

SUBJECT_ACTIVITY_MODULE = "module"
SUBJECT_ACTIVITY_NOTE_GROUP = "note_group"
SUBJECT_ACTIVITY_STUDY_CARD = "study_card"
SUBJECT_ACTIVITY_QUESTION_CARD = "question_card"
SUBJECT_ACTIVITY_ENTITY_TYPES = {
    SUBJECT_ACTIVITY_MODULE,
    SUBJECT_ACTIVITY_NOTE_GROUP,
    SUBJECT_ACTIVITY_STUDY_CARD,
    SUBJECT_ACTIVITY_QUESTION_CARD,
}

MIND_MAP_CONCEPT_TYPES = {"topic", "subtopic", "term", "process", "principle", "example"}
MIND_MAP_IMPORTANCE_LEVELS = {"core", "supporting", "detail"}
MIND_MAP_RELATION_TYPES = {
    "contains",
    "defines",
    "part_of",
    "requires",
    "enables",
    "causes",
    "contrasts_with",
    "example_of",
    "sequence",
    "related_to",
}
MIND_MAP_STUDY_CARD_ROLES = {"primary", "supporting"}


def _uuid() -> str:
    return str(uuid.uuid4())


def _check_values(column_name: str, values: set[str]) -> str:
    quoted_values = ", ".join(f"'{value}'" for value in sorted(values))
    return f"{column_name} IN ({quoted_values})"


note_group_topic_chips = Table(
    "note_group_topic_chips",
    Base.metadata,
    Column("note_group_id", String, ForeignKey("note_groups.id"), primary_key=True),
    Column("chip_id", String, ForeignKey("topic_chips.id"), primary_key=True),
)

study_card_topic_chips = Table(
    "study_card_topic_chips",
    Base.metadata,
    Column("study_card_id", String, ForeignKey("study_cards.id"), primary_key=True),
    Column("chip_id", String, ForeignKey("topic_chips.id"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            _check_values("app_role", APP_ROLES),
            name="ck_users_app_role",
        ),
    )

    id = Column(String, primary_key=True, default=_uuid)
    supabase_user_id = Column(String, nullable=False, unique=True, index=True)
    email = Column(String, nullable=False, unique=True, index=True)
    app_role = Column(String, nullable=False, default=APP_ROLE_READER)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owned_subjects = relationship("Subject", back_populates="owner")
    subject_access_grants = relationship(
        "SubjectAccess",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    question_card_learning_states = relationship(
        "QuestionCardLearningState",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    question_card_review_events = relationship("QuestionCardReviewEvent", back_populates="user")
    subject_activity_events = relationship("SubjectActivityEvent", back_populates="actor")


class SubjectAccess(Base):
    __tablename__ = "subject_access"
    __table_args__ = (
        CheckConstraint(
            _check_values("access_level", SUBJECT_ACCESS_LEVELS),
            name="ck_subject_access_access_level",
        ),
        UniqueConstraint("subject_id", "user_id", name="uq_subject_access_user"),
    )

    id = Column(String, primary_key=True, default=_uuid)
    subject_id = Column(String, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    access_level = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    subject = relationship("Subject", back_populates="access_grants")
    user = relationship("User", back_populates="subject_access_grants")


class Subject(Base):
    __tablename__ = "subjects"
    __table_args__ = (
        CheckConstraint(
            _check_values("visibility", SUBJECT_VISIBILITIES),
            name="ck_subjects_visibility",
        ),
    )

    id = Column(String, primary_key=True, default=_uuid)
    title = Column(String, nullable=False, unique=True)
    description = Column(Text)
    goal = Column(Text, nullable=True)
    scope = Column(Text, nullable=True)
    owner_user_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    visibility = Column(String, nullable=False, default=SUBJECT_VISIBILITY_PRIVATE, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="owned_subjects")
    access_grants = relationship(
        "SubjectAccess",
        back_populates="subject",
        cascade="all, delete-orphan",
    )
    activity_events = relationship(
        "SubjectActivityEvent",
        back_populates="subject",
        cascade="all, delete-orphan",
    )
    modules = relationship("Module", back_populates="subject")
    short_code_record = relationship(
        "SubjectShortCode",
        back_populates="subject",
        cascade="all, delete-orphan",
        uselist=False,
    )

    @property
    def short_code(self) -> str | None:
        return self.short_code_record.short_code if self.short_code_record else None


class SubjectActivityEvent(Base):
    __tablename__ = "subject_activity_events"
    __table_args__ = (
        CheckConstraint(
            _check_values("event_type", SUBJECT_ACTIVITY_EVENT_TYPES),
            name="ck_subject_activity_events_event_type",
        ),
        CheckConstraint(
            _check_values("entity_type", SUBJECT_ACTIVITY_ENTITY_TYPES),
            name="ck_subject_activity_events_entity_type",
        ),
    )

    id = Column(String, primary_key=True, default=_uuid)
    subject_id = Column(String, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    event_type = Column(String, nullable=False)
    entity_type = Column(String, nullable=False)
    entity_id = Column(String, nullable=False)
    entity_title = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    subject = relationship("Subject", back_populates="activity_events")
    actor = relationship("User", back_populates="subject_activity_events")

    @property
    def actor_email(self) -> str | None:
        return self.actor.email if self.actor else None


class SubjectShortCode(Base):
    __tablename__ = "subject_short_codes"

    subject_id = Column(
        String,
        ForeignKey("subjects.id", ondelete="CASCADE"),
        primary_key=True,
    )
    short_code = Column(String, nullable=False, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    subject = relationship("Subject", back_populates="short_code_record")


class Module(Base):
    __tablename__ = "modules"

    id = Column(String, primary_key=True, default=_uuid)
    subject_id = Column(String, ForeignKey("subjects.id"), nullable=False)
    title = Column(String, nullable=False, unique=True)
    description = Column(Text)
    goal = Column(Text, nullable=True)
    scope = Column(Text, nullable=True)
    settings_json = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    subject = relationship("Subject", back_populates="modules")
    note_groups = relationship("NoteGroup", back_populates="module")
    topic_chips = relationship("TopicChip", back_populates="module")
    mind_map_concepts = relationship("MindMapConcept", back_populates="module")
    mind_map_relations = relationship("MindMapRelation", back_populates="module")
    short_code_record = relationship(
        "ModuleShortCode",
        back_populates="module",
        cascade="all, delete-orphan",
        uselist=False,
    )

    @property
    def short_code(self) -> str | None:
        return self.short_code_record.short_code if self.short_code_record else None

    @property
    def settings(self) -> dict:
        if not self.settings_json:
            return dict(DEFAULT_MODULE_SETTINGS)
        try:
            data = json.loads(self.settings_json)
        except json.JSONDecodeError:
            data = {}
        if not isinstance(data, dict):
            data = {}
        return {**DEFAULT_MODULE_SETTINGS, **data}


class ModuleShortCode(Base):
    __tablename__ = "module_short_codes"

    module_id = Column(
        String,
        ForeignKey("modules.id", ondelete="CASCADE"),
        primary_key=True,
    )
    short_code = Column(String, nullable=False, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    module = relationship("Module", back_populates="short_code_record")


class NoteGroup(Base):
    __tablename__ = "note_groups"
    __table_args__ = (
        UniqueConstraint("module_id", "id", name="uq_note_groups_module_id_id"),
    )

    id = Column(String, primary_key=True, default=_uuid)
    module_id = Column(String, ForeignKey("modules.id"), nullable=False)
    title = Column(String)
    source = Column(Text)
    source_normalized = Column(String, index=True)
    raw_text = Column(Text, nullable=False)
    additional_generation_instructions = Column(Text)
    cleaned_text_markdown = Column(Text)
    formatted_text = Column(Text)
    formatted_sections_json = Column(Text)
    generation_status = Column(String, default="created")
    suggested_titles_json = Column(Text)
    sort_order = Column(Integer)
    mind_map_status = Column(String, nullable=False, default="not_generated")
    mind_map_stale = Column(Boolean, nullable=False, default=False)
    mind_map_generated_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    module = relationship("Module", back_populates="note_groups")
    study_cards = relationship("StudyCard", back_populates="note_group")
    question_cards = relationship("QuestionCard", back_populates="note_group")
    jobs = relationship("Job", back_populates="note_group")
    short_code_record = relationship(
        "NoteGroupShortCode",
        back_populates="note_group",
        cascade="all, delete-orphan",
        uselist=False,
    )
    topic_chips = relationship(
        "TopicChip",
        secondary=note_group_topic_chips,
        back_populates="note_groups",
    )
    mind_map_concepts = relationship(
        "MindMapConcept",
        secondary="note_group_mind_map_concepts",
        back_populates="note_groups",
    )

    @property
    def short_code(self) -> str | None:
        return self.short_code_record.short_code if self.short_code_record else None

    @property
    def suggested_titles(self) -> list[str]:
        if not self.suggested_titles_json:
            return []
        try:
            data = json.loads(self.suggested_titles_json)
        except json.JSONDecodeError:
            return []
        return data if isinstance(data, list) else []

    @property
    def formatted_sections(self) -> list[dict]:
        if not self.formatted_sections_json:
            return []
        try:
            data = json.loads(self.formatted_sections_json)
        except json.JSONDecodeError:
            return []
        return data if isinstance(data, list) else []

    @property
    def subject_id(self) -> str | None:
        return self.module.subject_id if self.module else None


class NoteGroupShortCode(Base):
    __tablename__ = "note_group_short_codes"

    note_group_id = Column(
        String,
        ForeignKey("note_groups.id", ondelete="CASCADE"),
        primary_key=True,
    )
    short_code = Column(String, nullable=False, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    note_group = relationship("NoteGroup", back_populates="short_code_record")


class StudyCard(Base):
    __tablename__ = "study_cards"
    __table_args__ = (
        UniqueConstraint("note_group_id", "id", name="uq_study_cards_note_group_id_id"),
    )

    id = Column(String, primary_key=True, default=_uuid)
    note_group_id = Column(String, ForeignKey("note_groups.id"), nullable=False)
    title = Column(String)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    note_group = relationship("NoteGroup", back_populates="study_cards")
    source_ranges = relationship(
        "StudyCardSourceRange",
        back_populates="study_card",
        cascade="all, delete-orphan",
        order_by="StudyCardSourceRange.start_index",
    )
    topic_chips = relationship(
        "TopicChip",
        secondary=study_card_topic_chips,
        back_populates="study_cards",
    )
    mind_map_concept_links = relationship(
        "StudyCardMindMapConcept",
        back_populates="study_card",
        cascade="all, delete-orphan",
    )
    embedding = relationship(
        "StudyCardEmbedding",
        back_populates="study_card",
        cascade="all, delete-orphan",
        uselist=False,
    )


class StudyCardEmbedding(Base):
    __tablename__ = "study_card_embeddings"

    study_card_id = Column(
        String,
        ForeignKey("study_cards.id", ondelete="CASCADE"),
        primary_key=True,
    )
    module_id = Column(String, ForeignKey("modules.id", ondelete="CASCADE"), nullable=False, index=True)
    note_group_id = Column(String, ForeignKey("note_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(settings.embedding_dimension), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    study_card = relationship("StudyCard", back_populates="embedding")
    module = relationship("Module")
    note_group = relationship("NoteGroup")


class StudyCardSourceRange(Base):
    __tablename__ = "study_card_source_ranges"

    id = Column(String, primary_key=True, default=_uuid)
    note_group_id = Column(String, ForeignKey("note_groups.id"), nullable=False)
    study_card_id = Column(String, ForeignKey("study_cards.id"), nullable=False)
    start_index = Column(Integer, nullable=False)
    end_index = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    study_card = relationship("StudyCard", back_populates="source_ranges")
    note_group = relationship("NoteGroup")


class MindMapConcept(Base):
    __tablename__ = "mind_map_concepts"
    __table_args__ = (
        UniqueConstraint("module_id", "slug", name="uq_mind_map_concepts_module_slug"),
        UniqueConstraint("module_id", "id", name="uq_mind_map_concepts_module_id"),
        CheckConstraint(_check_values("concept_type", MIND_MAP_CONCEPT_TYPES), name="ck_mind_map_concepts_type"),
        CheckConstraint(_check_values("importance", MIND_MAP_IMPORTANCE_LEVELS), name="ck_mind_map_concepts_importance"),
    )

    id = Column(String, primary_key=True, default=_uuid)
    module_id = Column(String, ForeignKey("modules.id", ondelete="CASCADE"), nullable=False, index=True)
    slug = Column(String, nullable=False)
    title = Column(String, nullable=False)
    summary = Column(Text, nullable=False)
    concept_type = Column(String, nullable=False)
    importance = Column(String, nullable=False)
    source_quote = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    module = relationship("Module", back_populates="mind_map_concepts")
    note_groups = relationship(
        "NoteGroup",
        secondary="note_group_mind_map_concepts",
        back_populates="mind_map_concepts",
    )
    study_card_links = relationship(
        "StudyCardMindMapConcept",
        back_populates="concept",
        cascade="all, delete-orphan",
    )
    outgoing_relations = relationship(
        "MindMapRelation",
        foreign_keys="MindMapRelation.source_concept_id",
        back_populates="source_concept",
        cascade="all, delete-orphan",
    )
    incoming_relations = relationship(
        "MindMapRelation",
        foreign_keys="MindMapRelation.target_concept_id",
        back_populates="target_concept",
        cascade="all, delete-orphan",
    )


class MindMapRelation(Base):
    __tablename__ = "mind_map_relations"
    __table_args__ = (
        ForeignKeyConstraint(
            ["module_id", "source_concept_id"],
            ["mind_map_concepts.module_id", "mind_map_concepts.id"],
            ondelete="CASCADE",
            name="fk_mind_map_relations_source_concept_module",
        ),
        ForeignKeyConstraint(
            ["module_id", "target_concept_id"],
            ["mind_map_concepts.module_id", "mind_map_concepts.id"],
            ondelete="CASCADE",
            name="fk_mind_map_relations_target_concept_module",
        ),
        ForeignKeyConstraint(
            ["module_id", "source_note_group_id"],
            ["note_groups.module_id", "note_groups.id"],
            ondelete="CASCADE",
            name="fk_mind_map_relations_source_note_group_module",
        ),
        UniqueConstraint(
            "module_id",
            "source_concept_id",
            "target_concept_id",
            "relation_type",
            "source_note_group_id",
            name="uq_mind_map_relations_note_group_edge",
        ),
        CheckConstraint("source_concept_id != target_concept_id", name="ck_mind_map_relations_not_self"),
        CheckConstraint(_check_values("relation_type", MIND_MAP_RELATION_TYPES), name="ck_mind_map_relations_type"),
        Index("ix_mind_map_relations_source_concept_id", "source_concept_id"),
        Index("ix_mind_map_relations_target_concept_id", "target_concept_id"),
        Index("ix_mind_map_relations_module_source_concept_id", "module_id", "source_concept_id"),
        Index("ix_mind_map_relations_module_target_concept_id", "module_id", "target_concept_id"),
        Index("ix_mind_map_relations_module_source_note_group_id", "module_id", "source_note_group_id"),
    )

    id = Column(String, primary_key=True, default=_uuid)
    module_id = Column(String, ForeignKey("modules.id", ondelete="CASCADE"), nullable=False, index=True)
    source_concept_id = Column(String, ForeignKey("mind_map_concepts.id", ondelete="CASCADE"), nullable=False)
    target_concept_id = Column(String, ForeignKey("mind_map_concepts.id", ondelete="CASCADE"), nullable=False)
    relation_type = Column(String, nullable=False)
    label = Column(String)
    confidence = Column(Float, nullable=False, default=0.0)
    source_note_group_id = Column(String, ForeignKey("note_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    module = relationship("Module", back_populates="mind_map_relations")
    source_concept = relationship("MindMapConcept", foreign_keys=[source_concept_id], back_populates="outgoing_relations")
    target_concept = relationship("MindMapConcept", foreign_keys=[target_concept_id], back_populates="incoming_relations")
    source_note_group = relationship("NoteGroup", foreign_keys=[source_note_group_id])


class StudyCardMindMapConcept(Base):
    __tablename__ = "study_card_mind_map_concepts"
    __table_args__ = (
        ForeignKeyConstraint(
            ["module_id", "concept_id"],
            ["mind_map_concepts.module_id", "mind_map_concepts.id"],
            ondelete="CASCADE",
            name="fk_study_card_mind_map_concepts_concept_module",
        ),
        ForeignKeyConstraint(
            ["module_id", "note_group_id"],
            ["note_groups.module_id", "note_groups.id"],
            ondelete="CASCADE",
            name="fk_study_card_mind_map_concepts_note_group_module",
        ),
        ForeignKeyConstraint(
            ["note_group_id", "study_card_id"],
            ["study_cards.note_group_id", "study_cards.id"],
            ondelete="CASCADE",
            name="fk_study_card_mind_map_concepts_study_card_note_group",
        ),
        CheckConstraint(_check_values("role", MIND_MAP_STUDY_CARD_ROLES), name="ck_study_card_mind_map_concepts_role"),
        Index("ix_study_card_mind_map_concepts_concept_id", "concept_id"),
        Index("ix_study_card_mind_map_concepts_module_id", "module_id"),
        Index("ix_study_card_mind_map_concepts_note_group_id", "note_group_id"),
        Index("ix_study_card_mind_map_concepts_module_concept_id", "module_id", "concept_id"),
        Index("ix_study_card_mind_map_concepts_module_note_group_id", "module_id", "note_group_id"),
        Index("ix_study_card_mind_map_concepts_note_group_study_card_id", "note_group_id", "study_card_id"),
    )

    study_card_id = Column(String, primary_key=True)
    concept_id = Column(String, primary_key=True)
    module_id = Column(String, nullable=False)
    note_group_id = Column(String, nullable=False)
    role = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    study_card = relationship("StudyCard", back_populates="mind_map_concept_links")
    concept = relationship("MindMapConcept", back_populates="study_card_links")


class NoteGroupMindMapConcept(Base):
    __tablename__ = "note_group_mind_map_concepts"
    __table_args__ = (
        ForeignKeyConstraint(
            ["module_id", "note_group_id"],
            ["note_groups.module_id", "note_groups.id"],
            ondelete="CASCADE",
            name="fk_note_group_mind_map_concepts_note_group_module",
        ),
        ForeignKeyConstraint(
            ["module_id", "concept_id"],
            ["mind_map_concepts.module_id", "mind_map_concepts.id"],
            ondelete="CASCADE",
            name="fk_note_group_mind_map_concepts_concept_module",
        ),
        Index("ix_note_group_mind_map_concepts_concept_id", "concept_id"),
        Index("ix_note_group_mind_map_concepts_module_id", "module_id"),
        Index("ix_note_group_mind_map_concepts_module_note_group_id", "module_id", "note_group_id"),
        Index("ix_note_group_mind_map_concepts_module_concept_id", "module_id", "concept_id"),
    )

    note_group_id = Column(String, primary_key=True)
    concept_id = Column(String, primary_key=True)
    module_id = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class QuestionCard(Base):
    __tablename__ = "question_cards"

    id = Column(String, primary_key=True, default=_uuid)
    note_group_id = Column(String, ForeignKey("note_groups.id"), nullable=False)
    type = Column(String, nullable=False)
    prompt = Column(Text, nullable=False)
    options_json = Column(Text, nullable=False)
    correct_option_indices_json = Column(Text, nullable=False)
    option_explanations_json = Column(Text)
    study_card_refs_json = Column(Text, nullable=False)
    stale = Column(Boolean, default=False)
    due_at = Column(DateTime, default=datetime.utcnow)
    last_review_at = Column(DateTime)
    stability = Column(Float, default=0.0)
    difficulty = Column(Float, default=0.0)
    elapsed_days = Column(Integer, default=0)
    scheduled_days = Column(Integer, default=0)
    reps = Column(Integer, default=0)
    lapses = Column(Integer, default=0)
    state = Column(Integer, default=1)
    step = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    note_group = relationship("NoteGroup", back_populates="question_cards")
    learning_states = relationship(
        "QuestionCardLearningState",
        back_populates="question_card",
        cascade="all, delete-orphan",
    )


class QuestionCardLearningState(Base):
    __tablename__ = "question_card_learning_states"
    __table_args__ = (
        UniqueConstraint("question_card_id", "user_id", name="uq_question_card_learning_state_user"),
    )

    id = Column(String, primary_key=True, default=_uuid)
    question_card_id = Column(String, ForeignKey("question_cards.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    disabled = Column(Boolean, nullable=False, default=False)
    due_at = Column(DateTime, default=datetime.utcnow)
    last_review_at = Column(DateTime)
    stability = Column(Float, default=0.0)
    difficulty = Column(Float, default=0.0)
    elapsed_days = Column(Integer, default=0)
    scheduled_days = Column(Integer, default=0)
    reps = Column(Integer, default=0)
    lapses = Column(Integer, default=0)
    state = Column(Integer, default=1)
    step = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    question_card = relationship("QuestionCard", back_populates="learning_states")
    user = relationship("User", back_populates="question_card_learning_states")


class QuestionCardReviewEvent(Base):
    __tablename__ = "question_card_reviews"

    id = Column(String, primary_key=True, default=_uuid)
    question_card_id = Column(String, ForeignKey("question_cards.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    note_group_id = Column(String, ForeignKey("note_groups.id"), nullable=False, index=True)
    module_id = Column(String, ForeignKey("modules.id"), nullable=False, index=True)
    correct = Column(Boolean, nullable=False)
    response_time_ms = Column(Integer, nullable=False)
    rating = Column(String, nullable=False)
    previous_due_at = Column(DateTime)
    next_due_at = Column(DateTime)
    previous_difficulty = Column(Float, default=0.0)
    next_difficulty = Column(Float, default=0.0)
    previous_stability = Column(Float, default=0.0)
    next_stability = Column(Float, default=0.0)
    previous_state = Column(Integer)
    next_state = Column(Integer)
    previous_reps = Column(Integer, default=0)
    next_reps = Column(Integer, default=0)
    previous_lapses = Column(Integer, default=0)
    next_lapses = Column(Integer, default=0)
    answer_option_indices_json = Column(Text, nullable=False, default="[]")
    correct_option_indices_json = Column(Text, nullable=False, default="[]")
    reviewed_at = Column(DateTime, default=datetime.utcnow, index=True)

    question_card = relationship("QuestionCard")
    user = relationship("User", back_populates="question_card_review_events")
    note_group = relationship("NoteGroup")
    module = relationship("Module")


class TopicChip(Base):
    __tablename__ = "topic_chips"

    id = Column(String, primary_key=True, default=_uuid)
    module_id = Column(String, ForeignKey("modules.id"), nullable=False)
    parent_topic_id = Column(String, ForeignKey("topic_chips.id", ondelete="SET NULL"), nullable=True, index=True)
    label = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    module = relationship("Module", back_populates="topic_chips")
    parent_topic = relationship(
        "TopicChip",
        remote_side=[id],
        back_populates="child_topics",
    )
    child_topics = relationship(
        "TopicChip",
        back_populates="parent_topic",
        order_by="TopicChip.sort_order.asc(), TopicChip.label.asc(), TopicChip.id.asc()",
    )
    short_code_record = relationship(
        "TopicChipShortCode",
        back_populates="topic_chip",
        cascade="all, delete-orphan",
        uselist=False,
    )
    note_groups = relationship(
        "NoteGroup",
        secondary=note_group_topic_chips,
        back_populates="topic_chips",
    )
    study_cards = relationship(
        "StudyCard",
        secondary=study_card_topic_chips,
        back_populates="topic_chips",
    )

    @property
    def short_code(self) -> str | None:
        return self.short_code_record.short_code if self.short_code_record else None


class TopicChipShortCode(Base):
    __tablename__ = "topic_chip_short_codes"

    topic_chip_id = Column(
        String,
        ForeignKey("topic_chips.id", ondelete="CASCADE"),
        primary_key=True,
    )
    short_code = Column(String, nullable=False, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    topic_chip = relationship("TopicChip", back_populates="short_code_record")


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        Index(
            "uq_jobs_active_mind_map_generation_note_group",
            "note_group_id",
            unique=True,
            sqlite_where=text(
                "note_group_id IS NOT NULL "
                "AND type = 'MIND_MAP_GENERATION' "
                "AND status IN ('queued', 'running')"
            ),
            postgresql_where=text(
                "note_group_id IS NOT NULL "
                "AND type = 'MIND_MAP_GENERATION' "
                "AND status IN ('queued', 'running')"
            ),
        ),
    )

    id = Column(String, primary_key=True, default=_uuid)
    type = Column(String, nullable=False)
    status = Column(String, default="queued")
    note_group_id = Column(String, ForeignKey("note_groups.id"))
    payload_json = Column(Text)
    error = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    note_group = relationship("NoteGroup", back_populates="jobs")
