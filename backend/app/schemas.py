from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class SubjectCreate(BaseModel):
    title: str
    description: Optional[str] = None


class SubjectOut(BaseModel):
    id: str
    title: str
    description: Optional[str] = None

    class Config:
        orm_mode = True


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
    subject_id: str
    title: str
    description: Optional[str] = None
    goal: Optional[str] = None
    scope: Optional[str] = None
    settings: dict = Field(default_factory=dict)

    class Config:
        orm_mode = True


class NoteGroupCreate(BaseModel):
    raw_text: str
    title: Optional[str] = None


class NoteGroupSectionOut(BaseModel):
    study_card_id: str
    title: str
    content: str
    anchor: str


class NoteGroupOut(BaseModel):
    id: str
    module_id: str
    title: Optional[str] = None
    source: Optional[str] = None
    additional_generation_instructions: Optional[str] = None
    raw_text: str
    formatted_text: Optional[str] = None
    formatted_sections: List["NoteGroupSectionOut"] = []
    generation_status: str
    created_at: datetime
    sort_order: Optional[int] = None
    topic_chips: List["TopicChipOut"] = []
    suggested_titles: List[str] = []

    class Config:
        orm_mode = True


class StudyCardOut(BaseModel):
    id: str
    note_group_id: str
    title: Optional[str] = None
    content: str
    topic_chips: List["TopicChipOut"] = []

    class Config:
        orm_mode = True


class TopicChipCreate(BaseModel):
    label: str
    description: Optional[str] = None


class TopicChipOut(BaseModel):
    id: str
    module_id: str
    label: str
    description: Optional[str] = None

    class Config:
        orm_mode = True


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
    count: Optional[int] = 6
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


class IntentChatResponse(BaseModel):
    assistant_message: str
    title: Optional[str] = None
    goal: Optional[str] = None
    scope: Optional[str] = None


NoteGroupOut.update_forward_refs()
StudyCardOut.update_forward_refs()
ChatRequest.update_forward_refs()


class JobOut(BaseModel):
    id: str
    type: str
    status: str
    note_group_id: Optional[str] = None
    error: Optional[str] = None

    class Config:
        orm_mode = True


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


class NoteGroupTitleSuggestionsRequest(BaseModel):
    module_id: str
    raw_text: str


class NoteGroupTitleSuggestionsResponse(BaseModel):
    titles: List[str]


class NoteGroupTopicChipSuggestRequest(BaseModel):
    module_id: str
    raw_text: str


class NoteGroupTopicChipSuggestResponse(BaseModel):
    suggested_existing_ids: List[str]
    new_chips: List[str]


class NoteGroupSourceCheckRequest(BaseModel):
    source: str


class NoteGroupSourceMatch(BaseModel):
    id: str
    module_id: str
    title: Optional[str] = None
    created_at: datetime

    class Config:
        orm_mode = True


class NoteGroupSourceCheckResponse(BaseModel):
    normalized: str
    duplicates: List[NoteGroupSourceMatch] = []


class NoteGroupFinalizeRequest(BaseModel):
    module_id: str
    raw_text: str
    title: str
    source: str
    additional_generation_instructions: Optional[str] = None
    existing_chip_ids: List[str] = []
    new_chip_labels: List[str] = []


class NoteGroupFinalizeResponse(BaseModel):
    note_group: NoteGroupOut
    study_cards: List[StudyCardOut]


class NoteGroupAutoRequest(BaseModel):
    module_id: str
    raw_text: str
    source: str
    question_count: Optional[int] = None
    additional_generation_instructions: Optional[str] = None


class NoteGroupOrderUpdate(BaseModel):
    note_group_ids: List[str]
