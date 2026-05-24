import json
from datetime import datetime
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models import (
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
    JOB_STAGE_MIND_MAP_TOPICS: "Build Mind Map and Topics",
    JOB_STAGE_TOPIC_KNOWLEDGE_NODES: "Build Topic Knowledge Nodes",
    JOB_STAGE_PROMOTING: "Publish Note Group",
    JOB_STAGE_COMPLETE: "Complete",
}


def _publish_generation_event(db: Session, job: Job, event_type: str) -> None:
    try:
        from app.generation_events import publish_generation_event

        publish_generation_event(db, job, event_type)
    except Exception:
        pass


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


def delete_job_and_draft(db: Session, job: Job) -> None:
    db.delete(job)
    db.flush()


def clear_draft_after_stage(db: Session, draft: NoteGroupGenerationDraft, failed_stage: str) -> None:
    if failed_stage not in JOB_STAGE_SEQUENCE:
        raise ValueError(f"Unknown failed stage: {failed_stage}")
    failed_index = JOB_STAGE_SEQUENCE.index(failed_stage)
    later_stages = set(JOB_STAGE_SEQUENCE[failed_index + 1 :])
    now = datetime.utcnow()
    for stage_record in draft.job.stages:
        if stage_record.stage not in later_stages:
            continue
        stage_record.status = "pending"
        stage_record.started_at = None
        stage_record.finished_at = None
        stage_record.error = None
        stage_record.progress_current = None
        stage_record.progress_total = None
        stage_record.updated_at = now
    if later_stages:
        db.query(JobLog).filter(
            JobLog.job_id == draft.job_id,
            JobLog.stage.in_(later_stages),
        ).delete(synchronize_session=False)
    # Draft content clearing is stage-specific and will be added when later stages
    # own the draft artifacts they need to invalidate.
    db.flush()
