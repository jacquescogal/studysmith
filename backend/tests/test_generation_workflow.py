import unittest
from unittest.mock import patch

from sqlalchemy import create_engine, delete, event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app.models import (
    JOB_STAGE_QUEUED,
    JOB_STAGE_QUESTION_CARDS,
    JOB_STAGE_STUDY_CARDS,
    JOB_STAGE_TITLE,
    DraftMindMapRelation,
    DraftNoteGroupTopicLink,
    DraftStudyCard,
    DraftStudyCardTopicLink,
    DraftTopic,
    Job,
    JobLog,
    JobStage,
    Module,
    NoteGroup,
    NoteGroupGenerationDraft,
    Subject,
    TopicChip,
    User,
)
from app.schemas import JobLogOut, JobOut
from app.generation_workflow import (
    JOB_STAGE_SEQUENCE,
    append_job_log,
    delete_job_and_draft,
    fail_job_stage,
    initialize_job_workflow,
    serialize_generation_workflow,
    set_stage_progress,
    start_job_stage,
    succeed_job_stage,
)


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
