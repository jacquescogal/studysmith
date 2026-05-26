import json
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models import (
    DraftKnowledgeNode,
    DraftMindMapRelation,
    DraftNoteGroupTopicLink,
    DraftQuestionCard,
    DraftStudyCard,
    DraftStudyCardKnowledgeNodeLink,
    DraftStudyCardSourceRange,
    DraftStudyCardTopicLink,
    DraftTopic,
    JOB_STAGE_CLEANED_TEXT,
    JOB_STAGE_COMPLETE,
    JOB_STAGE_EMBEDDINGS,
    JOB_STAGE_FORMATTED_TEXT,
    JOB_STAGE_MIND_MAP_TOPICS,
    JOB_STAGE_PROMOTING,
    JOB_STAGE_QUESTION_CARDS,
    JOB_STAGE_QUEUED,
    JOB_STAGE_STUDY_CARDS,
    JOB_STAGE_TITLE,
    JOB_STAGE_TOPIC_KNOWLEDGE_NODES,
    Job,
    JobLog,
    JobStage,
    NoteGroup,
    NoteGroupGenerationDraft,
)


JOB_STAGE_SEQUENCE = [
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
]

JOB_STAGE_LABELS = {
    JOB_STAGE_QUEUED: "Queued",
    JOB_STAGE_TITLE: "Generate title",
    JOB_STAGE_CLEANED_TEXT: "Clean source text",
    JOB_STAGE_STUDY_CARDS: "Create Study Cards",
    JOB_STAGE_FORMATTED_TEXT: "Build reading view",
    JOB_STAGE_EMBEDDINGS: "Prepare Study Card embeddings",
    JOB_STAGE_QUESTION_CARDS: "Create Question Cards",
    JOB_STAGE_MIND_MAP_TOPICS: "Build Mind Map and Concepts",
    JOB_STAGE_TOPIC_KNOWLEDGE_NODES: "Build Concept Knowledge Nodes",
    JOB_STAGE_PROMOTING: "Publish Note Group",
    JOB_STAGE_COMPLETE: "Complete",
}

JOB_DELETE_REQUESTED_ERROR = "Generation deletion requested"
MODULE_WORKFLOW_JOB_STATUSES = ("queued", "running", "failed", "cancelled")
MODULE_WORKFLOW_JOB_TYPE = "NOTE_GROUP_AUTO_GENERATION"


def _publish_generation_event(db: Session, job: Job, event_type: str) -> None:
    try:
        from app.generation_events import publish_generation_event

        publish_generation_event(db, job, event_type)
    except Exception:
        pass


def publish_job_workflow_event(db: Session, job: Job, event_type: str) -> None:
    _publish_generation_event(db, job, event_type)


def _stage_label(stage: str) -> str:
    return JOB_STAGE_LABELS.get(stage, stage.replace("_", " ").title())


def _get_stage(db: Session, job: Job, stage: str) -> JobStage:
    stage_record = (
        db.query(JobStage)
        .filter(JobStage.job_id == job.id, JobStage.stage == stage)
        .one_or_none()
    )
    if not stage_record:
        raise ValueError(f"Job stage does not exist: {stage}")
    return stage_record


def _get_workflow_draft(db: Session, job: Job) -> Optional[NoteGroupGenerationDraft]:
    draft = (
        db.query(NoteGroupGenerationDraft)
        .filter(NoteGroupGenerationDraft.job_id == job.id)
        .one_or_none()
    )
    if draft is not None:
        job.generation_draft = draft
    return draft


def _get_or_create_draft(
    db: Session,
    job: Job,
    raw_text: str,
    unique_id: Optional[str],
    additional_instructions: Optional[str],
) -> NoteGroupGenerationDraft:
    draft = (
        db.query(NoteGroupGenerationDraft)
        .filter(NoteGroupGenerationDraft.job_id == job.id)
        .one_or_none()
    )
    if draft:
        return draft
    if not job.note_group:
        raise ValueError("Job must be attached to a Note Group")
    draft = NoteGroupGenerationDraft(
        job_id=job.id,
        module_id=job.note_group.module_id,
        note_group_id=job.note_group_id,
        raw_text=raw_text,
        unique_id=unique_id,
        additional_generation_instructions=additional_instructions,
        current_stage=JOB_STAGE_QUEUED,
    )
    db.add(draft)
    job.generation_draft = draft
    db.flush()
    return draft


def _ensure_stage_records(db: Session, job: Job) -> None:
    existing_stages = {
        stage.stage: stage
        for stage in db.query(JobStage).filter(JobStage.job_id == job.id).all()
    }
    now = datetime.utcnow()
    for sort_order, stage in enumerate(JOB_STAGE_SEQUENCE):
        if stage in existing_stages:
            continue
        status = "pending"
        started_at = None
        finished_at = None
        if stage == JOB_STAGE_QUEUED:
            status = "succeeded"
            started_at = now
            finished_at = now
        db.add(
            JobStage(
                job_id=job.id,
                stage=stage,
                sort_order=sort_order,
                status=status,
                started_at=started_at,
                finished_at=finished_at,
            )
        )
    db.flush()


def initialize_job_workflow(
    db: Session,
    job: Job,
    raw_text: str,
    unique_id: Optional[str],
    additional_instructions: Optional[str],
) -> NoteGroupGenerationDraft:
    draft = _get_or_create_draft(db, job, raw_text, unique_id, additional_instructions)
    _ensure_stage_records(db, job)
    queued_log_exists = (
        db.query(JobLog)
        .filter(JobLog.job_id == job.id, JobLog.stage == JOB_STAGE_QUEUED)
        .first()
        is not None
    )
    if not queued_log_exists:
        append_job_log(db, job, JOB_STAGE_QUEUED, "Generation queued")
    db.flush()
    _publish_generation_event(db, job, "workflow_initialized")
    return draft


def start_job_stage(db: Session, job: Job, stage: str) -> JobStage:
    db.refresh(job)
    if job.status == "cancelled":
        raise ValueError("Job is cancelled")
    stage_record = _get_stage(db, job, stage)
    now = datetime.utcnow()
    job.status = "running"
    job.error = None
    draft = _get_workflow_draft(db, job)
    if draft:
        draft.current_stage = stage
    stage_record.status = "running"
    stage_record.error = None
    stage_record.finished_at = None
    if not stage_record.started_at:
        stage_record.started_at = now
    append_job_log(db, job, stage, f"{_stage_label(stage)} started")
    db.flush()
    _publish_generation_event(db, job, "stage_started")
    return stage_record


def succeed_job_stage(
    db: Session,
    job: Job,
    stage: str,
    message: Optional[str] = None,
    progress_current: Optional[int] = None,
    progress_total: Optional[int] = None,
) -> JobStage:
    stage_record = _get_stage(db, job, stage)
    now = datetime.utcnow()
    draft = _get_workflow_draft(db, job)
    if draft:
        draft.current_stage = stage
    stage_record.status = "succeeded"
    stage_record.error = None
    stage_record.finished_at = now
    if not stage_record.started_at:
        stage_record.started_at = now
    if progress_current is not None:
        stage_record.progress_current = progress_current
    if progress_total is not None:
        stage_record.progress_total = progress_total
    if stage == JOB_STAGE_COMPLETE:
        job.status = "completed"
    if message:
        append_job_log(db, job, stage, message)
    db.flush()
    _publish_generation_event(db, job, "stage_succeeded")
    return stage_record


def fail_job_stage(db: Session, job: Job, stage: str, error: str) -> JobStage:
    stage_record = _get_stage(db, job, stage)
    now = datetime.utcnow()
    job.status = "failed"
    job.error = error
    draft = _get_workflow_draft(db, job)
    if draft:
        draft.current_stage = stage
    stage_record.status = "failed"
    stage_record.error = error
    stage_record.finished_at = now
    if not stage_record.started_at:
        stage_record.started_at = now
    append_job_log(db, job, stage, error, {"level": "error"})
    db.flush()
    _publish_generation_event(db, job, "stage_failed")
    return stage_record


def cancel_job_workflow(db: Session, job: Job, message: str) -> None:
    job.status = "cancelled"
    job.error = message
    if job.note_group:
        job.note_group.generation_status = "cancelled"
    draft = _get_workflow_draft(db, job)
    if draft:
        running_stage = next((stage for stage in job.stages if stage.status == "running"), None)
        if running_stage:
            draft.current_stage = running_stage.stage
    now = datetime.utcnow()
    for stage_record in job.stages:
        was_running = stage_record.status == "running"
        if stage_record.status in {"pending", "running"}:
            stage_record.status = "cancelled"
            stage_record.finished_at = now
            if stage_record.started_at is None and was_running:
                stage_record.started_at = now
    append_job_log(db, job, job.current_stage, message, {"level": "warning"})
    db.flush()
    _publish_generation_event(db, job, "workflow_cancelled")


def append_job_log(
    db: Session,
    job: Job,
    stage: Optional[str],
    message: str,
    metadata: Optional[dict[str, Any]] = None,
) -> JobLog:
    log = JobLog(
        job_id=job.id,
        stage=stage,
        message=message,
        metadata_json=json.dumps(metadata or {}, default=str),
    )
    db.add(log)
    db.flush()
    return log


def set_stage_progress(
    db: Session,
    job: Job,
    stage: str,
    current: int,
    total: int,
    message: Optional[str] = None,
) -> JobStage:
    stage_record = _get_stage(db, job, stage)
    stage_record.progress_current = current
    stage_record.progress_total = total
    if message:
        append_job_log(db, job, stage, message, {"progress_current": current, "progress_total": total})
    db.flush()
    _publish_generation_event(db, job, "stage_progress")
    return stage_record


def _datetime_value(value: Optional[datetime]) -> Optional[datetime]:
    if value and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _serialize_note_group(note_group) -> Optional[dict[str, Any]]:
    if note_group is None:
        return None
    return {
        "id": note_group.id,
        "short_code": note_group.short_code or note_group.id,
        "module_id": note_group.module_id,
        "subject_id": note_group.module.subject_id if note_group.module else None,
        "title": note_group.title,
        "source": note_group.source,
        "additional_generation_instructions": note_group.additional_generation_instructions,
        "raw_text": note_group.raw_text,
        "cleaned_text_markdown": note_group.cleaned_text_markdown,
        "formatted_text": note_group.formatted_text,
        "formatted_sections": note_group.formatted_sections,
        "generation_status": note_group.generation_status,
        "created_at": _datetime_value(note_group.created_at),
        "sort_order": note_group.sort_order,
        "mind_map_status": note_group.mind_map_status,
        "mind_map_stale": note_group.mind_map_stale,
        "mind_map_generated_at": _datetime_value(note_group.mind_map_generated_at),
        "topic_chips": [],
        "suggested_titles": note_group.suggested_titles,
    }


def serialize_generation_workflow(db: Session, job: Job) -> dict[str, Any]:
    db.flush()
    draft = _get_workflow_draft(db, job)
    stages = (
        db.query(JobStage)
        .filter(JobStage.job_id == job.id)
        .order_by(JobStage.sort_order.asc(), JobStage.created_at.asc())
        .all()
    )
    logs = (
        db.query(JobLog)
        .filter(JobLog.job_id == job.id)
        .order_by(JobLog.created_at.asc(), JobLog.id.asc())
        .all()
    )
    return {
        "job": {
            "id": job.id,
            "type": job.type,
            "status": job.status,
            "note_group_id": job.note_group_id,
            "error": job.error,
            "current_stage": job.current_stage,
            "stage_status": job.stage_status,
            "progress_current": job.progress_current,
            "progress_total": job.progress_total,
        },
        "note_group": _serialize_note_group(job.note_group),
        "draft_title": draft.title if draft else None,
        "current_stage": draft.current_stage if draft else job.current_stage,
        "stages": [
            {
                "stage": stage.stage,
                "status": stage.status,
                "started_at": _datetime_value(stage.started_at),
                "finished_at": _datetime_value(stage.finished_at),
                "error": stage.error,
                "progress_current": stage.progress_current,
                "progress_total": stage.progress_total,
            }
            for stage in stages
        ],
        "logs": [
            {
                "id": log.id,
                "stage": log.stage,
                "message": log.message,
                "metadata": log.metadata_dict,
                "created_at": _datetime_value(log.created_at),
            }
            for log in logs
        ],
    }


def serialize_module_generation_workflow_snapshot(db: Session, module_id: str) -> dict[str, Any]:
    jobs = (
        db.query(Job)
        .join(NoteGroup, Job.note_group_id == NoteGroup.id)
        .filter(
            Job.type == MODULE_WORKFLOW_JOB_TYPE,
            Job.status.in_(MODULE_WORKFLOW_JOB_STATUSES),
            NoteGroup.module_id == module_id,
        )
        .order_by(Job.created_at.desc())
        .all()
    )
    return {
        "module_id": module_id,
        "jobs": [serialize_generation_workflow(db, job) for job in jobs],
    }


def delete_job_and_draft(db: Session, job: Job) -> None:
    db.delete(job)
    db.flush()


def delete_unfinished_job_workflow(db: Session, job: Job) -> None:
    note_group = job.note_group
    if job.status == "completed":
        raise ValueError("Completed jobs cannot be deleted")
    if note_group and note_group.generation_status == "complete":
        raise ValueError("Completed Note Groups cannot be deleted by job workflow cleanup")
    _publish_generation_event(db, job, "workflow_deleted")
    delete_job_and_draft(db, job)
    if note_group is not None:
        db.delete(note_group)
    db.flush()


def request_unfinished_job_delete(db: Session, job: Job) -> bool:
    if job.error == JOB_DELETE_REQUESTED_ERROR:
        return False
    if job.status == "running":
        cancel_job_workflow(db, job, JOB_DELETE_REQUESTED_ERROR)
        return False
    delete_unfinished_job_workflow(db, job)
    return True


def _clear_draft_question_card_artifacts(db: Session, draft: NoteGroupGenerationDraft) -> None:
    db.query(DraftQuestionCard).filter(DraftQuestionCard.draft_id == draft.id).delete(
        synchronize_session=False
    )


def _clear_draft_topic_artifacts(db: Session, draft: NoteGroupGenerationDraft) -> None:
    db.query(DraftMindMapRelation).filter(DraftMindMapRelation.draft_id == draft.id).delete(
        synchronize_session=False
    )
    db.query(DraftStudyCardKnowledgeNodeLink).filter(
        DraftStudyCardKnowledgeNodeLink.draft_id == draft.id
    ).delete(synchronize_session=False)
    db.query(DraftStudyCardTopicLink).filter(
        DraftStudyCardTopicLink.draft_id == draft.id
    ).delete(synchronize_session=False)
    db.query(DraftNoteGroupTopicLink).filter(
        DraftNoteGroupTopicLink.draft_id == draft.id
    ).delete(synchronize_session=False)
    db.query(DraftKnowledgeNode).filter(DraftKnowledgeNode.draft_id == draft.id).delete(
        synchronize_session=False
    )
    db.query(DraftTopic).filter(DraftTopic.draft_id == draft.id).delete(
        synchronize_session=False
    )


def _clear_draft_knowledge_node_artifacts(db: Session, draft: NoteGroupGenerationDraft) -> None:
    db.query(DraftMindMapRelation).filter(
        DraftMindMapRelation.draft_id == draft.id,
        (
            (DraftMindMapRelation.source_draft_knowledge_node_id.isnot(None))
            | (DraftMindMapRelation.target_draft_knowledge_node_id.isnot(None))
        ),
    ).delete(synchronize_session=False)
    db.query(DraftStudyCardKnowledgeNodeLink).filter(
        DraftStudyCardKnowledgeNodeLink.draft_id == draft.id
    ).delete(synchronize_session=False)
    db.query(DraftKnowledgeNode).filter(DraftKnowledgeNode.draft_id == draft.id).delete(
        synchronize_session=False
    )
    db.query(DraftTopic).filter(DraftTopic.draft_id == draft.id).update(
        {
            DraftTopic.knowledge_node_status: "not_generated",
            DraftTopic.knowledge_node_review_reason: None,
        },
        synchronize_session=False,
    )


def clear_draft_after_stage(db: Session, draft: NoteGroupGenerationDraft, failed_stage: str) -> None:
    if failed_stage not in JOB_STAGE_SEQUENCE:
        raise ValueError(f"Unknown failed stage: {failed_stage}")
    failed_index = JOB_STAGE_SEQUENCE.index(failed_stage)
    stages_to_reset = set(JOB_STAGE_SEQUENCE[failed_index:])
    now = datetime.utcnow()
    if failed_index <= JOB_STAGE_SEQUENCE.index(JOB_STAGE_TITLE):
        draft.title = None
        draft.suggested_titles_json = None
    if failed_index <= JOB_STAGE_SEQUENCE.index(JOB_STAGE_CLEANED_TEXT):
        draft.cleaned_text_markdown = None
    if failed_index <= JOB_STAGE_SEQUENCE.index(JOB_STAGE_FORMATTED_TEXT):
        draft.formatted_sections_json = None
        draft.formatted_text = None
    if failed_index <= JOB_STAGE_SEQUENCE.index(JOB_STAGE_STUDY_CARDS):
        draft_study_card_ids = [
            row[0]
            for row in db.query(DraftStudyCard.id)
            .filter(DraftStudyCard.draft_id == draft.id)
            .all()
        ]
        if draft_study_card_ids:
            db.query(DraftStudyCardSourceRange).filter(
                DraftStudyCardSourceRange.draft_study_card_id.in_(draft_study_card_ids)
            ).delete(synchronize_session=False)
        db.query(DraftStudyCard).filter(DraftStudyCard.draft_id == draft.id).delete(
            synchronize_session=False
        )
    if failed_index <= JOB_STAGE_SEQUENCE.index(JOB_STAGE_EMBEDDINGS):
        db.query(DraftStudyCard).filter(DraftStudyCard.draft_id == draft.id).update(
            {DraftStudyCard.embedding_json: None},
            synchronize_session=False,
        )
    if failed_index <= JOB_STAGE_SEQUENCE.index(JOB_STAGE_QUESTION_CARDS):
        _clear_draft_question_card_artifacts(db, draft)
    if failed_index <= JOB_STAGE_SEQUENCE.index(JOB_STAGE_MIND_MAP_TOPICS):
        _clear_draft_topic_artifacts(db, draft)
    elif failed_index <= JOB_STAGE_SEQUENCE.index(JOB_STAGE_TOPIC_KNOWLEDGE_NODES):
        _clear_draft_knowledge_node_artifacts(db, draft)

    for stage_record in draft.job.stages:
        if stage_record.stage not in stages_to_reset:
            continue
        stage_record.status = "pending"
        stage_record.started_at = None
        stage_record.finished_at = None
        stage_record.error = None
        stage_record.progress_current = None
        stage_record.progress_total = None
        stage_record.updated_at = now
    if stages_to_reset:
        db.query(JobLog).filter(
            JobLog.job_id == draft.job_id,
            JobLog.stage.in_(stages_to_reset),
        ).delete(synchronize_session=False)
    db.flush()


def retry_failed_job_stage(
    db: Session,
    job: Job,
    retry_stage: Optional[str] = None,
) -> Job:
    if job.status != "failed":
        raise ValueError("Job is not retryable")
    draft = _get_workflow_draft(db, job)
    if draft is None:
        raise ValueError("Job has no generation draft")
    stage = retry_stage or draft.current_stage or job.current_stage
    if not stage:
        raise ValueError("Job has no failed stage to retry")
    stage_record = _get_stage(db, job, stage)
    if stage_record.status != "failed":
        raise ValueError("Only failed stages can be retried")
    if job.note_group and job.note_group.generation_status == "complete":
        raise ValueError("Completed Note Groups cannot be retried")

    clear_draft_after_stage(db, draft, stage)
    draft.current_stage = stage
    job.status = "queued"
    job.error = None
    if job.note_group:
        job.note_group.generation_status = "queued"
    append_job_log(db, job, JOB_STAGE_QUEUED, f"Retry queued from {_stage_label(stage)}")
    db.flush()
    _publish_generation_event(db, job, "workflow_retry_queued")
    return job
