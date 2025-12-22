from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


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


class ModuleUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


class ModuleOut(BaseModel):
    id: str
    subject_id: str
    title: str
    description: Optional[str] = None

    class Config:
        orm_mode = True


class NoteGroupCreate(BaseModel):
    raw_text: str
    title: Optional[str] = None


class NoteGroupOut(BaseModel):
    id: str
    module_id: str
    title: Optional[str] = None
    raw_text: str
    generation_status: str
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


class TopicChipOut(BaseModel):
    id: str
    module_id: str
    label: str

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
    stale: bool
    due_at: Optional[datetime] = None
    last_review_at: Optional[datetime] = None


class QuestionCardList(BaseModel):
    question_cards: List[QuestionCardOut]


class QuestionCardGenerate(BaseModel):
    count: Optional[int] = 6
    difficulty: Optional[str] = "mixed"


class ChatRequest(BaseModel):
    module_id: str
    message: str
    note_group_id: Optional[str] = None


class ChatResponse(BaseModel):
    answer: str
    study_card_refs: List[str]


NoteGroupOut.update_forward_refs()
StudyCardOut.update_forward_refs()


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


class QuestionCardUpdate(BaseModel):
    type: Optional[str] = None
    prompt: Optional[str] = None
    options: Optional[List[str]] = None
    correct_option_indices: Optional[List[int]] = None
    study_card_refs: Optional[List[str]] = None


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


class NoteGroupFinalizeRequest(BaseModel):
    module_id: str
    raw_text: str
    title: str
    existing_chip_ids: List[str] = []
    new_chip_labels: List[str] = []


class NoteGroupFinalizeResponse(BaseModel):
    note_group: NoteGroupOut
    study_cards: List[StudyCardOut]
