import json
from collections import deque
from threading import Condition, Thread

from app.db import SessionLocal
from app.jobs import JOB_TYPE_NOTE_GROUP_AUTO_GENERATION, run_auto_note_group_generation
from app.models import Job

_queue: deque[str] = deque()
_queue_set: set[str] = set()
_condition = Condition()
_started = False


def start_auto_worker() -> None:
    global _started
    if _started:
        return
    _started = True
    thread = Thread(target=_worker_loop, daemon=True)
    thread.start()


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
        if job_id in _queue_set:
            return False
        _queue.append(job_id)
        _queue_set.add(job_id)
        _condition.notify()
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


def _get_question_count(job: Job) -> int:
    payload = job.payload_json or ""
    if not payload:
        return 30
    try:
        data = json.loads(payload)
        count = int(data.get("question_count", 30))
        return count if count > 0 else 30
    except (ValueError, TypeError, json.JSONDecodeError):
        return 30


def _worker_loop() -> None:
    while True:
        with _condition:
            while not _queue:
                _condition.wait()
            job_id = _queue.popleft()
            _queue_set.discard(job_id)

        db = SessionLocal()
        try:
            job = db.get(Job, job_id)
            if not job:
                continue
            if job.type != JOB_TYPE_NOTE_GROUP_AUTO_GENERATION:
                continue
            if job.status in {"cancelled", "failed", "completed"}:
                continue
            question_count = _get_question_count(job)
        finally:
            db.close()

        run_auto_note_group_generation(job_id, question_count)
