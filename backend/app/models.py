import json
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
)
from sqlalchemy.orm import relationship

from app.db import Base

DEFAULT_MODULE_SETTINGS = {
    "auto_question_count": 30,
    "additional_generation_instructions": "",
}


def _uuid() -> str:
    return str(uuid.uuid4())


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


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(String, primary_key=True, default=_uuid)
    title = Column(String, nullable=False, unique=True)
    description = Column(Text)
    goal = Column(Text, nullable=True)
    scope = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

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


class TopicChip(Base):
    __tablename__ = "topic_chips"

    id = Column(String, primary_key=True, default=_uuid)
    module_id = Column(String, ForeignKey("modules.id"), nullable=False)
    label = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    module = relationship("Module", back_populates="topic_chips")
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


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String, primary_key=True, default=_uuid)
    type = Column(String, nullable=False)
    status = Column(String, default="queued")
    note_group_id = Column(String, ForeignKey("note_groups.id"))
    payload_json = Column(Text)
    error = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    note_group = relationship("NoteGroup", back_populates="jobs")
