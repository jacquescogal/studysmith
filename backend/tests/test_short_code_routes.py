import re
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app.models import Module, NoteGroup, Subject


SHORT_CODE_RE = re.compile(r"^[a-zA-Z0-9_-]+$")


class ShortCodeRoutesTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)

    def test_short_codes_are_created_and_exposed_on_list_apis(self):
        from app.main import list_note_groups, list_subject_modules, list_subjects

        db = self.SessionLocal()
        try:
            subject = Subject(id="subject-1", title="Subject")
            module = Module(id="module-1", subject_id=subject.id, title="Module")
            note_group = NoteGroup(
                id="note-group-1",
                module_id=module.id,
                title="Note group",
                raw_text="Raw text",
            )
            db.add_all([subject, module, note_group])
            db.commit()

            subjects = list_subjects(db=db)
            modules = list_subject_modules("subject-1", db=db)
            note_groups = list_note_groups("module-1", chip_ids=None, db=db)

            self.assertEqual(len(subjects[0].short_code), 5)
            self.assertRegex(subjects[0].short_code, SHORT_CODE_RE)
            self.assertEqual(len(modules[0].short_code), 6)
            self.assertRegex(modules[0].short_code, SHORT_CODE_RE)
            self.assertEqual(len(note_groups[0].short_code), 7)
            self.assertRegex(note_groups[0].short_code, SHORT_CODE_RE)
        finally:
            db.close()

    def test_collision_retry_can_lengthen_short_code(self):
        from app.models import SubjectShortCode
        from app.short_codes import ensure_subject_short_code

        db = self.SessionLocal()
        try:
            db.add_all(
                [
                    Subject(id="existing-subject", title="Existing"),
                    SubjectShortCode(subject_id="existing-subject", short_code="AAAAA"),
                    Subject(id="new-subject", title="New"),
                ]
            )
            db.commit()
            subject = db.get(Subject, "new-subject")
            with patch(
                "app.short_codes._random_short_code",
                side_effect=["AAAAA"] * 20 + ["AAAAAB"],
            ):
                code = ensure_subject_short_code(db, subject)
            db.commit()
        finally:
            db.close()

        self.assertEqual(code, "AAAAAB")

    def test_route_resolver_validates_nested_hierarchy(self):
        from app.main import resolve_note_group_app_route
        from app.models import ModuleShortCode, NoteGroupShortCode, SubjectShortCode

        db = self.SessionLocal()
        try:
            subject = Subject(id="subject-1", title="Subject")
            other_subject = Subject(id="subject-2", title="Other Subject")
            module = Module(id="module-1", subject_id=subject.id, title="Module")
            other_module = Module(id="module-2", subject_id=other_subject.id, title="Other Module")
            note_group = NoteGroup(
                id="note-group-1",
                module_id=module.id,
                title="Note group",
                raw_text="Raw text",
            )
            db.add_all(
                [
                    subject,
                    other_subject,
                    module,
                    other_module,
                    note_group,
                    SubjectShortCode(subject_id=subject.id, short_code="Sub_1"),
                    SubjectShortCode(subject_id=other_subject.id, short_code="Sub_2"),
                    ModuleShortCode(module_id=module.id, short_code="Mod_01"),
                    ModuleShortCode(module_id=other_module.id, short_code="Mod_02"),
                    NoteGroupShortCode(note_group_id=note_group.id, short_code="Group_1"),
                ]
            )
            db.commit()

            ok = resolve_note_group_app_route(
                subject_code="Sub_1",
                module_code="Mod_01",
                note_group_code="Group_1",
                db=db,
            )
            with self.assertRaises(HTTPException) as bad:
                resolve_note_group_app_route(
                    subject_code="Sub_2",
                    module_code="Mod_01",
                    note_group_code="Group_1",
                    db=db,
                )
        finally:
            db.close()

        self.assertEqual(
            ok,
            {
                "subject_id": "subject-1",
                "subject_short_code": "Sub_1",
                "module_id": "module-1",
                "module_short_code": "Mod_01",
                "note_group_id": "note-group-1",
                "note_group_short_code": "Group_1",
            },
        )
        self.assertEqual(bad.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
