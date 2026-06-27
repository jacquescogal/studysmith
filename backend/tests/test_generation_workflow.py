import asyncio
from concurrent.futures import Future
import json
import unittest
from contextlib import ExitStack
from unittest.mock import Mock, patch

from sqlalchemy import create_engine, delete, event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app.models import (
    JOB_STAGE_MIND_MAP_TOPICS,
    JOB_STAGE_CLEANED_TEXT,
    JOB_STAGE_EMBEDDINGS,
    JOB_STAGE_PROMOTING,
    JOB_STAGE_QUEUED,
    JOB_STAGE_QUESTION_CARDS,
    JOB_STAGE_STUDY_CARDS,
    JOB_STAGE_TITLE,
    JOB_STAGE_TOPIC_KNOWLEDGE_NODES,
    DraftKnowledgeNode,
    DraftQuestionCard,
    DraftMindMapRelation,
    DraftNoteGroupTopicLink,
    DraftStudyCard,
    DraftStudyCardKnowledgeNodeLink,
    DraftStudyCardSourceRange,
    DraftStudyCardTopicLink,
    DraftTopic,
    Job,
    JobLog,
    JobStage,
    MindMapConcept,
    MindMapRelation,
    Module,
    NoteGroupMindMapConcept,
    NoteGroup,
    NoteGroupGenerationDraft,
    QuestionCard,
    Subject,
    StudyCard,
    StudyCardEmbedding,
    StudyCardSourceRange,
    StudyCardMindMapConcept,
    TopicChip,
    User,
    note_group_topic_chips,
    study_card_topic_chips,
)
from app.schemas import JobLogOut, JobOut
from app.generation_workflow import (
    JOB_DELETE_REQUESTED_ERROR,
    JOB_STAGE_SEQUENCE,
    append_job_log,
    delete_job_and_draft,
    delete_unfinished_job_workflow,
    fail_job_stage,
    initialize_job_workflow,
    request_unfinished_job_delete,
    retry_failed_job_stage,
    serialize_generation_workflow,
    serialize_module_generation_workflow_snapshot,
    set_stage_progress,
    start_job_stage,
    succeed_job_stage,
)
from app.jobs import JOB_TYPE_NOTE_GROUP_AUTO_GENERATION


class GenerationWorkflowModelTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(self.engine, "connect")
        def _set_sqlite_pragma(dbapi_connection, connection_record) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        Base.metadata.create_all(bind=self.engine)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)

    def tearDown(self):
        Base.metadata.drop_all(bind=self.engine)

    def _create_generation_draft(self, db, suffix: str) -> NoteGroupGenerationDraft:
        owner = User(
            id=f"owner-{suffix}",
            supabase_user_id=f"owner-sub-{suffix}",
            email=f"owner-{suffix}@example.com",
            app_role="creator",
        )
        subject = Subject(
            id=f"subject-{suffix}",
            title=f"Subject {suffix}",
            owner_user_id=owner.id,
        )
        module = Module(id=f"module-{suffix}", subject_id=subject.id, title=f"Module {suffix}")
        note_group = NoteGroup(
            id=f"note-group-{suffix}",
            module_id=module.id,
            title=f"Note Group {suffix}",
            source="source",
            raw_text="raw",
        )
        job = Job(
            id=f"job-{suffix}",
            type="NOTE_GROUP_GENERATION",
            status="queued",
            note_group_id=note_group.id,
        )
        draft = NoteGroupGenerationDraft(
            id=f"draft-{suffix}",
            job_id=job.id,
            module_id=module.id,
            note_group_id=note_group.id,
            raw_text="raw",
            current_stage=JOB_STAGE_QUEUED,
        )

        db.add_all([owner, subject, module, note_group, job, draft])
        db.commit()
        return draft

    def test_job_tracks_generation_draft_stages_and_logs(self):
        db = self.SessionLocal()
        try:
            owner = User(
                id="owner-1",
                supabase_user_id="owner-sub",
                email="owner@example.com",
                app_role="creator",
            )
            subject = Subject(id="subject-1", title="Subject", owner_user_id="owner-1")
            module = Module(id="module-1", subject_id="subject-1", title="Module")
            note_group = NoteGroup(
                id="note-group-1",
                module_id="module-1",
                title="Note Group",
                source="source",
                raw_text="raw",
            )
            job = Job(id="job-1", type="NOTE_GROUP_GENERATION", status="queued", note_group_id="note-group-1")
            draft = NoteGroupGenerationDraft(
                id="draft-1",
                job_id="job-1",
                module_id="module-1",
                note_group_id="note-group-1",
                raw_text="raw",
                current_stage=JOB_STAGE_QUEUED,
            )
            stage = JobStage(
                id="stage-1",
                job_id="job-1",
                stage=JOB_STAGE_QUEUED,
                sort_order=0,
                status="pending",
            )
            log = JobLog(
                id="log-1",
                job_id="job-1",
                stage=JOB_STAGE_QUEUED,
                message="Generation queued",
                metadata_json="{}",
            )
            draft_card = DraftStudyCard(
                id="draft-card-1",
                draft_id="draft-1",
                title="Draft Card",
                content="Draft content",
                sort_order=0,
            )

            db.add_all([owner, subject, module, note_group, job, draft, stage, log, draft_card])
            db.commit()

            stored_job = db.get(Job, "job-1")

            self.assertEqual(stored_job.generation_draft.current_stage, "queued")
            self.assertEqual(stored_job.stages[0].stage, "queued")
            self.assertEqual(stored_job.logs[0].message, "Generation queued")
            self.assertEqual(stored_job.generation_draft.study_cards[0].content, "Draft content")

            job_out = JobOut.model_validate(stored_job)
            log_out = JobLogOut.model_validate(stored_job.logs[0])

            self.assertEqual(job_out.current_stage, "queued")
            self.assertEqual(job_out.stage_status, "pending")
            self.assertEqual(log_out.metadata, {})
        finally:
            db.close()

    def test_job_out_does_not_report_status_for_different_current_stage(self):
        db = self.SessionLocal()
        try:
            draft = self._create_generation_draft(db, "stage-mismatch")
            draft.current_stage = JOB_STAGE_STUDY_CARDS
            db.add(
                JobStage(
                    id="stage-mismatch-queued",
                    job_id=draft.job_id,
                    stage=JOB_STAGE_QUEUED,
                    sort_order=0,
                    status="succeeded",
                    progress_current=1,
                    progress_total=1,
                )
            )
            db.commit()

            job_out = JobOut.model_validate(db.get(Job, draft.job_id))

            self.assertEqual(job_out.current_stage, JOB_STAGE_STUDY_CARDS)
            self.assertIsNone(job_out.stage_status)
            self.assertIsNone(job_out.progress_current)
            self.assertIsNone(job_out.progress_total)
        finally:
            db.close()

    def test_note_group_delete_removes_generation_draft_before_job_fk_update(self):
        db = self.SessionLocal()
        try:
            draft = self._create_generation_draft(db, "note-group-delete")
            draft_id = draft.id
            job_id = draft.job_id
            note_group = db.get(NoteGroup, draft.note_group_id)

            db.delete(note_group)
            db.commit()

            self.assertIsNone(db.get(NoteGroupGenerationDraft, draft_id))
            self.assertIsNone(db.get(Job, job_id).note_group_id)
        finally:
            db.close()

    def test_cross_draft_study_card_topic_link_is_rejected(self):
        db = self.SessionLocal()
        try:
            first_draft = self._create_generation_draft(db, "first")
            second_draft = self._create_generation_draft(db, "second")
            draft_card = DraftStudyCard(
                id="draft-card-cross-link",
                draft_id=first_draft.id,
                content="Draft content",
            )
            draft_topic = DraftTopic(
                id="draft-topic-cross-link",
                draft_id=second_draft.id,
                module_id=second_draft.module_id,
                label="Other draft topic",
            )
            db.add_all([draft_card, draft_topic])
            db.commit()

            db.add(
                DraftStudyCardTopicLink(
                    id="cross-draft-topic-link",
                    draft_id=first_draft.id,
                    module_id=first_draft.module_id,
                    draft_study_card_id=draft_card.id,
                    draft_topic_id=draft_topic.id,
                )
            )

            with self.assertRaises(IntegrityError):
                db.commit()
        finally:
            db.close()

    def test_deleting_parent_draft_topic_cascades_to_child_topic(self):
        db = self.SessionLocal()
        try:
            draft = self._create_generation_draft(db, "parent-topic-delete")
            parent_topic = DraftTopic(
                id="parent-draft-topic-delete",
                draft_id=draft.id,
                module_id=draft.module_id,
                label="Parent draft topic",
            )
            child_topic = DraftTopic(
                id="child-draft-topic-delete",
                draft_id=draft.id,
                module_id=draft.module_id,
                parent_draft_topic_id=parent_topic.id,
                label="Child draft topic",
            )
            db.add_all([parent_topic, child_topic])
            db.commit()

            child_topic_id = child_topic.id
            db.delete(parent_topic)
            db.commit()

            self.assertIsNone(db.get(DraftTopic, child_topic_id))
        finally:
            db.close()

    def test_deleting_existing_parent_topic_cascades_to_draft_topic(self):
        db = self.SessionLocal()
        try:
            draft = self._create_generation_draft(db, "existing-parent-topic-delete")
            existing_parent_topic = TopicChip(
                id="existing-parent-topic-delete",
                module_id=draft.module_id,
                label="Existing parent topic",
            )
            draft_topic = DraftTopic(
                id="draft-topic-with-existing-parent-delete",
                draft_id=draft.id,
                module_id=draft.module_id,
                parent_existing_topic_id=existing_parent_topic.id,
                label="Draft topic with existing parent",
            )
            db.add_all([existing_parent_topic, draft_topic])
            db.commit()

            draft_topic_id = draft_topic.id
            db.execute(delete(TopicChip).where(TopicChip.id == existing_parent_topic.id))
            db.commit()

            self.assertIsNone(db.get(DraftTopic, draft_topic_id))
        finally:
            db.close()

    def test_draft_topic_rejects_multiple_parents(self):
        db = self.SessionLocal()
        try:
            draft = self._create_generation_draft(db, "multiple-topic-parents")
            parent_topic = DraftTopic(
                id="parent-draft-topic-multiple-parents",
                draft_id=draft.id,
                module_id=draft.module_id,
                label="Parent draft topic",
            )
            existing_parent_topic = TopicChip(
                id="existing-parent-topic-multiple-parents",
                module_id=draft.module_id,
                label="Existing parent topic",
            )
            db.add_all([parent_topic, existing_parent_topic])
            db.commit()

            db.add(
                DraftTopic(
                    id="draft-topic-with-multiple-parents",
                    draft_id=draft.id,
                    module_id=draft.module_id,
                    parent_draft_topic_id=parent_topic.id,
                    parent_existing_topic_id=existing_parent_topic.id,
                    label="Draft topic with multiple parents",
                )
            )

            with self.assertRaises(IntegrityError):
                db.commit()
        finally:
            db.close()

    def test_note_group_topic_link_requires_exactly_one_target(self):
        db = self.SessionLocal()
        try:
            draft = self._create_generation_draft(db, "topic-link")
            draft_topic = DraftTopic(
                id="draft-topic-link",
                draft_id=draft.id,
                module_id=draft.module_id,
                label="Draft topic",
            )
            existing_topic = TopicChip(
                id="existing-topic-link",
                module_id=draft.module_id,
                label="Existing topic",
            )
            db.add_all([draft_topic, existing_topic])
            db.commit()

            db.add(DraftNoteGroupTopicLink(id="no-topic-link-target", draft_id=draft.id, module_id=draft.module_id))
            with self.assertRaises(IntegrityError):
                db.commit()

            db.rollback()
            db.add(
                DraftNoteGroupTopicLink(
                    id="ambiguous-topic-link-target",
                    draft_id=draft.id,
                    module_id=draft.module_id,
                    draft_topic_id=draft_topic.id,
                    existing_topic_id=existing_topic.id,
                )
            )
            with self.assertRaises(IntegrityError):
                db.commit()
        finally:
            db.close()

    def test_mind_map_relation_requires_unambiguous_source_and_target(self):
        db = self.SessionLocal()
        try:
            draft = self._create_generation_draft(db, "mind-map")
            source_topic = DraftTopic(
                id="source-draft-topic",
                draft_id=draft.id,
                module_id=draft.module_id,
                relation_endpoint_id="source-draft-topic",
                label="Source topic",
            )
            target_topic = DraftTopic(
                id="target-draft-topic",
                draft_id=draft.id,
                module_id=draft.module_id,
                relation_endpoint_id="target-draft-topic",
                label="Target topic",
            )
            existing_source = TopicChip(
                id="existing-source-topic",
                module_id=draft.module_id,
                label="Existing source",
            )
            existing_target = TopicChip(
                id="existing-target-topic",
                module_id=draft.module_id,
                label="Existing target",
            )
            db.add_all([source_topic, target_topic, existing_source, existing_target])
            db.commit()

            db.add(
                DraftMindMapRelation(
                    id="ambiguous-source-relation",
                    draft_id=draft.id,
                    module_id=draft.module_id,
                    source_draft_topic_id=source_topic.id,
                    source_existing_topic_id=existing_source.id,
                    target_draft_topic_id=target_topic.id,
                    relation_type="related_to",
                )
            )
            with self.assertRaises(IntegrityError):
                db.commit()

            db.rollback()
            db.add(
                DraftMindMapRelation(
                    id="ambiguous-target-relation",
                    draft_id=draft.id,
                    module_id=draft.module_id,
                    source_draft_topic_id=source_topic.id,
                    target_draft_topic_id=target_topic.id,
                    target_existing_topic_id=existing_target.id,
                    relation_type="related_to",
                )
            )
            with self.assertRaises(IntegrityError):
                db.commit()
        finally:
            db.close()

    def test_cross_module_existing_topic_reference_is_rejected(self):
        db = self.SessionLocal()
        try:
            first_draft = self._create_generation_draft(db, "topic-module-first")
            second_draft = self._create_generation_draft(db, "topic-module-second")
            other_module_topic = TopicChip(
                id="other-module-topic",
                module_id=second_draft.module_id,
                label="Other module topic",
            )
            db.add(other_module_topic)
            db.commit()

            db.add(
                DraftNoteGroupTopicLink(
                    id="cross-module-topic-link",
                    draft_id=first_draft.id,
                    module_id=first_draft.module_id,
                    existing_topic_id=other_module_topic.id,
                )
            )

            with self.assertRaises(IntegrityError):
                db.commit()
        finally:
            db.close()

    def test_mind_map_relation_rejects_invalid_relation_type(self):
        db = self.SessionLocal()
        try:
            draft = self._create_generation_draft(db, "invalid-relation-type")
            source_topic = DraftTopic(
                id="invalid-type-source-topic",
                draft_id=draft.id,
                module_id=draft.module_id,
                relation_endpoint_id="invalid-type-source-topic",
                label="Source topic",
            )
            target_topic = DraftTopic(
                id="invalid-type-target-topic",
                draft_id=draft.id,
                module_id=draft.module_id,
                relation_endpoint_id="invalid-type-target-topic",
                label="Target topic",
            )
            db.add_all([source_topic, target_topic])
            db.commit()

            db.add(
                DraftMindMapRelation(
                    id="invalid-type-relation",
                    draft_id=draft.id,
                    module_id=draft.module_id,
                    source_draft_topic_id=source_topic.id,
                    target_draft_topic_id=target_topic.id,
                    relation_type="invalid_relation",
                )
            )

            with self.assertRaises(IntegrityError):
                db.commit()
        finally:
            db.close()

    def test_mind_map_relation_rejects_self_edge(self):
        db = self.SessionLocal()
        try:
            draft = self._create_generation_draft(db, "self-edge")
            existing_topic = TopicChip(
                id="self-edge-existing-topic",
                module_id=draft.module_id,
                label="Existing topic",
            )
            db.add(existing_topic)
            db.commit()

            db.add(
                DraftMindMapRelation(
                    id="self-edge-relation",
                    draft_id=draft.id,
                    module_id=draft.module_id,
                    source_existing_topic_id=existing_topic.id,
                    target_existing_topic_id=existing_topic.id,
                    relation_type="related_to",
                )
            )

            with self.assertRaises(IntegrityError):
                db.commit()
        finally:
            db.close()

    def test_mind_map_relation_rejects_mixed_alias_self_edge(self):
        db = self.SessionLocal()
        try:
            draft = self._create_generation_draft(db, "mixed-alias-self-edge")
            existing_topic = TopicChip(
                id="mixed-alias-existing-topic",
                module_id=draft.module_id,
                label="Existing topic",
            )
            draft_topic = DraftTopic(
                id="mixed-alias-draft-topic",
                draft_id=draft.id,
                module_id=draft.module_id,
                existing_topic_id=existing_topic.id,
                label="Draft topic alias",
            )
            db.add_all([existing_topic, draft_topic])
            db.commit()

            db.add(
                DraftMindMapRelation(
                    id="mixed-alias-self-edge-relation",
                    draft_id=draft.id,
                    module_id=draft.module_id,
                    source_draft_topic_id=draft_topic.id,
                    target_existing_topic_id=existing_topic.id,
                    relation_type="related_to",
                )
            )

            with self.assertRaises(IntegrityError):
                db.commit()
        finally:
            db.close()

    def test_mind_map_relation_rejects_alias_draft_topic_endpoint_without_denormalized_alias(self):
        db = self.SessionLocal()
        try:
            draft = self._create_generation_draft(db, "alias-draft-topic-endpoint")
            existing_topic = TopicChip(
                id="alias-endpoint-existing-topic",
                module_id=draft.module_id,
                label="Existing topic",
            )
            draft_topic = DraftTopic(
                id="draft-alias",
                draft_id=draft.id,
                module_id=draft.module_id,
                existing_topic_id=existing_topic.id,
                label="Draft topic alias",
            )
            db.add_all([existing_topic, draft_topic])
            db.commit()

            db.add(
                DraftMindMapRelation(
                    id="alias-draft-topic-endpoint-relation",
                    draft_id=draft.id,
                    module_id=draft.module_id,
                    source_draft_topic_id=draft_topic.id,
                    target_existing_topic_id=existing_topic.id,
                    relation_type="related_to",
                )
            )

            with self.assertRaises(IntegrityError):
                db.commit()
        finally:
            db.close()

    def test_mind_map_relation_rejects_alias_draft_topic_target_endpoint(self):
        db = self.SessionLocal()
        try:
            draft = self._create_generation_draft(db, "alias-draft-topic-target-endpoint")
            source_topic = TopicChip(
                id="alias-source-existing-topic",
                module_id=draft.module_id,
                label="Source existing topic",
            )
            target_topic = TopicChip(
                id="alias-target-existing-topic",
                module_id=draft.module_id,
                label="Target existing topic",
            )
            target_draft_topic = DraftTopic(
                id="alias-target-draft-topic",
                draft_id=draft.id,
                module_id=draft.module_id,
                existing_topic_id=target_topic.id,
                label="Target draft topic alias",
            )
            db.add_all([source_topic, target_topic, target_draft_topic])
            db.commit()

            db.add(
                DraftMindMapRelation(
                    id="alias-draft-topic-target-endpoint-relation",
                    draft_id=draft.id,
                    module_id=draft.module_id,
                    source_existing_topic_id=source_topic.id,
                    target_draft_topic_id=target_draft_topic.id,
                    relation_type="related_to",
                )
            )

            with self.assertRaises(IntegrityError):
                db.commit()
        finally:
            db.close()

    def test_generation_draft_rejects_module_note_group_mismatch(self):
        db = self.SessionLocal()
        try:
            owner = User(
                id="owner-mismatch",
                supabase_user_id="owner-sub-mismatch",
                email="owner-mismatch@example.com",
                app_role="creator",
            )
            subject = Subject(id="subject-mismatch", title="Subject", owner_user_id=owner.id)
            first_module = Module(id="module-mismatch-1", subject_id=subject.id, title="Module 1")
            second_module = Module(id="module-mismatch-2", subject_id=subject.id, title="Module 2")
            note_group = NoteGroup(
                id="note-group-mismatch",
                module_id=first_module.id,
                title="Note Group",
                raw_text="raw",
            )
            job = Job(
                id="job-mismatch",
                type="NOTE_GROUP_GENERATION",
                status="queued",
                note_group_id=note_group.id,
            )
            db.add_all([owner, subject, first_module, second_module, note_group, job])
            db.commit()

            db.add(
                NoteGroupGenerationDraft(
                    id="draft-mismatch",
                    job_id=job.id,
                    module_id=second_module.id,
                    note_group_id=note_group.id,
                    raw_text="raw",
                    current_stage=JOB_STAGE_QUEUED,
                )
            )

            with self.assertRaises(IntegrityError):
                db.commit()
        finally:
            db.close()

    def test_job_log_out_accepts_metadata_alias(self):
        log_out = JobLogOut.model_validate(
            {
                "id": "log-with-metadata",
                "stage": JOB_STAGE_QUEUED,
                "message": "Queued",
                "metadata": {"count": 1},
                "created_at": "2026-05-25T00:00:00",
            }
        )

        self.assertEqual(log_out.metadata, {"count": 1})


class GenerationWorkflowServiceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(self.engine, "connect")
        def _set_sqlite_pragma(dbapi_connection, connection_record) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        Base.metadata.create_all(bind=self.engine)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)

    def tearDown(self):
        Base.metadata.drop_all(bind=self.engine)

    def _create_generation_job(self, db, suffix: str) -> Job:
        owner = User(
            id=f"workflow-owner-{suffix}",
            supabase_user_id=f"workflow-owner-sub-{suffix}",
            email=f"workflow-owner-{suffix}@example.com",
            app_role="creator",
        )
        subject = Subject(
            id=f"workflow-subject-{suffix}",
            title=f"Workflow Subject {suffix}",
            owner_user_id=owner.id,
        )
        module = Module(
            id=f"workflow-module-{suffix}",
            subject_id=subject.id,
            title=f"Workflow Module {suffix}",
        )
        note_group = NoteGroup(
            id=f"workflow-note-group-{suffix}",
            module_id=module.id,
            title=f"Workflow Note Group {suffix}",
            source="source",
            raw_text="raw",
            generation_status="queued",
        )
        job = Job(
            id=f"workflow-job-{suffix}",
            type="NOTE_GROUP_GENERATION",
            status="queued",
            note_group_id=note_group.id,
        )
        db.add_all([owner, subject, module, note_group, job])
        db.commit()
        return job

    def test_initialize_start_succeed_and_log_job_stage(self):
        db = self.SessionLocal()
        try:
            job = self._create_generation_job(db, "happy-path")

            initialize_job_workflow(db, job, "raw text", "unique-id", "extra instructions")
            start_job_stage(db, job, JOB_STAGE_TITLE)
            append_job_log(db, job, JOB_STAGE_TITLE, "Title draft generated", {"count": 1})
            succeed_job_stage(db, job, JOB_STAGE_TITLE, message="Title approved")
            db.commit()

            workflow = serialize_generation_workflow(db, job)
            title_stage = next(stage for stage in workflow["stages"] if stage["stage"] == JOB_STAGE_TITLE)
            log_messages = [log["message"] for log in workflow["logs"]]

            self.assertEqual(title_stage["status"], "succeeded")
            self.assertIn("Title draft generated", log_messages)
            self.assertEqual(workflow["current_stage"], JOB_STAGE_TITLE)
            self.assertEqual(workflow["job"]["current_stage"], JOB_STAGE_TITLE)
            self.assertEqual(workflow["job"]["stage_status"], "succeeded")
            self.assertEqual(job.generation_draft.current_stage, JOB_STAGE_TITLE)
            self.assertEqual(workflow["logs"][2]["metadata"], {"count": 1})
            self.assertIsNotNone(title_stage["started_at"].tzinfo)
            self.assertIsNotNone(workflow["logs"][0]["created_at"].tzinfo)
        finally:
            db.close()

    def test_fail_job_stage_sets_job_error_and_status(self):
        db = self.SessionLocal()
        try:
            job = self._create_generation_job(db, "fail")
            initialize_job_workflow(db, job, "raw text", "unique-id", None)
            start_job_stage(db, job, JOB_STAGE_QUESTION_CARDS)

            fail_job_stage(db, job, JOB_STAGE_QUESTION_CARDS, "Question generation failed")
            db.commit()

            failed_stage = (
                db.query(JobStage)
                .filter(JobStage.job_id == job.id, JobStage.stage == JOB_STAGE_QUESTION_CARDS)
                .one()
            )
            self.assertEqual(job.status, "failed")
            self.assertEqual(job.error, "Question generation failed")
            self.assertEqual(failed_stage.status, "failed")
            self.assertEqual(failed_stage.error, "Question generation failed")
        finally:
            db.close()

    def test_initialize_is_idempotent(self):
        db = self.SessionLocal()
        try:
            job = self._create_generation_job(db, "idempotent")

            initialize_job_workflow(db, job, "raw text", "unique-id", None)
            initialize_job_workflow(db, job, "raw text", "unique-id", None)
            db.commit()

            self.assertEqual(db.query(NoteGroupGenerationDraft).filter_by(job_id=job.id).count(), 1)
            self.assertEqual(db.query(JobStage).filter_by(job_id=job.id).count(), len(JOB_STAGE_SEQUENCE))
            self.assertEqual(db.query(JobLog).filter_by(job_id=job.id).count(), 1)
        finally:
            db.close()

    def test_initialize_updates_preloaded_empty_draft_relationship(self):
        db = self.SessionLocal()
        try:
            job = self._create_generation_job(db, "preloaded-draft")
            self.assertIsNone(job.generation_draft)

            initialize_job_workflow(db, job, "raw text", "unique-id", None)
            start_job_stage(db, job, JOB_STAGE_TITLE)
            db.commit()

            draft = db.query(NoteGroupGenerationDraft).filter_by(job_id=job.id).one()
            workflow = serialize_generation_workflow(db, job)

            self.assertEqual(draft.current_stage, JOB_STAGE_TITLE)
            self.assertEqual(job.generation_draft.current_stage, JOB_STAGE_TITLE)
            self.assertEqual(workflow["current_stage"], JOB_STAGE_TITLE)
        finally:
            db.close()

    def test_set_stage_progress_updates_progress_and_log(self):
        db = self.SessionLocal()
        try:
            job = self._create_generation_job(db, "progress")
            initialize_job_workflow(db, job, "raw text", "unique-id", None)

            set_stage_progress(db, job, JOB_STAGE_STUDY_CARDS, 3, 10, message="Created 3 Study Cards")
            db.commit()

            stage = (
                db.query(JobStage)
                .filter(JobStage.job_id == job.id, JobStage.stage == JOB_STAGE_STUDY_CARDS)
                .one()
            )
            messages = [log.message for log in db.query(JobLog).filter_by(job_id=job.id).all()]

            self.assertEqual(stage.progress_current, 3)
            self.assertEqual(stage.progress_total, 10)
            self.assertIn("Created 3 Study Cards", messages)
        finally:
            db.close()

    def test_generation_events_publish_only_after_commit(self):
        db = self.SessionLocal()
        try:
            job = self._create_generation_job(db, "event-commit")
            published_events = []

            with patch("app.generation_events.generation_event_bus.publish", published_events.append):
                initialize_job_workflow(db, job, "raw text", "unique-id", None)
                self.assertEqual(published_events, [])

                db.rollback()
                self.assertEqual(published_events, [])

                initialize_job_workflow(db, job, "raw text", "unique-id", None)
                start_job_stage(db, job, JOB_STAGE_TITLE)
                self.assertEqual(published_events, [])

                db.commit()

            self.assertEqual([event.event for event in published_events], ["workflow_initialized", "stage_started"])
            self.assertTrue(all(event.module_id == job.note_group.module_id for event in published_events))
        finally:
            db.close()

    def test_module_generation_snapshot_serializes_updated_auto_job_after_event_commit(self):
        db = self.SessionLocal()
        try:
            job = self._create_generation_job(db, "module-snapshot")
            job.type = JOB_TYPE_NOTE_GROUP_AUTO_GENERATION
            initialize_job_workflow(db, job, "raw text", "unique-id", None)
            start_job_stage(db, job, JOB_STAGE_STUDY_CARDS)
            db.commit()

            initial_snapshot = serialize_module_generation_workflow_snapshot(db, job.note_group.module_id)
            self.assertEqual(initial_snapshot["module_id"], job.note_group.module_id)
            self.assertEqual(initial_snapshot["jobs"][0]["job"]["stage_status"], "running")

            published_events = []
            with patch("app.generation_events.generation_event_bus.publish", published_events.append):
                set_stage_progress(
                    db,
                    job,
                    JOB_STAGE_STUDY_CARDS,
                    4,
                    7,
                    message="Created 4 Study Cards",
                )
                db.commit()

            refreshed_snapshot = serialize_module_generation_workflow_snapshot(db, job.note_group.module_id)
            self.assertEqual([event.event for event in published_events], ["stage_progress"])
            self.assertEqual(refreshed_snapshot["jobs"][0]["current_stage"], JOB_STAGE_STUDY_CARDS)
            self.assertEqual(refreshed_snapshot["jobs"][0]["job"]["progress_current"], 4)
            self.assertEqual(refreshed_snapshot["jobs"][0]["job"]["progress_total"], 7)
            self.assertEqual(refreshed_snapshot["jobs"][0]["logs"][-1]["message"], "Created 4 Study Cards")
        finally:
            db.close()

    def test_generation_event_subscription_survives_heartbeat_timeout(self):
        from app.generation_events import GenerationEvent, generation_event_bus

        async def run_subscription_check():
            module_id = "workflow-module-stream-idle"
            subscription = generation_event_bus.open_subscription(module_id)
            try:
                with self.assertRaises(asyncio.TimeoutError):
                    await asyncio.wait_for(subscription.get(), timeout=0.01)

                generation_event_bus.publish(
                    GenerationEvent(module_id=module_id, event="stage_progress", payload={"current": 1})
                )
                event = await asyncio.wait_for(subscription.get(), timeout=1)
                self.assertEqual(event.event, "stage_progress")
                self.assertEqual(event.payload, {"current": 1})
            finally:
                subscription.close()

        asyncio.run(run_subscription_check())

    def test_delete_job_and_draft_cascades_stages_logs_draft(self):
        db = self.SessionLocal()
        try:
            job = self._create_generation_job(db, "delete")
            job_id = job.id
            note_group_id = job.note_group_id
            initialize_job_workflow(db, job, "raw text", "unique-id", None)
            append_job_log(db, job, JOB_STAGE_TITLE, "Generated title")
            db.commit()

            delete_job_and_draft(db, job)
            db.commit()

            self.assertIsNone(db.get(Job, job_id))
            self.assertEqual(db.query(NoteGroupGenerationDraft).filter_by(job_id=job_id).count(), 0)
            self.assertEqual(db.query(JobStage).filter_by(job_id=job_id).count(), 0)
            self.assertEqual(db.query(JobLog).filter_by(job_id=job_id).count(), 0)
            self.assertIsNotNone(db.get(NoteGroup, note_group_id))
        finally:
            db.close()


class AutoQueueModuleGatingTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(self.engine, "connect")
        def _set_sqlite_pragma(dbapi_connection, connection_record) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        Base.metadata.create_all(bind=self.engine)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)

    def tearDown(self):
        import app.auto_queue as auto_queue

        with auto_queue._condition:
            auto_queue._queue.clear()
            auto_queue._queue_set.clear()
        Base.metadata.drop_all(bind=self.engine)

    def test_worker_defers_same_module_auto_job_until_running_job_finishes(self):
        import app.auto_queue as auto_queue

        db = self.SessionLocal()
        try:
            owner = User(
                id="queue-owner",
                supabase_user_id="queue-owner-sub",
                email="queue-owner@example.com",
                app_role="creator",
            )
            subject = Subject(id="queue-subject", title="Queue Subject", owner_user_id=owner.id)
            module = Module(id="queue-module", subject_id=subject.id, title="Queue Module")
            other_module = Module(id="queue-other-module", subject_id=subject.id, title="Other Module")
            first_note_group = NoteGroup(
                id="queue-note-group-1",
                module_id=module.id,
                title="Queued Note Group 1",
                source="queue-source-1",
                raw_text="raw 1",
                generation_status="generating",
            )
            second_note_group = NoteGroup(
                id="queue-note-group-2",
                module_id=module.id,
                title="Queued Note Group 2",
                source="queue-source-2",
                raw_text="raw 2",
                generation_status="queued",
            )
            other_note_group = NoteGroup(
                id="queue-note-group-3",
                module_id=other_module.id,
                title="Queued Note Group 3",
                source="queue-source-3",
                raw_text="raw 3",
                generation_status="queued",
            )
            running_job = Job(
                id="queue-job-running",
                type=JOB_TYPE_NOTE_GROUP_AUTO_GENERATION,
                status="running",
                note_group_id=first_note_group.id,
            )
            queued_job = Job(
                id="queue-job-queued",
                type=JOB_TYPE_NOTE_GROUP_AUTO_GENERATION,
                status="queued",
                note_group_id=second_note_group.id,
            )
            other_queued_job = Job(
                id="queue-job-other",
                type=JOB_TYPE_NOTE_GROUP_AUTO_GENERATION,
                status="queued",
                note_group_id=other_note_group.id,
            )
            db.add_all(
                [
                    owner,
                    subject,
                    module,
                    other_module,
                    first_note_group,
                    second_note_group,
                    other_note_group,
                    running_job,
                    queued_job,
                    other_queued_job,
                ]
            )
            db.commit()

            with auto_queue._condition:
                auto_queue._queue.clear()
                auto_queue._queue_set.clear()
            with patch.object(auto_queue, "SessionLocal", self.SessionLocal):
                self.assertTrue(auto_queue.enqueue_auto_job(queued_job.id))
                self.assertTrue(auto_queue.enqueue_auto_job(other_queued_job.id))

                self.assertEqual(
                    auto_queue._dequeue_next_runnable_job(wait=False),
                    other_queued_job.id,
                )
                with auto_queue._condition:
                    self.assertEqual(list(auto_queue._queue), [queued_job.id])
                db.expire_all()
                self.assertEqual(db.get(Job, other_queued_job.id).status, "running")

                running_job.status = "completed"
                first_note_group.generation_status = "failed"
                db.commit()

                self.assertEqual(
                    auto_queue._dequeue_next_runnable_job(wait=False),
                    queued_job.id,
                )
                db.expire_all()
                self.assertEqual(db.get(Job, queued_job.id).status, "running")
                with auto_queue._condition:
                    self.assertEqual(list(auto_queue._queue), [])
        finally:
            db.close()

    def test_worker_discovers_persisted_queued_job_when_memory_queue_is_empty(self):
        import app.auto_queue as auto_queue

        db = self.SessionLocal()
        try:
            owner = User(
                id="persisted-queue-owner",
                supabase_user_id="persisted-queue-owner-sub",
                email="persisted-queue-owner@example.com",
                app_role="creator",
            )
            subject = Subject(
                id="persisted-queue-subject",
                title="Persisted Queue Subject",
                owner_user_id=owner.id,
            )
            module = Module(
                id="persisted-queue-module",
                subject_id=subject.id,
                title="Persisted Queue Module",
            )
            note_group = NoteGroup(
                id="persisted-queue-note-group",
                module_id=module.id,
                title="Queued Note Group",
                source="persisted-queue-source",
                raw_text="raw",
                generation_status="queued",
            )
            queued_job = Job(
                id="persisted-queue-job",
                type=JOB_TYPE_NOTE_GROUP_AUTO_GENERATION,
                status="queued",
                note_group_id=note_group.id,
            )
            db.add_all([owner, subject, module, note_group, queued_job])
            db.commit()

            with auto_queue._condition:
                auto_queue._queue.clear()
                auto_queue._queue_set.clear()

            with patch.object(auto_queue, "SessionLocal", self.SessionLocal):
                self.assertEqual(
                    auto_queue._dequeue_next_runnable_job(wait=False),
                    queued_job.id,
                )

            db.expire_all()
            self.assertEqual(db.get(Job, queued_job.id).status, "running")
        finally:
            db.close()

    def test_worker_loop_logs_and_continues_after_dequeue_exception(self):
        import app.auto_queue as auto_queue

        with patch.object(
            auto_queue,
            "_dequeue_next_runnable_job",
            side_effect=[RuntimeError("dequeue exploded"), KeyboardInterrupt()],
        ), patch.object(auto_queue.logger, "exception") as log_exception, patch.object(
            auto_queue,
            "run_auto_note_group_generation",
        ) as run_auto:
            with self.assertRaises(KeyboardInterrupt):
                auto_queue._worker_loop()

        self.assertEqual(run_auto.call_count, 0)
        self.assertEqual(log_exception.call_count, 1)
        self.assertIn(
            "failed while dequeuing next runnable job",
            log_exception.call_args.args[0],
        )

    def test_worker_loop_logs_and_continues_after_run_exception(self):
        import app.auto_queue as auto_queue

        with patch.object(
            auto_queue,
            "_dequeue_next_runnable_job",
            side_effect=["job-123", KeyboardInterrupt()],
        ), patch.object(
            auto_queue,
            "run_auto_note_group_generation",
            side_effect=RuntimeError("run exploded"),
        ) as run_auto, patch.object(auto_queue.logger, "exception") as log_exception:
            with self.assertRaises(KeyboardInterrupt):
                auto_queue._worker_loop()

        self.assertEqual(run_auto.call_count, 1)
        self.assertEqual(log_exception.call_count, 1)
        self.assertIn(
            "failed while running job",
            log_exception.call_args.args[0],
        )


class DraftFirstAutoGenerationTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(self.engine, "connect")
        def _set_sqlite_pragma(dbapi_connection, connection_record) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        Base.metadata.create_all(bind=self.engine)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)

    def tearDown(self):
        Base.metadata.drop_all(bind=self.engine)

    def _create_auto_generation_job(self, db, suffix: str = "draft-auto") -> Job:
        owner = User(
            id=f"auto-owner-{suffix}",
            supabase_user_id=f"auto-owner-sub-{suffix}",
            email=f"auto-owner-{suffix}@example.com",
            app_role="creator",
        )
        subject = Subject(
            id=f"auto-subject-{suffix}",
            title=f"Auto Subject {suffix}",
            goal="Understand draft generation",
            scope="Draft workflow",
            owner_user_id=owner.id,
        )
        module = Module(
            id=f"auto-module-{suffix}",
            subject_id=subject.id,
            title=f"Auto Module {suffix}",
            description="Module description",
            goal="Module goal",
            scope="Module scope",
        )
        note_group = NoteGroup(
            id=f"auto-note-group-{suffix}",
            module_id=module.id,
            title="Original title",
            source="unique-source",
            raw_text="Raw concept text with exact evidence.",
            generation_status="queued",
        )
        job = Job(
            id=f"auto-job-{suffix}",
            type=JOB_TYPE_NOTE_GROUP_AUTO_GENERATION,
            status="queued",
            note_group_id=note_group.id,
        )
        db.add_all([owner, subject, module, note_group, job])
        db.commit()
        return job

    def test_delete_unfinished_job_removes_placeholder_note_group_and_workflow(self):
        db = self.SessionLocal()
        try:
            job = self._create_auto_generation_job(db, "delete-unfinished")
            job_id = job.id
            note_group_id = job.note_group_id
            initialize_job_workflow(db, job, "raw text", "unique-id", None)
            draft = db.query(NoteGroupGenerationDraft).filter_by(job_id=job_id).one()
            db.add(
                DraftStudyCard(
                    id="delete-draft-card",
                    draft_id=draft.id,
                    title="Draft Card",
                    content="Draft card content",
                    sort_order=0,
                )
            )
            append_job_log(db, job, JOB_STAGE_STUDY_CARDS, "Created draft Study Card")
            db.commit()

            delete_unfinished_job_workflow(db, job)
            db.commit()

            self.assertIsNone(db.get(Job, job_id))
            self.assertIsNone(db.get(NoteGroup, note_group_id))
            self.assertEqual(db.query(NoteGroupGenerationDraft).filter_by(job_id=job_id).count(), 0)
            self.assertEqual(db.query(JobStage).filter_by(job_id=job_id).count(), 0)
            self.assertEqual(db.query(JobLog).filter_by(job_id=job_id).count(), 0)
            self.assertEqual(db.query(DraftStudyCard).count(), 0)
        finally:
            db.close()

    def test_delete_running_job_requests_cancel_and_worker_deletes_placeholder(self):
        db = self.SessionLocal()
        try:
            job = self._create_auto_generation_job(db, "delete-running")
            job_id = job.id
            note_group_id = job.note_group_id
            job.status = "running"
            initialize_job_workflow(db, job, "raw text", "unique-id", None)
            db.commit()

            deleted = request_unfinished_job_delete(db, job)
            db.commit()

            self.assertFalse(deleted)
            self.assertIsNotNone(db.get(Job, job_id))
            self.assertIsNotNone(db.get(NoteGroup, note_group_id))
            self.assertEqual(db.get(Job, job_id).status, "cancelled")
            self.assertEqual(db.get(Job, job_id).error, JOB_DELETE_REQUESTED_ERROR)
            db.close()

            self._run_with_mocks(job_id)

            db = self.SessionLocal()
            self.assertIsNone(db.get(Job, job_id))
            self.assertIsNone(db.get(NoteGroup, note_group_id))
            self.assertEqual(db.query(NoteGroupGenerationDraft).filter_by(job_id=job_id).count(), 0)
            self.assertEqual(db.query(JobStage).filter_by(job_id=job_id).count(), 0)
            self.assertEqual(db.query(JobLog).filter_by(job_id=job_id).count(), 0)
            self.assertEqual(db.query(StudyCard).filter_by(note_group_id=note_group_id).count(), 0)
        finally:
            db.close()

    def test_delete_request_wins_when_running_stage_fails_before_cancel_check(self):
        db = self.SessionLocal()
        try:
            job = self._create_auto_generation_job(db, "delete-running-failure")
            job_id = job.id
            note_group_id = job.note_group_id
            db.close()

            def request_delete_then_fail(*_args, **_kwargs):
                delete_db = self.SessionLocal()
                try:
                    delete_job = delete_db.get(Job, job_id)
                    request_unfinished_job_delete(delete_db, delete_job)
                    delete_db.commit()
                finally:
                    delete_db.close()
                raise RuntimeError("cleaning failed after delete request")

            self._run_with_mocks(job_id, cleaned_text=request_delete_then_fail)

            db = self.SessionLocal()
            self.assertIsNone(db.get(Job, job_id))
            self.assertIsNone(db.get(NoteGroup, note_group_id))
            self.assertEqual(db.query(NoteGroupGenerationDraft).filter_by(job_id=job_id).count(), 0)
            self.assertEqual(db.query(JobStage).filter_by(job_id=job_id).count(), 0)
            self.assertEqual(db.query(JobLog).filter_by(job_id=job_id).count(), 0)
        finally:
            db.close()

    def test_repeated_delete_request_keeps_running_job_tombstone_for_worker_cleanup(self):
        db = self.SessionLocal()
        try:
            job = self._create_auto_generation_job(db, "delete-running-repeat")
            job_id = job.id
            note_group_id = job.note_group_id
            job.status = "running"
            initialize_job_workflow(db, job, "raw text", "unique-id", None)
            db.commit()

            first_deleted = request_unfinished_job_delete(db, job)
            second_deleted = request_unfinished_job_delete(db, job)
            db.commit()

            self.assertFalse(first_deleted)
            self.assertFalse(second_deleted)
            self.assertIsNotNone(db.get(Job, job_id))
            self.assertIsNotNone(db.get(NoteGroup, note_group_id))
            self.assertEqual(db.get(Job, job_id).status, "cancelled")
            self.assertEqual(db.get(Job, job_id).error, JOB_DELETE_REQUESTED_ERROR)
            db.close()

            self._run_with_mocks(job_id)

            db = self.SessionLocal()
            self.assertIsNone(db.get(Job, job_id))
            self.assertIsNone(db.get(NoteGroup, note_group_id))
        finally:
            db.close()

    def _run_with_mocks(self, job_id: str, **overrides) -> None:
        import app.jobs as jobs

        defaults = {
            "title_suggestions": ["Drafted title"],
            "cleaned_text": "Raw concept text with exact evidence.",
            "study_cards": [
                {
                    "title": "Concept",
                    "content": "Concept content",
                    "evidence_snippets": ["exact evidence"],
                }
            ],
            "formatted_sections": [],
            "embeddings": [[0.1] * 1536],
            "questions": [],
            "topics": {"topics": [], "study_card_topic_links": []},
            "knowledge_nodes": {
                "knowledge_nodes": [],
                "relations": [],
                "study_card_knowledge_node_links": [],
            },
        }
        defaults.update(overrides)

        def mock_kwargs(value):
            if isinstance(value, Exception):
                return {"side_effect": value}
            if callable(value):
                return {"side_effect": value}
            return {"return_value": value}

        question_mock_kwargs = {}
        if isinstance(defaults["questions"], Exception):
            question_mock_kwargs["side_effect"] = defaults["questions"]
        elif callable(defaults["questions"]):
            question_mock_kwargs["side_effect"] = defaults["questions"]
        else:
            question_mock_kwargs["return_value"] = defaults["questions"]

        topic_mock_kwargs = {}
        if callable(defaults["topics"]):
            topic_mock_kwargs["side_effect"] = defaults["topics"]
        else:
            topic_mock_kwargs["return_value"] = defaults["topics"]

        with (
            patch.object(jobs, "SessionLocal", self.SessionLocal),
            patch.object(jobs, "generate_note_group_title_suggestions", return_value=defaults["title_suggestions"]),
            patch.object(jobs, "generate_cleaned_text_markdown", **mock_kwargs(defaults["cleaned_text"])),
            patch.object(jobs, "generate_study_cards_with_context", return_value=defaults["study_cards"]),
            patch.object(jobs, "generate_formatted_sections", **mock_kwargs(defaults["formatted_sections"])),
            patch.object(jobs, "embed_texts", return_value=defaults["embeddings"]),
            patch.object(jobs, "generate_question_cards", **question_mock_kwargs),
            patch.object(jobs, "generate_mind_map_candidate_graph", **topic_mock_kwargs),
            patch.object(jobs, "generate_topic_knowledge_node_candidates", **mock_kwargs(defaults["knowledge_nodes"])),
        ):
            jobs.run_auto_note_group_generation(job_id)

    def _run_with_extra_patches(self, job_id: str, extra_patches, **overrides) -> None:
        import app.jobs as jobs

        defaults = {
            "title_suggestions": ["Drafted title"],
            "cleaned_text": "Raw concept text with exact evidence.",
            "study_cards": [
                {
                    "title": "Concept",
                    "content": "Concept content",
                    "evidence_snippets": ["exact evidence"],
                }
            ],
            "formatted_sections": [],
            "embeddings": [[0.1] * 1536],
            "questions": [],
            "topics": {"topics": [], "study_card_topic_links": []},
            "knowledge_nodes": {
                "knowledge_nodes": [],
                "relations": [],
                "study_card_knowledge_node_links": [],
            },
        }
        defaults.update(overrides)

        def mock_kwargs(value):
            if isinstance(value, Exception):
                return {"side_effect": value}
            if callable(value):
                return {"side_effect": value}
            return {"return_value": value}

        with ExitStack() as stack:
            stack.enter_context(patch.object(jobs, "SessionLocal", self.SessionLocal))
            stack.enter_context(
                patch.object(jobs, "generate_note_group_title_suggestions", return_value=defaults["title_suggestions"])
            )
            stack.enter_context(patch.object(jobs, "generate_cleaned_text_markdown", **mock_kwargs(defaults["cleaned_text"])))
            stack.enter_context(patch.object(jobs, "generate_study_cards_with_context", return_value=defaults["study_cards"]))
            stack.enter_context(patch.object(jobs, "generate_formatted_sections", return_value=defaults["formatted_sections"]))
            stack.enter_context(patch.object(jobs, "embed_texts", return_value=defaults["embeddings"]))
            stack.enter_context(patch.object(jobs, "generate_question_cards", **mock_kwargs(defaults["questions"])))
            stack.enter_context(patch.object(jobs, "generate_mind_map_candidate_graph", **mock_kwargs(defaults["topics"])))
            stack.enter_context(
                patch.object(jobs, "generate_topic_knowledge_node_candidates", **mock_kwargs(defaults["knowledge_nodes"]))
            )
            for extra_patch in extra_patches:
                stack.enter_context(extra_patch)
            jobs.run_auto_note_group_generation(job_id)

    def test_question_generation_failure_keeps_cards_and_embeddings_in_draft_only(self):
        db = self.SessionLocal()
        try:
            job = self._create_auto_generation_job(db, "question-failure")
            job_id = job.id
            note_group_id = job.note_group_id
            db.close()

            self._run_with_mocks(
                job_id,
                questions=RuntimeError("question generation failed"),
            )

            db = self.SessionLocal()
            stored_job = db.get(Job, job_id)
            draft = db.query(NoteGroupGenerationDraft).filter_by(job_id=job_id).one()
            draft_cards = db.query(DraftStudyCard).filter_by(draft_id=draft.id).all()

            self.assertEqual(stored_job.status, "failed")
            self.assertEqual(stored_job.current_stage, JOB_STAGE_QUESTION_CARDS)
            self.assertEqual(stored_job.stage_status, "failed")
            self.assertEqual(db.query(StudyCard).filter_by(note_group_id=note_group_id).count(), 0)
            self.assertEqual(db.query(QuestionCard).filter_by(note_group_id=note_group_id).count(), 0)
            self.assertEqual(db.query(StudyCardEmbedding).filter_by(note_group_id=note_group_id).count(), 0)
            self.assertEqual(db.query(DraftQuestionCard).filter_by(draft_id=draft.id).count(), 0)
            self.assertEqual(len(draft_cards), 1)
            self.assertEqual(len(json.loads(draft_cards[0].embedding_json)), 1536)
            self.assertEqual(
                db.query(DraftStudyCardSourceRange)
                .filter_by(draft_study_card_id=draft_cards[0].id)
                .count(),
                1,
            )
        finally:
            db.close()

    def test_matched_study_cards_skip_source_range_repair(self):
        import app.jobs as jobs

        db = self.SessionLocal()
        try:
            job = self._create_auto_generation_job(db, "matched-skip-repair")
            job_id = job.id
            note_group_id = job.note_group_id
            repair_mock = Mock(side_effect=AssertionError("matched Study Card should not enter repair"))
            db.close()

            self._run_with_extra_patches(
                job_id,
                [patch.object(jobs, "repair_study_card_source_ranges", repair_mock)],
            )

            db = self.SessionLocal()
            live_card = db.query(StudyCard).filter_by(note_group_id=note_group_id).one()

            self.assertFalse(repair_mock.called)
            self.assertEqual(db.query(StudyCardSourceRange).filter_by(study_card_id=live_card.id).count(), 1)
        finally:
            db.close()

    def test_unmatched_study_card_is_repaired_and_promoted_with_verified_source_ranges(self):
        import app.jobs as jobs

        db = self.SessionLocal()
        try:
            job = self._create_auto_generation_job(db, "repair-promoted")
            job_id = job.id
            note_group_id = job.note_group_id
            repair_mock = Mock(return_value={"evidence_snippets": ["exact evidence"]})
            db.close()

            self._run_with_extra_patches(
                job_id,
                [patch.object(jobs, "repair_study_card_source_ranges", repair_mock)],
                study_cards=[
                    {
                        "title": "Concept",
                        "content": "Concept content",
                        "evidence_snippets": ["not copied from Cleaned Text"],
                    }
                ],
            )

            db = self.SessionLocal()
            live_card = db.query(StudyCard).filter_by(note_group_id=note_group_id).one()
            source_range = db.query(StudyCardSourceRange).filter_by(study_card_id=live_card.id).one()
            cleaned_text = db.get(NoteGroup, note_group_id).cleaned_text_markdown

            repair_mock.assert_called_once()
            self.assertEqual(cleaned_text[source_range.start_index:source_range.end_index], "exact evidence")
        finally:
            db.close()

    def test_multiple_unmatched_study_cards_repair_count_is_logged_and_worker_pool_is_capped(self):
        import app.jobs as jobs

        class RecordingExecutor:
            def __init__(self, max_workers):
                max_workers_seen.append(max_workers)

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def shutdown(self, wait=True, cancel_futures=False):
                return None

            def submit(self, fn, *args, **kwargs):
                future = Future()
                try:
                    future.set_result(fn(*args, **kwargs))
                except Exception as exc:
                    future.set_exception(exc)
                return future

        max_workers_seen = []
        db = self.SessionLocal()
        try:
            job = self._create_auto_generation_job(db, "repair-count")
            job_id = job.id
            db.close()

            repair_mock = Mock(return_value={"evidence_snippets": ["exact evidence"]})
            self._run_with_extra_patches(
                job_id,
                [
                    patch.object(jobs, "repair_study_card_source_ranges", repair_mock),
                    patch.object(jobs, "ThreadPoolExecutor", RecordingExecutor),
                ],
                study_cards=[
                    {
                        "title": f"Concept {index}",
                        "content": f"Concept content {index}",
                        "evidence_snippets": ["not copied from Cleaned Text"],
                    }
                    for index in range(6)
                ],
                embeddings=[[0.1, 0.2, 0.3]],
            )

            db = self.SessionLocal()
            stored_job = db.get(Job, job_id)
            repair_logs = [
                log
                for log in db.query(JobLog).filter_by(job_id=job_id).all()
                if log.message == "Repaired Source Ranges for 6 Study Cards"
            ]

            self.assertEqual(stored_job.status, "failed")
            self.assertEqual(stored_job.current_stage, JOB_STAGE_EMBEDDINGS)
            self.assertEqual(max_workers_seen, [5])
            self.assertEqual(repair_mock.call_count, 6)
            self.assertEqual(len(repair_logs), 1)
            self.assertEqual(json.loads(repair_logs[0].metadata_json), {"repair_count": 6})
        finally:
            db.close()

    def test_source_range_matching_preserves_evidence_snippet_whitespace_exactly(self):
        import app.jobs as jobs

        text = "Raw concept text with exact evidence."
        padded_text = "Raw concept text with exact evidence and padded  exact evidence ."

        self.assertEqual(jobs._find_exact_snippet_ranges(text, ["exact evidence"]), [(22, 36)])
        self.assertEqual(jobs._find_exact_snippet_ranges(text, [" exact evidence "]), [])
        self.assertEqual(jobs._find_exact_snippet_ranges(padded_text, [" exact evidence "]), [(21, 37), (48, 64)])

        with self.assertRaises(jobs.SourceRangeRepairError):
            jobs._find_exact_snippet_ranges(text, [" exact evidence "], require_all=True)

    def test_repaired_ranges_union_verified_offsets_and_snippets(self):
        import app.jobs as jobs

        text = "Alpha evidence. Beta evidence."

        ranges = jobs._verified_repair_source_ranges(
            text,
            {
                "evidence_snippets": ["Alpha evidence", "Beta evidence"],
                "source_ranges": [
                    {"start": 0, "end": 14, "snippet": "Alpha evidence"},
                ],
            },
        )

        self.assertEqual(ranges, [(0, 14), (16, 29)])

    def test_repair_failure_fails_study_card_stage_and_leaves_no_accepted_cards_or_ranges(self):
        import app.jobs as jobs

        db = self.SessionLocal()
        try:
            job = self._create_auto_generation_job(db, "repair-failure")
            job_id = job.id
            note_group_id = job.note_group_id
            repair_mock = Mock(return_value={"evidence_snippets": ["still not copied"]})
            db.close()

            self._run_with_extra_patches(
                job_id,
                [patch.object(jobs, "repair_study_card_source_ranges", repair_mock)],
                study_cards=[
                    {
                        "title": "Concept",
                        "content": "Concept content",
                        "evidence_snippets": ["not copied from Cleaned Text"],
                    }
                ],
            )

            db = self.SessionLocal()
            stored_job = db.get(Job, job_id)
            draft = db.query(NoteGroupGenerationDraft).filter_by(job_id=job_id).one()

            self.assertEqual(stored_job.status, "failed")
            self.assertEqual(stored_job.current_stage, JOB_STAGE_STUDY_CARDS)
            self.assertEqual(stored_job.stage_status, "failed")
            self.assertEqual(db.query(DraftStudyCard).filter_by(draft_id=draft.id).count(), 0)
            self.assertEqual(db.query(DraftStudyCardSourceRange).count(), 0)
            self.assertEqual(db.query(StudyCard).filter_by(note_group_id=note_group_id).count(), 0)
            self.assertEqual(db.query(StudyCardSourceRange).count(), 0)
        finally:
            db.close()

    def test_repaired_evidence_never_changes_study_card_title_or_content(self):
        import app.jobs as jobs

        db = self.SessionLocal()
        try:
            job = self._create_auto_generation_job(db, "repair-preserves-card")
            job_id = job.id
            note_group_id = job.note_group_id
            repair_mock = Mock(
                return_value={
                    "title": "Altered title",
                    "content": "Altered content",
                    "evidence_snippets": ["exact evidence"],
                }
            )
            db.close()

            self._run_with_extra_patches(
                job_id,
                [patch.object(jobs, "repair_study_card_source_ranges", repair_mock)],
                study_cards=[
                    {
                        "title": "Original title",
                        "content": "Original content",
                        "evidence_snippets": ["not copied from Cleaned Text"],
                    }
                ],
            )

            db = self.SessionLocal()
            live_card = db.query(StudyCard).filter_by(note_group_id=note_group_id).one()

            self.assertEqual(live_card.title, "Original title")
            self.assertEqual(live_card.content, "Original content")
        finally:
            db.close()

    def test_embedding_count_mismatch_fails_embeddings_stage(self):
        db = self.SessionLocal()
        try:
            job = self._create_auto_generation_job(db, "embedding-mismatch")
            job_id = job.id
            db.close()

            self._run_with_mocks(
                job_id,
                study_cards=[
                    {"title": "One", "content": "One content", "evidence_snippets": ["exact evidence"]},
                    {"title": "Two", "content": "Two content", "evidence_snippets": ["exact evidence"]},
                ],
                embeddings=[[0.1, 0.2, 0.3]],
            )

            db = self.SessionLocal()
            stored_job = db.get(Job, job_id)
            draft = db.query(NoteGroupGenerationDraft).filter_by(job_id=job_id).one()
            draft_cards = db.query(DraftStudyCard).filter_by(draft_id=draft.id).all()

            self.assertEqual(stored_job.status, "failed")
            self.assertEqual(stored_job.current_stage, JOB_STAGE_EMBEDDINGS)
            self.assertEqual(stored_job.stage_status, "failed")
            self.assertEqual(len(draft_cards), 2)
            self.assertTrue(all(card.embedding_json is None for card in draft_cards))
        finally:
            db.close()

    def test_retry_clears_stale_draft_artifacts_before_early_failure(self):
        db = self.SessionLocal()
        try:
            job = self._create_auto_generation_job(db, "retry-stale")
            job_id = job.id
            draft = NoteGroupGenerationDraft(
                id="stale-draft",
                job_id=job_id,
                module_id=job.note_group.module_id,
                note_group_id=job.note_group_id,
                raw_text="old raw",
                current_stage=JOB_STAGE_MIND_MAP_TOPICS,
                title="Old title",
                cleaned_text_markdown="old cleaned",
            )
            stale_card = DraftStudyCard(
                id="stale-draft-card",
                draft_id="stale-draft",
                title="Stale",
                content="Stale content",
                embedding_json="[1.0]",
            )
            stale_question = DraftQuestionCard(
                id="stale-draft-question",
                draft_id="stale-draft",
                type="mcq",
                prompt="Stale question?",
                options_json=json.dumps(["A", "B"]),
                correct_option_indices_json=json.dumps([0]),
                study_card_refs_json=json.dumps(["stale-draft-card"]),
            )
            stale_topic = DraftTopic(
                id="stale-draft-topic",
                draft_id="stale-draft",
                module_id=job.note_group.module_id,
                relation_endpoint_id="stale-draft-topic",
                label="Stale topic",
            )
            db.add_all([draft, stale_card, stale_question, stale_topic])
            db.commit()
            db.close()

            self._run_with_mocks(
                job_id,
                cleaned_text=RuntimeError("cleaning failed"),
            )

            db = self.SessionLocal()
            stored_job = db.get(Job, job_id)
            draft = db.query(NoteGroupGenerationDraft).filter_by(job_id=job_id).one()

            self.assertEqual(stored_job.status, "failed")
            self.assertEqual(stored_job.current_stage, JOB_STAGE_CLEANED_TEXT)
            self.assertIsNone(draft.cleaned_text_markdown)
            self.assertEqual(db.query(DraftStudyCard).filter_by(draft_id=draft.id).count(), 0)
            self.assertEqual(db.query(DraftQuestionCard).filter_by(draft_id=draft.id).count(), 0)
            self.assertEqual(db.query(DraftTopic).filter_by(draft_id=draft.id).count(), 0)
        finally:
            db.close()

    def test_retry_from_failed_question_cards_preserves_earlier_draft_outputs_and_finishes_same_job(self):
        db = self.SessionLocal()
        try:
            job = self._create_auto_generation_job(db, "retry-question-stage")
            job_id = job.id
            db.close()

            self._run_with_mocks(
                job_id,
                questions=RuntimeError("question generation failed"),
            )

            db = self.SessionLocal()
            stored_job = db.get(Job, job_id)
            note_group_id = stored_job.note_group_id
            draft = db.query(NoteGroupGenerationDraft).filter_by(job_id=job_id).one()
            draft_card = db.query(DraftStudyCard).filter_by(draft_id=draft.id).one()
            preserved_draft_card_id = draft_card.id
            preserved_embedding_json = draft_card.embedding_json

            self.assertEqual(stored_job.status, "failed")
            self.assertEqual(stored_job.current_stage, JOB_STAGE_QUESTION_CARDS)
            self.assertEqual(stored_job.stage_status, "failed")
            self.assertIsNotNone(preserved_embedding_json)

            published_events = []
            with patch("app.generation_events.generation_event_bus.publish", published_events.append):
                retried_job = retry_failed_job_stage(db, stored_job)
                db.commit()

            self.assertEqual(retried_job.id, job_id)
            self.assertEqual([event.event for event in published_events], ["workflow_retry_queued"])

            db.expire_all()
            retried_job = db.get(Job, job_id)
            retried_draft = db.query(NoteGroupGenerationDraft).filter_by(job_id=job_id).one()
            stages = {
                stage.stage: stage
                for stage in db.query(JobStage).filter(JobStage.job_id == job_id).all()
            }
            preserved_draft_card = (
                db.query(DraftStudyCard).filter_by(draft_id=retried_draft.id).one()
            )

            self.assertEqual(retried_job.status, "queued")
            self.assertIsNone(retried_job.error)
            self.assertEqual(retried_job.note_group.generation_status, "queued")
            self.assertEqual(retried_draft.current_stage, JOB_STAGE_QUESTION_CARDS)
            self.assertEqual(stages[JOB_STAGE_STUDY_CARDS].status, "succeeded")
            self.assertEqual(stages[JOB_STAGE_EMBEDDINGS].status, "succeeded")
            self.assertEqual(stages[JOB_STAGE_QUESTION_CARDS].status, "pending")
            self.assertEqual(stages[JOB_STAGE_MIND_MAP_TOPICS].status, "pending")
            self.assertEqual(stages[JOB_STAGE_TOPIC_KNOWLEDGE_NODES].status, "pending")
            self.assertEqual(preserved_draft_card.id, preserved_draft_card_id)
            self.assertEqual(preserved_draft_card.embedding_json, preserved_embedding_json)
            self.assertEqual(
                db.query(DraftQuestionCard).filter_by(draft_id=retried_draft.id).count(),
                0,
            )
            db.close()

            def question_payloads(study_cards, **_kwargs):
                return [
                    {
                        "type": "mcq",
                        "prompt": "Which statement is correct?",
                        "options": ["Concept content", "Other", "Wrong", "No"],
                        "correct_option_indices": [0],
                        "study_card_refs": [study_cards[0]["studyCardId"]],
                    }
                ]

            self._run_with_extra_patches(
                job_id,
                [
                    patch(
                        "app.jobs.generate_note_group_title_suggestions",
                        side_effect=AssertionError("title stage should not rerun"),
                    ),
                    patch(
                        "app.jobs.generate_cleaned_text_markdown",
                        side_effect=AssertionError("cleaned text stage should not rerun"),
                    ),
                    patch(
                        "app.jobs.generate_study_cards_with_context",
                        side_effect=AssertionError("study card stage should not rerun"),
                    ),
                    patch(
                        "app.jobs.generate_formatted_sections",
                        side_effect=AssertionError("formatted text stage should not rerun"),
                    ),
                    patch(
                        "app.jobs.embed_texts",
                        side_effect=AssertionError("embeddings stage should not rerun"),
                    ),
                ],
                questions=question_payloads,
            )

            db = self.SessionLocal()
            note_group = db.get(NoteGroup, note_group_id)

            self.assertIsNone(db.get(Job, job_id))
            self.assertEqual(note_group.generation_status, "complete")
            self.assertEqual(db.query(StudyCard).filter_by(note_group_id=note_group_id).count(), 1)
            self.assertEqual(db.query(QuestionCard).filter_by(note_group_id=note_group_id).count(), 1)
            self.assertEqual(db.query(NoteGroupGenerationDraft).filter_by(note_group_id=note_group_id).count(), 0)
        finally:
            db.close()

    def test_auto_generation_promotes_completed_draft_to_live_tables_and_discards_workflow(self):
        db = self.SessionLocal()
        try:
            job = self._create_auto_generation_job(db, "promotion-success")
            job_id = job.id
            note_group_id = job.note_group_id
            module_id = job.note_group.module_id
            db.close()

            captured_refs = []

            def question_payloads(study_cards, **_kwargs):
                captured_refs[:] = [card["studyCardId"] for card in study_cards]
                return [
                    {
                        "type": "mcq",
                        "prompt": "Which statement is correct?",
                        "options": ["Concept content", "Other", "Wrong", "No"],
                        "correct_option_indices": [0],
                        "study_card_refs": [*captured_refs, "live-or-stale-card"],
                    }
                ]

            def topic_payload(*_args, **_kwargs):
                return {
                    "topics": [
                        {
                            "temp_id": "topic-draft-1",
                            "title": "Draft Topic",
                            "summary": "Draft topic summary",
                        }
                    ],
                    "study_card_topic_links": [
                        {
                            "study_card_id": captured_refs[0],
                            "topic_id": "topic-draft-1",
                            "role": "primary",
                        }
                    ],
                }

            def knowledge_payload(*_args, **kwargs):
                topic_id = kwargs["selected_topic"]["topic_id"]
                return {
                    "knowledge_nodes": [
                        {
                            "temp_id": "node-definition-1",
                            "topic_id": topic_id,
                            "title": "Draft Topic definition",
                            "summary": "Defines the draft topic.",
                            "knowledge_type": "definition",
                            "importance": "core",
                        },
                        {
                            "temp_id": "node-fact-1",
                            "topic_id": topic_id,
                            "title": "Draft Topic fact",
                            "summary": "A supporting fact.",
                            "knowledge_type": "fact",
                            "importance": "supporting",
                        }
                    ],
                    "relations": [
                        {
                            "source_knowledge_node_id": "node-definition-1",
                            "target_knowledge_node_id": "node-fact-1",
                            "relation_type": "related_to",
                            "confidence": 0.9,
                        }
                    ],
                    "study_card_knowledge_node_links": [
                        {
                            "study_card_id": captured_refs[0],
                            "knowledge_node_id": "node-definition-1",
                            "role": "primary",
                        }
                    ],
                }

            self._run_with_mocks(
                job_id,
                questions=question_payloads,
                topics=topic_payload,
                knowledge_nodes=knowledge_payload,
            )

            db = self.SessionLocal()
            note_group = db.get(NoteGroup, note_group_id)
            live_card = db.query(StudyCard).filter_by(note_group_id=note_group_id).one()
            live_question = db.query(QuestionCard).filter_by(note_group_id=note_group_id).one()
            live_topic = db.query(TopicChip).filter_by(module_id=module_id).one()
            live_node = db.query(MindMapConcept).filter_by(module_id=module_id, title="Draft Topic definition").one()

            self.assertIsNone(db.get(Job, job_id))
            self.assertEqual(db.query(NoteGroupGenerationDraft).filter_by(job_id=job_id).count(), 0)
            self.assertEqual(db.query(JobStage).filter_by(job_id=job_id).count(), 0)
            self.assertEqual(db.query(JobLog).filter_by(job_id=job_id).count(), 0)
            self.assertEqual(note_group.generation_status, "complete")
            self.assertEqual(note_group.title, "Drafted title")
            self.assertEqual(note_group.cleaned_text_markdown, "Raw concept text with exact evidence.")
            self.assertIsNotNone(note_group.formatted_text)
            self.assertEqual(note_group.formatted_sections[0]["study_card_id"], live_card.id)
            self.assertNotIn(captured_refs[0], json.dumps(note_group.formatted_sections))
            self.assertEqual(note_group.mind_map_status, "complete")
            self.assertFalse(note_group.mind_map_stale)
            self.assertIsNotNone(note_group.mind_map_generated_at)
            self.assertEqual(live_card.title, "Concept")
            self.assertEqual(db.query(StudyCardSourceRange).filter_by(study_card_id=live_card.id).count(), 1)
            self.assertEqual(db.query(StudyCardEmbedding).filter_by(study_card_id=live_card.id).count(), 1)
            self.assertEqual(json.loads(live_question.study_card_refs_json), [live_card.id])
            self.assertNotIn(captured_refs[0], json.loads(live_question.study_card_refs_json))
            self.assertEqual(live_topic.label, "Draft Topic")
            self.assertEqual(live_topic.knowledge_node_status, "complete")
            self.assertEqual(live_node.title, "Draft Topic definition")
            self.assertEqual(live_node.topic_id, live_topic.id)
            self.assertEqual(
                db.execute(
                    note_group_topic_chips.select().where(
                        note_group_topic_chips.c.note_group_id == note_group_id,
                        note_group_topic_chips.c.chip_id == live_topic.id,
                    )
                ).first()
                is not None,
                True,
            )
            self.assertEqual(
                db.execute(
                    study_card_topic_chips.select().where(
                        study_card_topic_chips.c.study_card_id == live_card.id,
                        study_card_topic_chips.c.chip_id == live_topic.id,
                    )
                ).first()
                is not None,
                True,
            )
            self.assertEqual(db.query(NoteGroupMindMapConcept).filter_by(note_group_id=note_group_id).count(), 1)
            self.assertEqual(db.query(StudyCardMindMapConcept).filter_by(study_card_id=live_card.id).count(), 1)
            self.assertEqual(db.query(MindMapRelation).filter_by(source_note_group_id=note_group_id).count(), 0)
            self.assertEqual(db.query(DraftStudyCard).count(), 0)
            self.assertEqual(db.query(DraftQuestionCard).count(), 0)
            self.assertEqual(db.query(DraftTopic).count(), 0)
            self.assertEqual(db.query(DraftKnowledgeNode).count(), 0)
        finally:
            db.close()

    def test_auto_generation_reconciles_draft_knowledge_nodes_per_topic_child_first(self):
        db = self.SessionLocal()
        try:
            job = self._create_auto_generation_job(db, "draft-per-topic-knowledge")
            job_id = job.id
            db.close()

            topic_payload = {
                "topics": [
                    {
                        "temp_id": "topic-parent",
                        "title": "Draft Parent",
                        "summary": "Parent summary",
                    },
                    {
                        "temp_id": "topic-child",
                        "title": "Draft Child",
                        "summary": "Child summary",
                        "parent_topic_id": "topic-parent",
                    },
                ],
                "study_card_topic_links": [],
            }
            called_topic_titles = []

            def knowledge_payload(*_args, **kwargs):
                topic = kwargs["selected_topic"]
                called_topic_titles.append([topic["title"]])
                return {
                    "knowledge_nodes": [
                        {
                            "temp_id": f"node-{topic['topic_id']}",
                            "topic_id": topic["topic_id"],
                            "title": f"{topic['title']} definition",
                            "summary": f"{topic['title']} definition summary",
                            "knowledge_type": "definition",
                            "importance": "core",
                        }
                    ],
                    "relations": [],
                    "study_card_knowledge_node_links": [],
                }

            self._run_with_mocks(
                job_id,
                topics=topic_payload,
                knowledge_nodes=knowledge_payload,
            )

            self.assertEqual(called_topic_titles, [])
        finally:
            db.close()

    def test_auto_generation_promotes_draft_topic_summary_as_definition_without_live_description(self):
        db = self.SessionLocal()
        try:
            job = self._create_auto_generation_job(db, "draft-topic-summary-definition")
            job_id = job.id
            module_id = job.note_group.module_id
            db.close()

            self._run_with_mocks(
                job_id,
                topics={
                    "topics": [
                        {
                            "temp_id": "topic-draft-1",
                            "title": "Draft Topic",
                            "summary": "Draft topic summary",
                        }
                    ],
                    "study_card_topic_links": [],
                },
                knowledge_nodes=AssertionError("new draft topics should not need a second definition LLM call"),
            )

            db = self.SessionLocal()
            live_topic = db.query(TopicChip).filter_by(module_id=module_id).one()
            definition = db.query(MindMapConcept).filter_by(module_id=module_id, topic_id=live_topic.id).one()

            self.assertIsNone(db.get(Job, job_id))
            self.assertIsNone(live_topic.description)
            self.assertEqual(definition.knowledge_type, "definition")
            self.assertEqual(definition.summary, "Draft topic summary")
        finally:
            db.close()

    def test_promotion_failure_rolls_back_live_rows_and_keeps_draft_failed_at_promoting(self):
        db = self.SessionLocal()
        try:
            job = self._create_auto_generation_job(db, "promotion-failure")
            job_id = job.id
            note_group_id = job.note_group_id
            module_id = job.note_group.module_id
            db.close()

            def knowledge_payload(*_args, **kwargs):
                topic_id = kwargs["selected_topic"]["topic_id"]
                return {
                    "knowledge_nodes": [
                        {
                            "temp_id": "node-definition-1",
                            "topic_id": topic_id,
                            "title": "Definition",
                            "summary": "Definition summary",
                            "knowledge_type": "definition",
                            "importance": "core",
                        }
                    ],
                    "relations": [],
                    "study_card_knowledge_node_links": [],
                }

            self._run_with_extra_patches(
                job_id,
                [patch("app.generation_promotion.upsert_study_card_embeddings", side_effect=RuntimeError("embed write failed"))],
                topics={
                    "topics": [
                        {
                            "temp_id": "topic-draft-1",
                            "title": "Draft Topic",
                            "summary": "",
                        }
                    ],
                    "study_card_topic_links": [],
                },
                knowledge_nodes=knowledge_payload,
            )

            db = self.SessionLocal()
            stored_job = db.get(Job, job_id)
            draft = db.query(NoteGroupGenerationDraft).filter_by(job_id=job_id).one()

            self.assertEqual(stored_job.status, "failed")
            self.assertEqual(stored_job.current_stage, JOB_STAGE_PROMOTING)
            self.assertEqual(stored_job.stage_status, "failed")
            self.assertEqual(db.query(StudyCard).filter_by(note_group_id=note_group_id).count(), 0)
            self.assertEqual(db.query(QuestionCard).filter_by(note_group_id=note_group_id).count(), 0)
            self.assertEqual(db.query(TopicChip).filter_by(module_id=module_id).count(), 0)
            self.assertEqual(db.query(MindMapConcept).filter_by(module_id=module_id).count(), 0)
            self.assertEqual(db.query(MindMapRelation).filter_by(module_id=module_id).count(), 0)
            self.assertEqual(db.query(DraftStudyCard).filter_by(draft_id=draft.id).count(), 1)
            self.assertEqual(db.query(DraftTopic).filter_by(draft_id=draft.id).count(), 1)
            self.assertEqual(db.query(DraftKnowledgeNode).filter_by(draft_id=draft.id).count(), 1)
        finally:
            db.close()

    def test_promotion_failure_with_existing_topic_keeps_live_topic_surfaces_clean(self):
        db = self.SessionLocal()
        try:
            job = self._create_auto_generation_job(db, "promotion-existing-topic-failure")
            job_id = job.id
            note_group_id = job.note_group_id
            module_id = job.note_group.module_id
            db.add(
                TopicChip(
                    id="existing-topic-for-failed-promotion",
                    module_id=module_id,
                    label="Existing Topic",
                    description="Already live",
                )
            )
            db.commit()
            db.close()

            def topic_payload(*_args, **kwargs):
                study_card_id = kwargs["study_cards"][0]["study_card_id"]
                return {
                    "topics": [],
                    "study_card_topic_links": [
                        {
                            "study_card_id": study_card_id,
                            "topic_id": "existing-topic-for-failed-promotion",
                            "role": "primary",
                        }
                    ],
                }

            def knowledge_payload(*_args, **kwargs):
                study_card_id = kwargs["study_cards"][0]["id"]
                return {
                    "knowledge_nodes": [
                        {
                            "temp_id": "existing-topic-definition",
                            "topic_id": "existing-topic-for-failed-promotion",
                            "title": "Existing Topic definition",
                            "summary": "A draft definition that should not go live.",
                            "knowledge_type": "definition",
                            "importance": "core",
                        }
                    ],
                    "relations": [],
                    "study_card_knowledge_node_links": [
                        {
                            "study_card_id": study_card_id,
                            "knowledge_node_id": "existing-topic-definition",
                            "role": "primary",
                        }
                    ],
                }

            self._run_with_extra_patches(
                job_id,
                [patch("app.generation_promotion.upsert_study_card_embeddings", side_effect=RuntimeError("embed write failed"))],
                topics=topic_payload,
                knowledge_nodes=knowledge_payload,
            )

            db = self.SessionLocal()
            stored_job = db.get(Job, job_id)
            draft = db.query(NoteGroupGenerationDraft).filter_by(job_id=job_id).one()

            self.assertEqual(stored_job.status, "failed")
            self.assertEqual(stored_job.current_stage, JOB_STAGE_PROMOTING)
            self.assertEqual(db.query(TopicChip).filter_by(module_id=module_id).count(), 1)
            self.assertEqual(db.query(StudyCard).filter_by(note_group_id=note_group_id).count(), 0)
            self.assertEqual(db.query(QuestionCard).filter_by(note_group_id=note_group_id).count(), 0)
            self.assertEqual(db.query(StudyCardEmbedding).filter_by(note_group_id=note_group_id).count(), 0)
            self.assertEqual(db.query(MindMapConcept).filter_by(module_id=module_id).count(), 0)
            self.assertEqual(db.query(MindMapRelation).filter_by(module_id=module_id).count(), 0)
            self.assertIsNone(
                db.execute(
                    note_group_topic_chips.select().where(
                        note_group_topic_chips.c.note_group_id == note_group_id,
                        note_group_topic_chips.c.chip_id == "existing-topic-for-failed-promotion",
                    )
                ).first()
            )
            self.assertIsNone(
                db.execute(
                    study_card_topic_chips.select().where(
                        study_card_topic_chips.c.chip_id == "existing-topic-for-failed-promotion",
                    )
                ).first()
            )
            self.assertEqual(db.query(DraftStudyCard).filter_by(draft_id=draft.id).count(), 1)
            self.assertEqual(db.query(DraftStudyCardTopicLink).filter_by(draft_id=draft.id).count(), 1)
            self.assertEqual(db.query(DraftKnowledgeNode).filter_by(draft_id=draft.id).count(), 1)
            log_messages = [log.message for log in db.query(JobLog).filter_by(job_id=job_id).all()]
            self.assertIn(
                "Reconciling Concept Knowledge Nodes for 0 draft Concepts and 1 existing Concept",
                log_messages,
            )
        finally:
            db.close()

    def test_promotion_reuses_existing_topic_for_direct_study_card_link(self):
        db = self.SessionLocal()
        try:
            job = self._create_auto_generation_job(db, "promotion-existing-topic")
            job_id = job.id
            note_group_id = job.note_group_id
            module_id = job.note_group.module_id
            db.add(
                TopicChip(
                    id="existing-direct-topic",
                    module_id=module_id,
                    label="Existing Direct Topic",
                    description="Already present",
                )
            )
            db.commit()
            db.close()

            def topic_payload(*_args, **kwargs):
                study_card_id = kwargs["study_cards"][0]["study_card_id"]
                return {
                    "topics": [],
                    "study_card_topic_links": [
                        {
                            "study_card_id": study_card_id,
                            "topic_id": "existing-direct-topic",
                            "role": "primary",
                        }
                    ],
                }

            self._run_with_mocks(job_id, topics=topic_payload)

            db = self.SessionLocal()
            live_card = db.query(StudyCard).filter_by(note_group_id=note_group_id).one()

            self.assertIsNone(db.get(Job, job_id))
            self.assertEqual(db.query(TopicChip).filter_by(module_id=module_id).count(), 1)
            self.assertEqual(
                db.execute(
                    study_card_topic_chips.select().where(
                        study_card_topic_chips.c.study_card_id == live_card.id,
                        study_card_topic_chips.c.chip_id == "existing-direct-topic",
                    )
                ).first()
                is not None,
                True,
            )
            self.assertEqual(
                db.execute(
                    note_group_topic_chips.select().where(
                        note_group_topic_chips.c.note_group_id == note_group_id,
                        note_group_topic_chips.c.chip_id == "existing-direct-topic",
                    )
                ).first()
                is not None,
                True,
            )
        finally:
            db.close()

    def test_promotion_reuses_existing_topic_knowledge_node(self):
        db = self.SessionLocal()
        try:
            job = self._create_auto_generation_job(db, "promotion-existing-knowledge-node")
            job_id = job.id
            note_group_id = job.note_group_id
            module_id = job.note_group.module_id
            db.add(
                TopicChip(
                    id="existing-direct-topic",
                    module_id=module_id,
                    label="Existing Direct Topic",
                    description="Already present",
                )
            )
            db.add(
                MindMapConcept(
                    id="existing-definition-node",
                    module_id=module_id,
                    topic_id="existing-direct-topic",
                    slug="existing_direct_topic_definition",
                    title="Existing Direct Topic definition",
                    summary="Old definition.",
                    concept_type="term",
                    knowledge_type="definition",
                    importance="supporting",
                )
            )
            db.commit()
            db.close()

            def topic_payload(*_args, **kwargs):
                study_card_id = kwargs["study_cards"][0]["study_card_id"]
                return {
                    "topics": [],
                    "study_card_topic_links": [
                        {
                            "study_card_id": study_card_id,
                            "topic_id": "existing-direct-topic",
                            "role": "primary",
                        }
                    ],
                }

            def knowledge_payload(*_args, **kwargs):
                study_card_id = kwargs["study_cards"][0]["id"]
                return {
                    "knowledge_nodes": [
                        {
                            "temp_id": "node-definition-1",
                            "topic_id": "existing-direct-topic",
                            "title": "Existing Direct Topic definition",
                            "summary": "Updated definition.",
                            "knowledge_type": "definition",
                            "importance": "core",
                        }
                    ],
                    "relations": [],
                    "study_card_knowledge_node_links": [
                        {
                            "study_card_id": study_card_id,
                            "knowledge_node_id": "node-definition-1",
                            "role": "primary",
                        }
                    ],
                }

            self._run_with_mocks(job_id, topics=topic_payload, knowledge_nodes=knowledge_payload)

            db = self.SessionLocal()
            live_card = db.query(StudyCard).filter_by(note_group_id=note_group_id).one()
            reused_node = db.get(MindMapConcept, "existing-definition-node")

            self.assertIsNone(db.get(Job, job_id))
            self.assertEqual(db.query(MindMapConcept).filter_by(module_id=module_id).count(), 1)
            self.assertEqual(reused_node.summary, "Updated definition.")
            self.assertEqual(reused_node.importance, "core")
            self.assertEqual(
                db.query(NoteGroupMindMapConcept)
                .filter_by(note_group_id=note_group_id, concept_id="existing-definition-node")
                .count(),
                1,
            )
            self.assertEqual(
                db.query(StudyCardMindMapConcept)
                .filter_by(study_card_id=live_card.id, concept_id="existing-definition-node")
                .count(),
                1,
            )
        finally:
            db.close()

    def test_draft_topic_can_use_existing_module_topic_as_parent(self):
        db = self.SessionLocal()
        try:
            job = self._create_auto_generation_job(db, "existing-parent-topic")
            job_id = job.id
            note_group_id = job.note_group_id
            module_id = job.note_group.module_id
            db.add(
                TopicChip(
                    id="existing-parent-topic",
                    module_id=module_id,
                    label="Existing Parent",
                )
            )
            db.commit()
            db.close()

            def topic_payload(*_args, **kwargs):
                study_card_id = kwargs["study_cards"][0]["study_card_id"]
                return {
                    "topics": [
                        {
                            "temp_id": "draft-child-topic",
                            "title": "Draft Child Topic",
                            "summary": "Draft child topic summary",
                            "parent_topic_id": "existing-parent-topic",
                        }
                    ],
                    "study_card_topic_links": [
                        {
                            "study_card_id": study_card_id,
                            "topic_id": "existing-parent-topic",
                            "role": "supporting",
                        }
                    ],
                }

            self._run_with_mocks(job_id, topics=topic_payload)

            db = self.SessionLocal()
            child_topic = db.query(TopicChip).filter_by(module_id=module_id, label="Draft Child Topic").one()
            live_card = db.query(StudyCard).filter_by(note_group_id=note_group_id).one()

            self.assertIsNone(db.get(Job, job_id))
            self.assertEqual(child_topic.parent_topic_id, "existing-parent-topic")
            self.assertEqual(
                db.execute(
                    study_card_topic_chips.select().where(
                        study_card_topic_chips.c.study_card_id == live_card.id,
                        study_card_topic_chips.c.chip_id == "existing-parent-topic",
                    )
                ).first()
                is not None,
                True,
            )
            self.assertEqual(
                db.execute(
                    note_group_topic_chips.select().where(
                        note_group_topic_chips.c.note_group_id == note_group_id,
                        note_group_topic_chips.c.chip_id == "existing-parent-topic",
                    )
                ).first()
                is not None,
                True,
            )
        finally:
            db.close()

    def test_cancel_after_mind_map_topics_stays_cancelled(self):
        db = self.SessionLocal()
        try:
            job = self._create_auto_generation_job(db, "cancel-after-topics")
            job_id = job.id
            db.close()

            def cancel_during_knowledge_generation(*_args, **_kwargs):
                cancel_db = self.SessionLocal()
                try:
                    stored_job = cancel_db.get(Job, job_id)
                    stored_job.status = "cancelled"
                    cancel_db.commit()
                finally:
                    cancel_db.close()
                return {
                    "knowledge_nodes": [],
                    "relations": [],
                    "study_card_knowledge_node_links": [],
                }

            self._run_with_mocks(
                job_id,
                topics={
                    "topics": [
                        {
                            "temp_id": "topic-draft-1",
                            "title": "Draft Topic",
                            "summary": "",
                        }
                    ],
                    "study_card_topic_links": [],
                },
                knowledge_nodes=cancel_during_knowledge_generation,
            )

            db = self.SessionLocal()
            stored_job = db.get(Job, job_id)
            note_group = stored_job.note_group

            self.assertEqual(stored_job.status, "cancelled")
            self.assertEqual(note_group.generation_status, "cancelled")
            knowledge_stage = (
                db.query(JobStage)
                .filter(JobStage.job_id == job_id, JobStage.stage == JOB_STAGE_TOPIC_KNOWLEDGE_NODES)
                .one()
            )
            self.assertEqual(knowledge_stage.status, "cancelled")
        finally:
            db.close()

    def test_knowledge_node_generation_failure_marks_draft_topics_needs_review(self):
        db = self.SessionLocal()
        try:
            job = self._create_auto_generation_job(db, "knowledge-needs-review")
            job_id = job.id
            module_id = job.note_group.module_id
            db.close()

            self._run_with_mocks(
                job_id,
                topics={
                    "topics": [
                        {
                            "temp_id": "topic-draft-1",
                            "title": "Draft Topic",
                            "summary": "",
                        }
                    ],
                    "study_card_topic_links": [],
                },
                knowledge_nodes=RuntimeError("knowledge generation failed"),
            )

            db = self.SessionLocal()
            live_topic = db.query(TopicChip).filter_by(module_id=module_id).one()

            self.assertIsNone(db.get(Job, job_id))
            self.assertEqual(live_topic.knowledge_node_status, "needs_review")
            self.assertEqual(live_topic.knowledge_node_review_reason, "knowledge generation failed")
            self.assertEqual(db.query(NoteGroupGenerationDraft).filter_by(job_id=job_id).count(), 0)
            self.assertEqual(db.query(DraftKnowledgeNode).count(), 0)
        finally:
            db.close()

    def test_cancel_after_topic_knowledge_nodes_does_not_mark_note_group_failed(self):
        db = self.SessionLocal()
        try:
            job = self._create_auto_generation_job(db, "cancel-after-knowledge")
            job_id = job.id
            db.close()

            def cancel_before_promotion(*_args, **_kwargs):
                cancel_db = self.SessionLocal()
                try:
                    stored_job = cancel_db.get(Job, job_id)
                    stored_job.status = "cancelled"
                    cancel_db.commit()
                finally:
                    cancel_db.close()
                return {
                    "knowledge_nodes": [
                        {
                            "temp_id": "node-definition-1",
                            "topic_id": "topic-draft-1",
                            "title": "Definition",
                            "summary": "Definition summary",
                            "knowledge_type": "definition",
                            "importance": "core",
                        }
                    ],
                    "relations": [],
                    "study_card_knowledge_node_links": [],
                }

            self._run_with_mocks(
                job_id,
                topics={
                    "topics": [
                        {
                            "temp_id": "topic-draft-1",
                            "title": "Draft Topic",
                            "summary": "",
                        }
                    ],
                    "study_card_topic_links": [],
                },
                knowledge_nodes=cancel_before_promotion,
            )

            db = self.SessionLocal()
            stored_job = db.get(Job, job_id)
            note_group = stored_job.note_group

            self.assertEqual(stored_job.status, "cancelled")
            self.assertEqual(note_group.generation_status, "cancelled")
        finally:
            db.close()

    def test_cancel_during_promotion_rolls_back_live_rows(self):
        from app.generation_promotion import promote_note_group_generation_draft as real_promote

        db = self.SessionLocal()
        try:
            job = self._create_auto_generation_job(db, "cancel-during-promotion")
            job_id = job.id
            note_group_id = job.note_group_id
            db.close()

            def cancel_during_promotion(db_arg, job_arg):
                cancel_db = self.SessionLocal()
                try:
                    stored_job = cancel_db.get(Job, job_id)
                    stored_job.status = "cancelled"
                    cancel_db.commit()
                finally:
                    cancel_db.close()
                return real_promote(db_arg, job_arg)

            self._run_with_extra_patches(
                job_id,
                [patch("app.jobs.promote_note_group_generation_draft", side_effect=cancel_during_promotion)],
            )

            db = self.SessionLocal()
            stored_job = db.get(Job, job_id)
            note_group = stored_job.note_group

            self.assertEqual(stored_job.status, "cancelled")
            self.assertEqual(note_group.generation_status, "cancelled")
            self.assertEqual(db.query(StudyCard).filter_by(note_group_id=note_group_id).count(), 0)
            self.assertEqual(db.query(QuestionCard).filter_by(note_group_id=note_group_id).count(), 0)
            self.assertEqual(db.query(StudyCardEmbedding).filter_by(note_group_id=note_group_id).count(), 0)
            self.assertEqual(db.query(NoteGroupGenerationDraft).filter_by(job_id=job_id).count(), 1)
        finally:
            db.close()

    def test_cancel_at_promotion_stage_boundary_is_not_overwritten(self):
        import app.jobs as jobs

        db = self.SessionLocal()
        try:
            job = self._create_auto_generation_job(db, "cancel-promotion-boundary")
            job_id = job.id
            db.close()

            original_start_stage = jobs.start_job_stage

            def cancel_before_promotion_start(db_session, job_obj, stage):
                if stage == "promoting":
                    cancel_db = self.SessionLocal()
                    try:
                        stored_job = cancel_db.get(Job, job_id)
                        stored_job.status = "cancelled"
                        cancel_db.commit()
                    finally:
                        cancel_db.close()
                return original_start_stage(db_session, job_obj, stage)

            self._run_with_extra_patches(
                job_id,
                [patch.object(jobs, "start_job_stage", side_effect=cancel_before_promotion_start)],
                topics={
                    "topics": [
                        {
                            "temp_id": "topic-draft-1",
                            "title": "Draft Topic",
                            "summary": "Draft topic summary",
                        }
                    ],
                    "study_card_topic_links": [],
                },
            )

            db = self.SessionLocal()
            stored_job = db.get(Job, job_id)
            note_group = stored_job.note_group

            self.assertEqual(stored_job.status, "cancelled")
            self.assertEqual(note_group.generation_status, "cancelled")
        finally:
            db.close()
