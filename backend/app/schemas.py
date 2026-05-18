from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class SubjectCreate(BaseModel):
    title: str
    description: Optional[str] = None
    goal: Optional[str] = None
    scope: Optional[str] = None


class SubjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    goal: Optional[str] = None
    scope: Optional[str] = None


class SubjectOut(BaseModel):
    id: str
    short_code: str
    title: str
    description: Optional[str] = None
    goal: Optional[str] = None
    scope: Optional[str] = None

    class Config:
        from_attributes = True


class ModuleCreate(BaseModel):
    title: str
    description: Optional[str] = None
    goal: Optional[str] = None
    scope: Optional[str] = None


class ModuleUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    goal: Optional[str] = None
    scope: Optional[str] = None
    settings: Optional[dict] = None


class ModuleOut(BaseModel):
    id: str
    short_code: str
    subject_id: str
    title: str
    description: Optional[str] = None
    goal: Optional[str] = None
    scope: Optional[str] = None
    settings: dict = Field(default_factory=dict)

    class Config:
        from_attributes = True


class NoteGroupSectionOut(BaseModel):
    study_card_id: str
    title: str
    content: str
    anchor: str


class NoteGroupOut(BaseModel):
    id: str
    short_code: str
    module_id: str
    subject_id: Optional[str] = None
    title: Optional[str] = None
    source: Optional[str] = None
    additional_generation_instructions: Optional[str] = None
    raw_text: str
    cleaned_text_markdown: Optional[str] = None
    formatted_text: Optional[str] = None
    formatted_sections: List["NoteGroupSectionOut"] = []
    generation_status: str
    created_at: datetime
    sort_order: Optional[int] = None
    topic_chips: List["TopicChipOut"] = []
    suggested_titles: List[str] = []

    class Config:
        from_attributes = True


class StudyCardSourceRangeOut(BaseModel):
    start_index: int
    end_index: int

    class Config:
        from_attributes = True


class StudyCardOut(BaseModel):
    id: str
    note_group_id: str
    title: Optional[str] = None
    content: str
    topic_chips: List["TopicChipOut"] = []
    source_ranges: List["StudyCardSourceRangeOut"] = []

    class Config:
        from_attributes = True


class TopicChipCreate(BaseModel):
    label: str
    description: Optional[str] = None


class TopicChipOut(BaseModel):
    id: str
    module_id: str
    label: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class TopicChipAttach(BaseModel):
    chip_ids: List[str]


class QuestionCardOut(BaseModel):
    id: str
    note_group_id: str
    type: str
    prompt: str
    options: List[str]
    correct_option_indices: List[int]
    study_card_refs: List[str]
    option_explanations: List[str] = []
    stale: bool
    due_at: Optional[datetime] = None
    last_review_at: Optional[datetime] = None
    stability: Optional[float] = None
    difficulty: Optional[float] = None
    elapsed_days: Optional[int] = None
    scheduled_days: Optional[int] = None
    reps: Optional[int] = None
    lapses: Optional[int] = None
    state: Optional[int] = None
    step: Optional[int] = None


class QuestionCardList(BaseModel):
    question_cards: List[QuestionCardOut]


class QuestionCardGenerate(BaseModel):
    difficulty: Optional[str] = "mixed"


class QuestionTimelineOut(BaseModel):
    due: int
    week: int
    month: int
    six_months: int
    long_term: int


class QuestionTimelineResponse(BaseModel):
    timeline: QuestionTimelineOut
    question_count: int
    stale_count: int


class ModuleOverviewStatsOut(BaseModel):
    study_count: int
    question_count: int
    due_count: int
    stale_count: int


class NoteGroupOverviewOut(BaseModel):
    id: str
    title: Optional[str] = None
    study_count: int
    question_count: int
    due_count: int
    stale_count: int
    timeline: QuestionTimelineOut


class ModuleOverviewResponse(BaseModel):
    note_groups: List[NoteGroupOut]
    note_group_stats: List[NoteGroupOverviewOut]
    module_stats: ModuleOverviewStatsOut
    module_timeline: QuestionTimelineOut


class AppRouteContext(BaseModel):
    subject_id: str
    subject_short_code: str
    module_id: Optional[str] = None
    module_short_code: Optional[str] = None
    note_group_id: Optional[str] = None
    note_group_short_code: Optional[str] = None


class ChatRequest(BaseModel):
    module_id: str
    message: str
    note_group_id: Optional[str] = None
    question_prompt: Optional[str] = None
    user_answer: Optional[str] = None
    correct_answer: Optional[str] = None
    history: Optional[List["ChatHistoryItem"]] = None


class ChatHistoryItem(BaseModel):
    role: str
    content: str


class ChatResponse(BaseModel):
    answer: str
    study_card_refs: List[str]


class IntentChatMessage(BaseModel):
    role: str
    content: str


class IntentChatRequest(BaseModel):
    message: str
    history: Optional[List[IntentChatMessage]] = None
    current_title: Optional[str] = None
    current_goal: Optional[str] = None
    current_scope: Optional[str] = None
    subject_title: Optional[str] = None
    subject_goal: Optional[str] = None
    subject_scope: Optional[str] = None


class SubjectIntentChatPayload(BaseModel):
    message: str
    history: Optional[List[IntentChatMessage]] = None
    current_title: Optional[str] = None
    current_goal: Optional[str] = None
    current_scope: Optional[str] = None


class IntentChatResponse(BaseModel):
    assistant_message: str
    title: Optional[str] = None
    goal: Optional[str] = None
    scope: Optional[str] = None


NoteGroupOut.update_forward_refs()
StudyCardOut.update_forward_refs()
StudyCardSourceRangeOut.update_forward_refs()
ChatRequest.update_forward_refs()


class JobOut(BaseModel):
    id: str
    type: str
    status: str
    note_group_id: Optional[str] = None
    error: Optional[str] = None

    class Config:
        from_attributes = True


class StudyCardCreate(BaseModel):
    title: Optional[str] = None
    content: str
    chip_ids: Optional[List[str]] = None


class StudyCardUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    chip_ids: Optional[List[str]] = None


class StudyCardList(BaseModel):
    study_cards: List[StudyCardOut]


class QuestionCardCreate(BaseModel):
    type: str
    prompt: str
    options: List[str]
    correct_option_indices: List[int]
    study_card_refs: List[str]
    option_explanations: Optional[List[str]] = None


class QuestionCardUpdate(BaseModel):
    type: Optional[str] = None
    prompt: Optional[str] = None
    options: Optional[List[str]] = None
    correct_option_indices: Optional[List[int]] = None
    study_card_refs: Optional[List[str]] = None
    option_explanations: Optional[List[str]] = None


class QuestionCardReview(BaseModel):
    correct: bool
    response_time_ms: int


class StudyCardReview(BaseModel):
    irrelevant_ids: List[str]


class StudyCardReviewResult(BaseModel):
    deleted: int


class NoteGroupTitleUpdate(BaseModel):
    title: str


class NoteGroupSourceCheckRequest(BaseModel):
    source: str


class NoteGroupSourceMatch(BaseModel):
    id: str
    module_id: str
    title: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class NoteGroupSourceCheckResponse(BaseModel):
    normalized: str
    duplicates: List[NoteGroupSourceMatch] = []


class NoteGroupAutoRequest(BaseModel):
    module_id: str
    raw_text: str
    source: str
    additional_generation_instructions: Optional[str] = None


class NoteGroupOrderUpdate(BaseModel):
    note_group_ids: List[str]
