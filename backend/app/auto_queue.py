from collections import deque
from threading import Condition, Thread

from app.db import SessionLocal
from app.jobs import JOB_TYPE_NOTE_GROUP_AUTO_GENERATION, run_auto_note_group_generation
from app.models import Job, Module, NoteGroup

_queue: deque[str] = deque()
_queue_set: set[str] = set()
_condition = Condition()
_started = False
_worker_thread: Thread | None = None


def start_auto_worker() -> None:
    global _started, _worker_thread
    if _started and _worker_thread is not None and _worker_thread.is_alive():
        return
    _started = True
    _worker_thread = Thread(target=_worker_loop, daemon=True)
    _worker_thread.start()


def resume_auto_jobs() -> None:
    db = SessionLocal()
    try:
        jobs = (
            db.query(Job)
            .filter(
                Job.type == JOB_TYPE_NOTE_GROUP_AUTO_GENERATION,
                Job.status.in_(["queued", "running"]),
            )
            .order_by(Job.created_at.asc())
            .all()
        )
        for job in jobs:
            if job.status == "running":
                job.status = "queued"
        db.commit()
        for job in jobs:
            enqueue_auto_job(job.id)
    finally:
        db.close()


def enqueue_auto_job(job_id: str) -> bool:
    with _condition:
        added = _enqueue_auto_job_unlocked(job_id)
        if added:
            _condition.notify()
        return added


def _enqueue_auto_job_unlocked(job_id: str) -> bool:
    if job_id in _queue_set:
        return False
    _queue.append(job_id)
    _queue_set.add(job_id)
    return True


def remove_auto_job(job_id: str) -> bool:
    with _condition:
        if job_id not in _queue_set:
            return False
        _queue_set.remove(job_id)
        try:
            _queue.remove(job_id)
        except ValueError:
            return False
    return True


def _has_active_module_auto_job(db, job: Job) -> bool:
    note_group = job.note_group
    if note_group is None:
        return False
    return (
        db.query(Job.id)
        .join(NoteGroup, Job.note_group_id == NoteGroup.id)
        .filter(
            Job.id != job.id,
            Job.type == JOB_TYPE_NOTE_GROUP_AUTO_GENERATION,
            Job.status == "running",
            NoteGroup.module_id == note_group.module_id,
        )
        .first()
        is not None
    )


def _claim_auto_job(db, job: Job) -> bool:
    note_group = job.note_group
    if note_group is None:
        return False
    db.query(Module).filter(Module.id == note_group.module_id).with_for_update().one_or_none()
    db.refresh(job)
    if job.status in {"cancelled", "failed", "completed"}:
        return False
    if _has_active_module_auto_job(db, job):
        if job.status != "queued":
            job.status = "queued"
        if job.note_group and job.note_group.generation_status == "generating":
            job.note_group.generation_status = "queued"
        db.commit()
        return False
    job.status = "running"
    if job.note_group and job.note_group.generation_status != "complete":
        job.note_group.generation_status = "generating"
    db.commit()
    return True


def _pop_queued_job(wait: bool) -> str | None:
    with _condition:
        if not wait and not _queue:
            return None
        while wait and not _queue:
            _condition.wait()
        if not _queue:
            return None
        job_id = _queue.popleft()
        _queue_set.discard(job_id)
        return job_id


def _requeue_deferred(job_ids: list[str]) -> None:
    for job_id in job_ids:
        enqueue_auto_job(job_id)


def _enqueue_persisted_queued_jobs() -> None:
    db = SessionLocal()
    try:
        job_ids = [
            row[0]
            for row in (
                db.query(Job.id)
                .filter(
                    Job.type == JOB_TYPE_NOTE_GROUP_AUTO_GENERATION,
                    Job.status == "queued",
                )
                .order_by(Job.created_at.asc())
                .all()
            )
        ]
    finally:
        db.close()

    if not job_ids:
        return
    with _condition:
        for job_id in job_ids:
            _enqueue_auto_job_unlocked(job_id)
        _condition.notify_all()


def _dequeue_next_runnable_job(wait: bool = True) -> str | None:
    deferred_job_ids: list[str] = []
    first_pass = True
    while True:
        with _condition:
            queue_empty = not _queue
        if first_pass and queue_empty:
            _enqueue_persisted_queued_jobs()
        job_id = _pop_queued_job(wait if first_pass else False)
        first_pass = False
        if not job_id:
            _requeue_deferred(deferred_job_ids)
            return None

        should_requeue = False
        claimed = False
        db = SessionLocal()
        try:
            job = db.get(Job, job_id)
            if not job:
                continue
            if job.type != JOB_TYPE_NOTE_GROUP_AUTO_GENERATION:
                continue
            if job.status in {"cancelled", "failed", "completed"}:
                continue
            claimed = _claim_auto_job(db, job)
            should_requeue = not claimed and job.status == "queued"
        finally:
            db.close()

        if claimed:
            _requeue_deferred(deferred_job_ids)
            return job_id
        if should_requeue:
            deferred_job_ids.append(job_id)


def _worker_loop() -> None:
    while True:
        job_id = _dequeue_next_runnable_job(wait=False)
        if not job_id:
            with _condition:
                _condition.wait(timeout=0.25)
            continue

        try:
            run_auto_note_group_generation(job_id)
        except Exception:
            continue
