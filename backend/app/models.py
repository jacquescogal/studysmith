import json
import uuid
from datetime import datetime

from sqlalchemy import (
    and_,
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
from sqlalchemy.orm import foreign, relationship
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
KNOWLEDGE_NODE_TYPES = {"definition", "mechanism", "rule", "fact"}
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

JOB_STAGE_QUEUED = "queued"
JOB_STAGE_TITLE = "title"
JOB_STAGE_CLEANED_TEXT = "cleaned_text"
JOB_STAGE_STUDY_CARDS = "study_cards"
JOB_STAGE_FORMATTED_TEXT = "formatted_text"
JOB_STAGE_EMBEDDINGS = "embeddings"
JOB_STAGE_QUESTION_CARDS = "question_cards"
JOB_STAGE_MIND_MAP_TOPICS = "mind_map_topics"
JOB_STAGE_TOPIC_KNOWLEDGE_NODES = "topic_knowledge_nodes"
JOB_STAGE_PROMOTING = "promoting"
JOB_STAGE_COMPLETE = "complete"
JOB_STAGES = {
    JOB_STAGE_QUEUED,
    JOB_STAGE_TITLE,
    JOB_STAGE_CLEANED_TEXT,
    JOB_STAGE_STUDY_CARDS,
    JOB_STAGE_FORMATTED_TEXT,
    JOB_STAGE_EMBEDDINGS,
    JOB_STAGE_QUESTION_CARDS,
    JOB_STAGE_MIND_MAP_TOPICS,
    JOB_STAGE_TOPIC_KNOWLEDGE_NODES,
    JOB_STAGE_PROMOTING,
    JOB_STAGE_COMPLETE,
}
JOB_STAGE_STATUSES = {"pending", "running", "succeeded", "failed", "cancelled"}


def _uuid() -> str:
    return str(uuid.uuid4())


def _check_values(column_name: str, values: set[str]) -> str:
    quoted_values = ", ".join(f"'{value}'" for value in sorted(values))
    return f"{column_name} IN ({quoted_values})"


def _exactly_one_not_null(*column_names: str) -> str:
    terms = [
        f"CASE WHEN {column_name} IS NOT NULL THEN 1 ELSE 0 END"
        for column_name in column_names
    ]
    return f"({' + '.join(terms)}) = 1"


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
    jobs = relationship("Job", back_populates="note_group", passive_deletes=True)
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
        CheckConstraint(_check_values("knowledge_type", KNOWLEDGE_NODE_TYPES), name="ck_mind_map_concepts_knowledge_type"),
        CheckConstraint(_check_values("importance", MIND_MAP_IMPORTANCE_LEVELS), name="ck_mind_map_concepts_importance"),
    )

    id = Column(String, primary_key=True, default=_uuid)
    module_id = Column(String, ForeignKey("modules.id", ondelete="CASCADE"), nullable=False, index=True)
    topic_id = Column(String, ForeignKey("topic_chips.id", ondelete="SET NULL"), nullable=True, index=True)
    slug = Column(String, nullable=False)
    title = Column(String, nullable=False)
    summary = Column(Text, nullable=False)
    concept_type = Column(String, nullable=False)
    knowledge_type = Column(String, nullable=True)
    importance = Column(String, nullable=False)
    source_quote = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    module = relationship("Module", back_populates="mind_map_concepts")
    topic = relationship("TopicChip")
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
    question_card_id = Column(String, ForeignKey("question_cards.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    note_group_id = Column(String, ForeignKey("note_groups.id", ondelete="CASCADE"), nullable=False, index=True)
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
    __table_args__ = (
        UniqueConstraint("module_id", "id", name="uq_topic_chips_module_id_id"),
    )

    id = Column(String, primary_key=True, default=_uuid)
    module_id = Column(String, ForeignKey("modules.id"), nullable=False)
    parent_topic_id = Column(String, ForeignKey("topic_chips.id", ondelete="SET NULL"), nullable=True, index=True)
    label = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    knowledge_node_status = Column(String, nullable=False, default="not_generated")
    knowledge_node_review_reason = Column(Text, nullable=True)
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
        UniqueConstraint("id", "note_group_id", name="uq_jobs_id_note_group_id"),
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
    note_group_id = Column(String, ForeignKey("note_groups.id", ondelete="SET NULL"))
    payload_json = Column(Text)
    error = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    note_group = relationship("NoteGroup", back_populates="jobs")
    stages = relationship(
        "JobStage",
        back_populates="job",
        cascade="all, delete-orphan",
        order_by="JobStage.sort_order",
    )
    logs = relationship(
        "JobLog",
        back_populates="job",
        cascade="all, delete-orphan",
        order_by="JobLog.created_at",
    )
    generation_draft = relationship(
        "NoteGroupGenerationDraft",
        back_populates="job",
        cascade="all, delete-orphan",
        uselist=False,
    )

    def _current_stage_record(self):
        current_stage = self.current_stage
        if current_stage:
            for stage in self.stages:
                if stage.stage == current_stage:
                    return stage
        return None

    @property
    def current_stage(self) -> str | None:
        if self.generation_draft:
            return self.generation_draft.current_stage
        if self.stages:
            return self.stages[-1].stage
        return None

    @property
    def stage_status(self) -> str | None:
        stage = self._current_stage_record()
        return stage.status if stage else None

    @property
    def progress_current(self) -> int | None:
        stage = self._current_stage_record()
        return stage.progress_current if stage else None

    @property
    def progress_total(self) -> int | None:
        stage = self._current_stage_record()
        return stage.progress_total if stage else None


class JobStage(Base):
    __tablename__ = "job_stages"
    __table_args__ = (
        UniqueConstraint("job_id", "stage", name="uq_job_stages_job_stage"),
        CheckConstraint(_check_values("stage", JOB_STAGES), name="ck_job_stages_stage"),
        CheckConstraint(_check_values("status", JOB_STAGE_STATUSES), name="ck_job_stages_status"),
    )

    id = Column(String, primary_key=True, default=_uuid)
    job_id = Column(String, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    stage = Column(String, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    status = Column(String, nullable=False, default="pending")
    started_at = Column(DateTime)
    finished_at = Column(DateTime)
    error = Column(Text)
    progress_current = Column(Integer)
    progress_total = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    job = relationship("Job", back_populates="stages")


class JobLog(Base):
    __tablename__ = "job_logs"

    id = Column(String, primary_key=True, default=_uuid)
    job_id = Column(String, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    stage = Column(String)
    message = Column(Text, nullable=False)
    metadata_json = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    job = relationship("Job", back_populates="logs")

    @property
    def metadata_dict(self) -> dict:
        if not self.metadata_json:
            return {}
        try:
            data = json.loads(self.metadata_json)
        except json.JSONDecodeError:
            return {}
        return data if isinstance(data, dict) else {}


class NoteGroupGenerationDraft(Base):
    __tablename__ = "note_group_generation_drafts"
    __table_args__ = (
        UniqueConstraint("id", "module_id", name="uq_note_group_generation_drafts_id_module_id"),
        CheckConstraint(_check_values("current_stage", JOB_STAGES), name="ck_note_group_generation_drafts_current_stage"),
        ForeignKeyConstraint(
            ["module_id", "note_group_id"],
            ["note_groups.module_id", "note_groups.id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["job_id", "note_group_id"],
            ["jobs.id", "jobs.note_group_id"],
            ondelete="CASCADE",
        ),
    )

    id = Column(String, primary_key=True, default=_uuid)
    job_id = Column(String, nullable=False, unique=True)
    module_id = Column(String, ForeignKey("modules.id", ondelete="CASCADE"), nullable=False, index=True)
    note_group_id = Column(String, nullable=False, unique=True, index=True)
    raw_text = Column(Text, nullable=False)
    unique_id = Column(String)
    additional_generation_instructions = Column(Text)
    title = Column(String)
    suggested_titles_json = Column(Text)
    cleaned_text_markdown = Column(Text)
    formatted_sections_json = Column(Text)
    formatted_text = Column(Text)
    current_stage = Column(String, nullable=False, default=JOB_STAGE_QUEUED)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    job = relationship("Job", back_populates="generation_draft")
    module = relationship("Module")
    note_group = relationship("NoteGroup", overlaps="generation_draft,job,module")
    study_cards = relationship(
        "DraftStudyCard",
        back_populates="draft",
        cascade="all, delete-orphan",
        order_by="DraftStudyCard.sort_order",
    )
    question_cards = relationship(
        "DraftQuestionCard",
        back_populates="draft",
        cascade="all, delete-orphan",
        order_by="DraftQuestionCard.sort_order",
    )
    topics = relationship(
        "DraftTopic",
        back_populates="draft",
        cascade="all, delete-orphan",
        order_by="DraftTopic.sort_order",
    )
    knowledge_nodes = relationship(
        "DraftKnowledgeNode",
        back_populates="draft",
        cascade="all, delete-orphan",
        order_by="DraftKnowledgeNode.sort_order",
    )
    note_group_topic_links = relationship(
        "DraftNoteGroupTopicLink",
        back_populates="draft",
        cascade="all, delete-orphan",
        order_by="DraftNoteGroupTopicLink.sort_order",
    )
    mind_map_relations = relationship(
        "DraftMindMapRelation",
        back_populates="draft",
        cascade="all, delete-orphan",
        order_by="DraftMindMapRelation.sort_order",
    )


class DraftStudyCard(Base):
    __tablename__ = "draft_study_cards"
    __table_args__ = (
        UniqueConstraint("draft_id", "id", name="uq_draft_study_cards_draft_id_id"),
    )

    id = Column(String, primary_key=True, default=_uuid)
    draft_id = Column(String, ForeignKey("note_group_generation_drafts.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String)
    content = Column(Text, nullable=False)
    embedding_json = Column(Text)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    draft = relationship("NoteGroupGenerationDraft", back_populates="study_cards")
    source_ranges = relationship(
        "DraftStudyCardSourceRange",
        back_populates="draft_study_card",
        cascade="all, delete-orphan",
        order_by="DraftStudyCardSourceRange.start_index",
    )
    topic_links = relationship(
        "DraftStudyCardTopicLink",
        back_populates="draft_study_card",
        cascade="all, delete-orphan",
    )
    knowledge_node_links = relationship(
        "DraftStudyCardKnowledgeNodeLink",
        back_populates="draft_study_card",
        cascade="all, delete-orphan",
    )


class DraftStudyCardSourceRange(Base):
    __tablename__ = "draft_study_card_source_ranges"

    id = Column(String, primary_key=True, default=_uuid)
    draft_study_card_id = Column(String, ForeignKey("draft_study_cards.id", ondelete="CASCADE"), nullable=False, index=True)
    start_index = Column(Integer, nullable=False)
    end_index = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    draft_study_card = relationship("DraftStudyCard", back_populates="source_ranges")


class DraftQuestionCard(Base):
    __tablename__ = "draft_question_cards"

    id = Column(String, primary_key=True, default=_uuid)
    draft_id = Column(String, ForeignKey("note_group_generation_drafts.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String, nullable=False)
    prompt = Column(Text, nullable=False)
    options_json = Column(Text, nullable=False)
    correct_option_indices_json = Column(Text, nullable=False)
    option_explanations_json = Column(Text)
    study_card_refs_json = Column(Text, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    draft = relationship("NoteGroupGenerationDraft", back_populates="question_cards")


class DraftTopic(Base):
    __tablename__ = "draft_topics"
    __table_args__ = (
        UniqueConstraint("draft_id", "id", name="uq_draft_topics_draft_id_id"),
        UniqueConstraint("draft_id", "relation_endpoint_id", name="uq_draft_topics_relation_endpoint"),
        ForeignKeyConstraint(
            ["draft_id", "module_id"],
            ["note_group_generation_drafts.id", "note_group_generation_drafts.module_id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["draft_id", "parent_draft_topic_id"],
            ["draft_topics.draft_id", "draft_topics.id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["module_id", "existing_topic_id"],
            ["topic_chips.module_id", "topic_chips.id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["module_id", "parent_existing_topic_id"],
            ["topic_chips.module_id", "topic_chips.id"],
            ondelete="CASCADE",
        ),
        CheckConstraint(
            "parent_draft_topic_id IS NULL OR parent_existing_topic_id IS NULL",
            name="ck_draft_topics_at_most_one_parent",
        ),
        CheckConstraint(
            "existing_topic_id IS NULL OR relation_endpoint_id IS NULL",
            name="ck_draft_topics_existing_alias_has_no_relation_endpoint",
        ),
        CheckConstraint(
            "relation_endpoint_id IS NULL OR relation_endpoint_id = id",
            name="ck_draft_topics_relation_endpoint_matches_id",
        ),
    )

    id = Column(String, primary_key=True, default=_uuid)
    draft_id = Column(String, nullable=False, index=True)
    module_id = Column(String, nullable=False, index=True)
    existing_topic_id = Column(String, nullable=True)
    relation_endpoint_id = Column(String, nullable=True)
    parent_draft_topic_id = Column(String, nullable=True)
    parent_existing_topic_id = Column(String, nullable=True)
    label = Column(String, nullable=False)
    description = Column(Text)
    sort_order = Column(Integer, nullable=False, default=0)
    knowledge_node_status = Column(String, nullable=False, default="not_generated")
    knowledge_node_review_reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    draft = relationship("NoteGroupGenerationDraft", back_populates="topics")
    existing_topic = relationship("TopicChip", foreign_keys=[module_id, existing_topic_id], overlaps="draft,topics")
    parent_existing_topic = relationship(
        "TopicChip",
        foreign_keys=[module_id, parent_existing_topic_id],
        overlaps="draft,existing_topic,topics",
    )
    parent_draft_topic = relationship(
        "DraftTopic",
        remote_side=[id],
        foreign_keys=[parent_draft_topic_id],
        back_populates="child_draft_topics",
    )
    child_draft_topics = relationship(
        "DraftTopic",
        back_populates="parent_draft_topic",
        foreign_keys=[parent_draft_topic_id],
        order_by="DraftTopic.sort_order",
        passive_deletes=True,
    )
    knowledge_nodes = relationship(
        "DraftKnowledgeNode",
        back_populates="draft_topic",
        cascade="all, delete-orphan",
        overlaps="draft,knowledge_nodes",
    )


class DraftKnowledgeNode(Base):
    __tablename__ = "draft_knowledge_nodes"
    __table_args__ = (
        UniqueConstraint("draft_id", "id", name="uq_draft_knowledge_nodes_draft_id_id"),
        CheckConstraint(
            _exactly_one_not_null("draft_topic_id", "existing_topic_id"),
            name="ck_draft_knowledge_nodes_exactly_one_topic",
        ),
        ForeignKeyConstraint(
            ["draft_id", "module_id"],
            ["note_group_generation_drafts.id", "note_group_generation_drafts.module_id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["draft_id", "draft_topic_id"],
            ["draft_topics.draft_id", "draft_topics.id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["module_id", "existing_topic_id"],
            ["topic_chips.module_id", "topic_chips.id"],
            ondelete="CASCADE",
        ),
    )

    id = Column(String, primary_key=True, default=_uuid)
    draft_id = Column(String, nullable=False, index=True)
    module_id = Column(String, nullable=False, index=True)
    draft_topic_id = Column(String, nullable=True, index=True)
    existing_topic_id = Column(String, nullable=True, index=True)
    title = Column(String, nullable=False)
    summary = Column(Text, nullable=False)
    knowledge_type = Column(String)
    importance = Column(String)
    source_quote = Column(Text)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    draft = relationship(
        "NoteGroupGenerationDraft",
        back_populates="knowledge_nodes",
        overlaps="knowledge_nodes",
    )
    draft_topic = relationship(
        "DraftTopic",
        back_populates="knowledge_nodes",
        overlaps="draft,knowledge_nodes",
    )
    existing_topic = relationship("TopicChip", foreign_keys=[module_id, existing_topic_id], overlaps="draft,knowledge_nodes")
    study_card_links = relationship(
        "DraftStudyCardKnowledgeNodeLink",
        back_populates="draft_knowledge_node",
        cascade="all, delete-orphan",
        overlaps="knowledge_node_links",
    )


class DraftNoteGroupTopicLink(Base):
    __tablename__ = "draft_note_group_topic_links"
    __table_args__ = (
        CheckConstraint(
            _exactly_one_not_null("draft_topic_id", "existing_topic_id"),
            name="ck_draft_note_group_topic_links_exactly_one_topic",
        ),
        ForeignKeyConstraint(
            ["draft_id", "module_id"],
            ["note_group_generation_drafts.id", "note_group_generation_drafts.module_id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["draft_id", "draft_topic_id"],
            ["draft_topics.draft_id", "draft_topics.id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["module_id", "existing_topic_id"],
            ["topic_chips.module_id", "topic_chips.id"],
            ondelete="CASCADE",
        ),
    )

    id = Column(String, primary_key=True, default=_uuid)
    draft_id = Column(String, nullable=False, index=True)
    module_id = Column(String, nullable=False, index=True)
    draft_topic_id = Column(String, nullable=True, index=True)
    existing_topic_id = Column(String, nullable=True, index=True)
    sort_order = Column(Integer, nullable=False, default=0)

    draft = relationship("NoteGroupGenerationDraft", back_populates="note_group_topic_links")
    draft_topic = relationship("DraftTopic", overlaps="draft,note_group_topic_links")
    existing_topic = relationship(
        "TopicChip",
        foreign_keys=[module_id, existing_topic_id],
        overlaps="draft,note_group_topic_links",
    )


class DraftStudyCardTopicLink(Base):
    __tablename__ = "draft_study_card_topic_links"
    __table_args__ = (
        CheckConstraint(
            _exactly_one_not_null("draft_topic_id", "existing_topic_id"),
            name="ck_draft_study_card_topic_links_exactly_one_topic",
        ),
        ForeignKeyConstraint(
            ["draft_id", "module_id"],
            ["note_group_generation_drafts.id", "note_group_generation_drafts.module_id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["draft_id", "draft_study_card_id"],
            ["draft_study_cards.draft_id", "draft_study_cards.id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["draft_id", "draft_topic_id"],
            ["draft_topics.draft_id", "draft_topics.id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["module_id", "existing_topic_id"],
            ["topic_chips.module_id", "topic_chips.id"],
            ondelete="CASCADE",
        ),
    )

    id = Column(String, primary_key=True, default=_uuid)
    draft_id = Column(String, nullable=False, index=True)
    module_id = Column(String, nullable=False, index=True)
    draft_study_card_id = Column(String, nullable=False, index=True)
    draft_topic_id = Column(String, nullable=True, index=True)
    existing_topic_id = Column(String, nullable=True, index=True)
    role = Column(String, nullable=False, default="primary")

    draft_study_card = relationship("DraftStudyCard", back_populates="topic_links")
    draft_topic = relationship("DraftTopic", overlaps="draft_study_card,topic_links")
    existing_topic = relationship("TopicChip", foreign_keys=[module_id, existing_topic_id])


class DraftStudyCardKnowledgeNodeLink(Base):
    __tablename__ = "draft_study_card_knowledge_node_links"
    __table_args__ = (
        ForeignKeyConstraint(
            ["draft_id", "draft_study_card_id"],
            ["draft_study_cards.draft_id", "draft_study_cards.id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["draft_id", "draft_knowledge_node_id"],
            ["draft_knowledge_nodes.draft_id", "draft_knowledge_nodes.id"],
            ondelete="CASCADE",
        ),
    )

    id = Column(String, primary_key=True, default=_uuid)
    draft_id = Column(String, ForeignKey("note_group_generation_drafts.id", ondelete="CASCADE"), nullable=False, index=True)
    draft_study_card_id = Column(String, nullable=False, index=True)
    draft_knowledge_node_id = Column(String, nullable=False, index=True)
    role = Column(String, nullable=False, default="primary")

    draft_study_card = relationship(
        "DraftStudyCard",
        back_populates="knowledge_node_links",
        overlaps="study_card_links",
    )
    draft_knowledge_node = relationship(
        "DraftKnowledgeNode",
        back_populates="study_card_links",
        overlaps="draft_study_card,knowledge_node_links",
    )


class DraftMindMapRelation(Base):
    __tablename__ = "draft_mind_map_relations"
    __table_args__ = (
        CheckConstraint(_check_values("relation_type", MIND_MAP_RELATION_TYPES), name="ck_draft_mind_map_relations_type"),
        CheckConstraint(
            "source_draft_topic_id IS NULL OR target_draft_topic_id IS NULL OR source_draft_topic_id != target_draft_topic_id",
            name="ck_draft_mind_map_relations_no_self_draft_topic",
        ),
        CheckConstraint(
            "source_existing_topic_id IS NULL OR target_existing_topic_id IS NULL OR source_existing_topic_id != target_existing_topic_id",
            name="ck_draft_mind_map_relations_no_self_existing_topic",
        ),
        CheckConstraint(
            "source_draft_knowledge_node_id IS NULL OR target_draft_knowledge_node_id IS NULL OR source_draft_knowledge_node_id != target_draft_knowledge_node_id",
            name="ck_draft_mind_map_relations_no_self_knowledge_node",
        ),
        CheckConstraint(
            _exactly_one_not_null(
                "source_draft_topic_id",
                "source_existing_topic_id",
                "source_draft_knowledge_node_id",
            ),
            name="ck_draft_mind_map_relations_exactly_one_source",
        ),
        CheckConstraint(
            _exactly_one_not_null(
                "target_draft_topic_id",
                "target_existing_topic_id",
                "target_draft_knowledge_node_id",
            ),
            name="ck_draft_mind_map_relations_exactly_one_target",
        ),
        ForeignKeyConstraint(
            ["draft_id", "module_id"],
            ["note_group_generation_drafts.id", "note_group_generation_drafts.module_id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["draft_id", "source_draft_topic_id"],
            ["draft_topics.draft_id", "draft_topics.relation_endpoint_id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["module_id", "source_existing_topic_id"],
            ["topic_chips.module_id", "topic_chips.id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["draft_id", "source_draft_knowledge_node_id"],
            ["draft_knowledge_nodes.draft_id", "draft_knowledge_nodes.id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["draft_id", "target_draft_topic_id"],
            ["draft_topics.draft_id", "draft_topics.relation_endpoint_id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["module_id", "target_existing_topic_id"],
            ["topic_chips.module_id", "topic_chips.id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["draft_id", "target_draft_knowledge_node_id"],
            ["draft_knowledge_nodes.draft_id", "draft_knowledge_nodes.id"],
            ondelete="CASCADE",
        ),
    )

    id = Column(String, primary_key=True, default=_uuid)
    draft_id = Column(String, nullable=False, index=True)
    module_id = Column(String, nullable=False, index=True)
    source_draft_topic_id = Column(String, nullable=True, index=True)
    source_existing_topic_id = Column(String, nullable=True, index=True)
    source_draft_knowledge_node_id = Column(String, nullable=True, index=True)
    target_draft_topic_id = Column(String, nullable=True, index=True)
    target_existing_topic_id = Column(String, nullable=True, index=True)
    target_draft_knowledge_node_id = Column(String, nullable=True, index=True)
    relation_type = Column(String, nullable=False)
    label = Column(String)
    confidence = Column(Float)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    draft = relationship("NoteGroupGenerationDraft", back_populates="mind_map_relations")
    source_draft_topic = relationship(
        "DraftTopic",
        primaryjoin=lambda: and_(
            DraftMindMapRelation.draft_id == DraftTopic.draft_id,
            foreign(DraftMindMapRelation.source_draft_topic_id) == DraftTopic.relation_endpoint_id,
        ),
        foreign_keys=lambda: [DraftMindMapRelation.source_draft_topic_id],
    )
    source_existing_topic = relationship(
        "TopicChip",
        foreign_keys=[module_id, source_existing_topic_id],
        overlaps="draft,mind_map_relations",
    )
    source_draft_knowledge_node = relationship("DraftKnowledgeNode", foreign_keys=[source_draft_knowledge_node_id])
    target_draft_topic = relationship(
        "DraftTopic",
        primaryjoin=lambda: and_(
            DraftMindMapRelation.draft_id == DraftTopic.draft_id,
            foreign(DraftMindMapRelation.target_draft_topic_id) == DraftTopic.relation_endpoint_id,
        ),
        foreign_keys=lambda: [DraftMindMapRelation.target_draft_topic_id],
    )
    target_existing_topic = relationship(
        "TopicChip",
        foreign_keys=[module_id, target_existing_topic_id],
        overlaps="draft,mind_map_relations,source_existing_topic",
    )
    target_draft_knowledge_node = relationship("DraftKnowledgeNode", foreign_keys=[target_draft_knowledge_node_id])
