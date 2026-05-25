import asyncio
import logging
import threading
from dataclasses import dataclass
from datetime import datetime
from typing import Any, AsyncIterator

from sqlalchemy import event
from sqlalchemy.orm import Session

from app.models import Job, NoteGroup

logger = logging.getLogger(__name__)

_PENDING_EVENTS_KEY = "generation_events_pending"
_LISTENERS_INSTALLED_KEY = "generation_events_listeners_installed"
_SUBSCRIBER_QUEUE_SIZE = 1


@dataclass(frozen=True)
class GenerationEvent:
    module_id: str
    event: str
    payload: dict[str, Any]


@dataclass(frozen=True)
class _Subscriber:
    loop: asyncio.AbstractEventLoop
    queue: asyncio.Queue[GenerationEvent]


class GenerationSubscription:
    def __init__(
        self,
        bus: "GenerationEventBus",
        module_id: str,
        subscriber: _Subscriber,
    ) -> None:
        self._bus = bus
        self._module_id = module_id
        self._subscriber = subscriber
        self._closed = False

    async def get(self) -> GenerationEvent:
        return await self._subscriber.queue.get()

    def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        self._bus.unsubscribe(self._module_id, self._subscriber)


class GenerationEventBus:
    def __init__(self) -> None:
        self._subscribers: dict[str, set[_Subscriber]] = {}
        self._lock = threading.RLock()

    def open_subscription(self, module_id: str) -> GenerationSubscription:
        loop = asyncio.get_running_loop()
        subscriber = _Subscriber(loop=loop, queue=asyncio.Queue(maxsize=_SUBSCRIBER_QUEUE_SIZE))
        with self._lock:
            self._subscribers.setdefault(module_id, set()).add(subscriber)
        return GenerationSubscription(self, module_id, subscriber)

    def unsubscribe(self, module_id: str, subscriber: _Subscriber) -> None:
        with self._lock:
            subscribers = self._subscribers.get(module_id)
            if subscribers is None:
                return
            subscribers.discard(subscriber)
            if not subscribers:
                self._subscribers.pop(module_id, None)

    async def subscribe(self, module_id: str) -> AsyncIterator[GenerationEvent]:
        subscription = self.open_subscription(module_id)
        try:
            while True:
                yield await subscription.get()
        finally:
            subscription.close()

    @staticmethod
    def _deliver_event(subscriber: _Subscriber, event: GenerationEvent) -> None:
        try:
            subscriber.queue.put_nowait(event)
        except asyncio.QueueFull:
            try:
                subscriber.queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
            try:
                subscriber.queue.put_nowait(event)
            except asyncio.QueueFull:
                pass

    def publish(self, event: GenerationEvent) -> None:
        with self._lock:
            subscribers = list(self._subscribers.get(event.module_id, set()))
        for subscriber in subscribers:
            if subscriber.loop.is_closed():
                self.unsubscribe(event.module_id, subscriber)
                continue
            try:
                subscriber.loop.call_soon_threadsafe(self._deliver_event, subscriber, event)
            except RuntimeError:
                self.unsubscribe(event.module_id, subscriber)


generation_event_bus = GenerationEventBus()


def _json_safe(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    return value


def _publish_pending_generation_events(session: Session) -> None:
    pending_events = session.info.pop(_PENDING_EVENTS_KEY, [])
    for queued_event in pending_events:
        generation_event_bus.publish(queued_event)


def _clear_pending_generation_events(session: Session) -> None:
    session.info.pop(_PENDING_EVENTS_KEY, None)


def _ensure_session_event_listeners(db: Session) -> None:
    if db.info.get(_LISTENERS_INSTALLED_KEY):
        return
    event.listen(db, "after_commit", _publish_pending_generation_events)
    event.listen(db, "after_rollback", _clear_pending_generation_events)
    db.info[_LISTENERS_INSTALLED_KEY] = True


def publish_generation_event(db: Session, job: Job, event_type: str) -> None:
    try:
        note_group = job.note_group
        if note_group is None and job.note_group_id:
            note_group = db.get(NoteGroup, job.note_group_id)
        if note_group is None or not note_group.module_id:
            return
        from app.generation_workflow import serialize_generation_workflow

        payload = _json_safe(serialize_generation_workflow(db, job))
        db.info.setdefault(_PENDING_EVENTS_KEY, []).append(
            GenerationEvent(
                module_id=note_group.module_id,
                event=event_type,
                payload=payload,
            )
        )
        _ensure_session_event_listeners(db)
    except Exception:
        logger.exception("Failed to queue generation workflow event")
