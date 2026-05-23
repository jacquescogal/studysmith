import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base
from app.models import Module, NoteGroup, StudyCard, Subject


def vec(*values):
    return list(values) + [0.0] * (1536 - len(values))


class VectorStoreTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        Base.metadata.create_all(bind=self.engine)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)

    def _seed_cards(self, db):
        subject = Subject(id="subject-1", title="Algorithms")
        module = Module(id="module-1", subject_id="subject-1", title="Module 1")
        other_module = Module(id="module-2", subject_id="subject-1", title="Module 2")
        note_group = NoteGroup(
            id="note-group-1",
            module_id="module-1",
            title="Sorting",
            raw_text="Sorting notes",
        )
        other_note_group = NoteGroup(
            id="note-group-2",
            module_id="module-1",
            title="Graphs",
            raw_text="Graph notes",
        )
        card_a = StudyCard(id="card-a", note_group_id="note-group-1", title="A", content="alpha")
        card_b = StudyCard(id="card-b", note_group_id="note-group-1", title="B", content="beta")
        card_c = StudyCard(id="card-c", note_group_id="note-group-2", title="C", content="gamma")
        card_other_module = StudyCard(
            id="card-other-module",
            note_group_id="note-group-2",
            title="Other",
            content="other",
        )
        db.add_all(
            [
                subject,
                module,
                other_module,
                note_group,
                other_note_group,
                card_a,
                card_b,
                card_c,
                card_other_module,
            ]
        )
        db.commit()
        return card_a, card_b, card_c, card_other_module

    def test_upsert_stores_and_updates_embedding_row(self):
        from app.models import StudyCardEmbedding
        from app.vector_store import upsert_study_card_embedding

        db = self.SessionLocal()
        try:
            card_a, _, _, _ = self._seed_cards(db)

            upsert_study_card_embedding(db, card_a, "module-1", vec(1.0, 0.0, 0.0))
            db.commit()

            row = db.get(StudyCardEmbedding, "card-a")
            self.assertEqual(row.study_card_id, "card-a")
            self.assertEqual(row.module_id, "module-1")
            self.assertEqual(row.note_group_id, "note-group-1")
            self.assertEqual(row.content, "alpha")

            card_a.content = "updated alpha"
            upsert_study_card_embedding(db, card_a, "module-1", vec(0.0, 1.0, 0.0))
            db.commit()

            rows = db.query(StudyCardEmbedding).all()
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0].content, "updated alpha")
            self.assertEqual(
                [round(float(value), 2) for value in rows[0].embedding[:3]],
                [0.0, 1.0, 0.0],
            )
        finally:
            db.close()

    def test_query_returns_nearest_rows_scoped_to_module(self):
        from app.vector_store import query_study_card_embeddings, upsert_study_card_embeddings

        db = self.SessionLocal()
        try:
            card_a, card_b, card_c, card_other_module = self._seed_cards(db)
            upsert_study_card_embeddings(
                db,
                [
                    (card_a, "module-1", vec(1.0, 0.0, 0.0)),
                    (card_b, "module-1", vec(0.0, 1.0, 0.0)),
                    (card_c, "module-1", vec(0.8, 0.1, 0.0)),
                    (card_other_module, "module-2", vec(1.0, 0.0, 0.0)),
                ],
            )
            db.commit()

            results = query_study_card_embeddings(db, vec(1.0, 0.0, 0.0), "module-1", limit=2)

            self.assertEqual([result.study_card_id for result in results], ["card-a", "card-c"])
            self.assertEqual([result.content for result in results], ["alpha", "gamma"])
        finally:
            db.close()

    def test_query_can_scope_to_note_group(self):
        from app.vector_store import query_study_card_embeddings, upsert_study_card_embeddings

        db = self.SessionLocal()
        try:
            card_a, _, card_c, _ = self._seed_cards(db)
            upsert_study_card_embeddings(
                db,
                [
                    (card_a, "module-1", vec(1.0, 0.0, 0.0)),
                    (card_c, "module-1", vec(1.0, 0.0, 0.0)),
                ],
            )
            db.commit()

            results = query_study_card_embeddings(
                db,
                vec(1.0, 0.0, 0.0),
                "module-1",
                note_group_id="note-group-2",
                limit=10,
            )

            self.assertEqual([result.study_card_id for result in results], ["card-c"])
        finally:
            db.close()

    def test_delete_removes_embedding_rows(self):
        from app.models import StudyCardEmbedding
        from app.vector_store import delete_study_card_embeddings, upsert_study_card_embeddings

        db = self.SessionLocal()
        try:
            card_a, card_b, _, _ = self._seed_cards(db)
            upsert_study_card_embeddings(
                db,
                [
                    (card_a, "module-1", vec(1.0, 0.0, 0.0)),
                    (card_b, "module-1", vec(0.0, 1.0, 0.0)),
                ],
            )
            db.commit()

            delete_study_card_embeddings(db, ["card-a"])
            db.commit()

            self.assertEqual(
                [row.study_card_id for row in db.query(StudyCardEmbedding).all()],
                ["card-b"],
            )
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
