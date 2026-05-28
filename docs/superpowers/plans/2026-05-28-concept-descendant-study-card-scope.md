# Concept Descendant Study Card Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make parent Concepts aggregate descendant Study Cards for card/review scopes while showing direct, descendant, and total Study Card counts in Mind Maps.

**Architecture:** Add backend Concept Tree scope helpers that return direct, descendant, and total Study Card IDs with deduplication. Thread `include_descendants` through Concept card/question/review endpoints and frontend API calls. Keep Concept Mind Maps rendering direct Study Card nodes only while exposing descendant and total counts on Concept nodes.

**Tech Stack:** FastAPI, SQLAlchemy, pytest/unittest, React, Vite, Vitest, React static markup tests.

---

## File Structure

- Modify `backend/app/schemas.py`
  - Add aggregate Study Card count fields to `MindMapNodeOut`.
- Modify `backend/app/main.py`
  - Add Concept descendant scope helpers near `_topic_allowed_study_ids`.
  - Add `include_descendants` query params to Concept Study Card, Question Card, timeline, and review endpoints.
  - Keep legacy topic routes delegating with default descendant inclusion.
- Modify `backend/app/mind_map.py`
  - Reuse aggregate count logic or local equivalent for Mind Map node counts.
  - Keep Concept Mind Map direct Study Card node rendering.
  - Add descendant/total counts to current, child, module, and note-group Concept nodes.
- Modify `backend/tests/test_topic_scope_routes.py`
  - Add endpoint-level tests for include-descendant Concept scope and deduplication.
- Modify `backend/tests/test_mind_map.py`
  - Add Mind Map tests for aggregate counts and direct-only Concept Mind Map Study Card rendering.
- Modify `frontend/src/api.js`
  - Add options objects to Concept card/review helpers and serialize `include_descendants`.
- Modify `frontend/src/hooks/useStudyScopeData.js`
  - Accept `includeDescendantStudyCards` and pass it to Concept card/question loads.
- Modify `frontend/src/features/review/useReviewWorkflowActions.js`
  - Accept `includeDescendantStudyCards` and pass it when starting Concept review.
- Modify `frontend/src/features/app-shell/StudyAppShell.jsx`
  - Own Concept page include-descendants state and pass it into hooks/actions/content.
- Modify `frontend/src/features/app-shell/StudyAppView.jsx`, `frontend/src/features/app-shell/StudyAppMainContent.jsx`, and `frontend/src/features/study-scope/StudyScopeContent.jsx`
  - Thread and render the Concept scope toggle.
- Modify `frontend/src/features/mind-map/mindMapLayout.js`
  - Add direct/descendant/total badge rendering.
- Modify frontend tests:
  - `frontend/src/api.test.js`
  - `frontend/src/features/mind-map/mindMapLayout.test.js`
  - `frontend/src/features/study-scope/StudyScopeContent.test.jsx`
  - Create `frontend/src/features/review/useReviewWorkflowActions.test.js`
  - Create `frontend/src/hooks/useStudyScopeData.test.js`

## Task 1: Backend Concept Study Card Scope Helper

**Files:**
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_topic_scope_routes.py`

- [ ] **Step 1: Write failing tests for descendant inclusion, direct-only, and deduplication**

Add this test method to `TopicScopeRoutesTests` in `backend/tests/test_topic_scope_routes.py`:

```python
    def test_concept_study_cards_include_descendants_by_default_and_deduplicate(self):
        import app.db as db_module

        with patch.object(db_module, "engine", self.engine):
            from app.main import list_concept_study_cards

        db = self.seed_topic_scope()
        try:
            module = db.get(Module, "module-1")
            parent = db.get(TopicChip, "topic-1")
            child = TopicChip(id="topic-child", module_id=module.id, label="Child", parent_topic_id=parent.id)
            grandchild = TopicChip(
                id="topic-grandchild",
                module_id=module.id,
                label="Grandchild",
                parent_topic_id=child.id,
            )
            group = db.get(NoteGroup, "group-b")
            child_card = StudyCard(id="study-child", note_group_id=group.id, title="Child", content="Child")
            shared_card = StudyCard(id="study-shared", note_group_id=group.id, title="Shared", content="Shared")
            grandchild_card = StudyCard(
                id="study-grandchild",
                note_group_id=group.id,
                title="Grandchild",
                content="Grandchild",
            )
            child_card.topic_chips.append(child)
            shared_card.topic_chips.append(parent)
            shared_card.topic_chips.append(child)
            grandchild_card.topic_chips.append(grandchild)
            db.add_all([child, grandchild, child_card, shared_card, grandchild_card])
            db.commit()

            user = db.get(User, "user-1")
            default_response = list_concept_study_cards("topic-1", db=db, current_user=user)
            direct_response = list_concept_study_cards(
                "topic-1",
                include_descendants=False,
                db=db,
                current_user=user,
            )
        finally:
            db.close()

        self.assertEqual(
            {card.id for card in default_response["study_cards"]},
            {"study-a", "study-b", "study-child", "study-shared", "study-grandchild"},
        )
        self.assertEqual(
            {card.id for card in direct_response["study_cards"]},
            {"study-a", "study-b", "study-shared"},
        )
        self.assertEqual(
            len([card for card in default_response["study_cards"] if card.id == "study-shared"]),
            1,
        )
```

- [ ] **Step 2: Run the focused backend test and verify it fails**

Run:

```bash
cd backend
.venv/bin/python -m pytest tests/test_topic_scope_routes.py::TopicScopeRoutesTests::test_concept_study_cards_include_descendants_by_default_and_deduplicate -q
```

Expected: FAIL because `list_concept_study_cards()` does not accept `include_descendants`.

- [ ] **Step 3: Add backend helpers and query parameter**

In `backend/app/main.py`, replace `_topic_allowed_study_ids` with these helpers and implementation:

```python
def _descendant_topic_ids(db: Session, topic: TopicChip) -> list[str]:
    rows = (
        db.query(TopicChip.id, TopicChip.parent_topic_id, TopicChip.sort_order, TopicChip.label)
        .filter(TopicChip.module_id == topic.module_id)
        .order_by(TopicChip.sort_order.asc(), TopicChip.label.asc(), TopicChip.id.asc())
        .all()
    )
    children_by_parent: dict[str, list[tuple[str, int | None, str]]] = {}
    for topic_id, parent_topic_id, sort_order, label in rows:
        if parent_topic_id:
            children_by_parent.setdefault(parent_topic_id, []).append((topic_id, sort_order, label))

    descendants: list[str] = []
    visited = {topic.id}
    stack = [child_id for child_id, _sort_order, _label in reversed(children_by_parent.get(topic.id, []))]
    while stack:
        current_id = stack.pop()
        if current_id in visited:
            continue
        visited.add(current_id)
        descendants.append(current_id)
        child_ids = [child_id for child_id, _sort_order, _label in children_by_parent.get(current_id, [])]
        stack.extend(reversed(child_ids))
    return descendants


def _topic_scope_ids(db: Session, topic: TopicChip, include_descendants: bool = True) -> list[str]:
    if not include_descendants:
        return [topic.id]
    return [topic.id, *_descendant_topic_ids(db, topic)]


def _topic_allowed_study_ids(
    db: Session,
    topic: TopicChip,
    include_descendants: bool = True,
) -> list[str]:
    topic_ids = _topic_scope_ids(db, topic, include_descendants=include_descendants)
    rows = (
        db.query(StudyCard.id, StudyCard.created_at)
        .join(NoteGroup, StudyCard.note_group_id == NoteGroup.id)
        .join(
            study_card_topic_chips,
            StudyCard.id == study_card_topic_chips.c.study_card_id,
        )
        .filter(
            NoteGroup.module_id == topic.module_id,
            study_card_topic_chips.c.chip_id.in_(topic_ids),
        )
        .order_by(StudyCard.created_at.asc(), StudyCard.id.asc())
        .all()
    )
    seen: set[str] = set()
    study_ids: list[str] = []
    for study_id, _created_at in rows:
        if study_id in seen:
            continue
        seen.add(study_id)
        study_ids.append(study_id)
    return study_ids
```

Update `list_concept_study_cards` signature and query:

```python
def list_concept_study_cards(
    concept_id: str,
    include_descendants: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_user),
):
    topic = require_topic_read(db, current_user, concept_id)
    allowed_study_ids = _topic_allowed_study_ids(
        db,
        topic,
        include_descendants=include_descendants,
    )
    if not allowed_study_ids:
        return {"study_cards": []}
    cards_by_id = {
        card.id: card
        for card in db.query(StudyCard)
        .filter(StudyCard.id.in_(allowed_study_ids))
        .all()
    }
    return {"study_cards": [cards_by_id[study_id] for study_id in allowed_study_ids if study_id in cards_by_id]}
```

Update `list_topic_study_cards` to keep default behavior:

```python
def list_topic_study_cards(
    topic_id: str,
    include_descendants: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_user),
):
    return list_concept_study_cards(
        topic_id,
        include_descendants=include_descendants,
        db=db,
        current_user=current_user,
    )
```

- [ ] **Step 4: Run the focused backend test and verify it passes**

Run:

```bash
cd backend
.venv/bin/python -m pytest tests/test_topic_scope_routes.py::TopicScopeRoutesTests::test_concept_study_cards_include_descendants_by_default_and_deduplicate -q
```

Expected: PASS.

- [ ] **Step 5: Run topic scope backend tests**

Run:

```bash
cd backend
.venv/bin/python -m pytest tests/test_topic_scope_routes.py -q
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/main.py backend/tests/test_topic_scope_routes.py
git commit -m "feat: aggregate concept study cards from descendants"
```

## Task 2: Backend Concept Question and Review Scope

**Files:**
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_topic_scope_routes.py`

- [ ] **Step 1: Write failing tests for question and review scoping**

Add this test method to `TopicScopeRoutesTests`:

```python
    def test_concept_question_and_review_cards_follow_descendant_scope(self):
        import app.db as db_module

        with patch.object(db_module, "engine", self.engine):
            from app.main import (
                get_concept_question_timeline,
                list_concept_question_cards,
                list_concept_review_question_cards,
            )

        db = self.seed_topic_scope()
        try:
            module = db.get(Module, "module-1")
            parent = db.get(TopicChip, "topic-1")
            child = TopicChip(id="topic-child", module_id=module.id, label="Child", parent_topic_id=parent.id)
            group = db.get(NoteGroup, "group-b")
            child_card = StudyCard(id="study-child", note_group_id=group.id, title="Child", content="Child")
            child_card.topic_chips.append(child)
            child_question = QuestionCard(
                id="question-child",
                note_group_id=group.id,
                type="multiple_choice",
                prompt="Child prompt",
                options_json='["A"]',
                correct_option_indices_json="[0]",
                study_card_refs_json='["study-child"]',
                stale=False,
                due_at=datetime.utcnow() - timedelta(hours=1),
            )
            db.add_all([child, child_card, child_question])
            db.commit()

            user = db.get(User, "user-1")
            default_questions = list_concept_question_cards("topic-1", db=db, current_user=user)
            direct_questions = list_concept_question_cards(
                "topic-1",
                include_descendants=False,
                db=db,
                current_user=user,
            )
            default_timeline = get_concept_question_timeline("topic-1", db=db, current_user=user)
            direct_timeline = get_concept_question_timeline(
                "topic-1",
                include_descendants=False,
                db=db,
                current_user=user,
            )
            default_review = list_concept_review_question_cards(
                "topic-1",
                mode="due",
                limit=10,
                db=db,
                current_user=user,
            )
            direct_review = list_concept_review_question_cards(
                "topic-1",
                mode="due",
                limit=10,
                include_descendants=False,
                db=db,
                current_user=user,
            )
        finally:
            db.close()

        self.assertIn("question-child", [card["id"] for card in default_questions["question_cards"]])
        self.assertNotIn("question-child", [card["id"] for card in direct_questions["question_cards"]])
        self.assertEqual(default_timeline["question_count"], 3)
        self.assertEqual(direct_timeline["question_count"], 2)
        self.assertIn("question-child", [card["id"] for card in default_review["question_cards"]])
        self.assertNotIn("question-child", [card["id"] for card in direct_review["question_cards"]])
```

- [ ] **Step 2: Run the focused backend test and verify it fails**

Run:

```bash
cd backend
.venv/bin/python -m pytest tests/test_topic_scope_routes.py::TopicScopeRoutesTests::test_concept_question_and_review_cards_follow_descendant_scope -q
```

Expected: FAIL because Concept question/review endpoints do not accept or use `include_descendants`.

- [ ] **Step 3: Update question scope helper and endpoints**

In `backend/app/main.py`, update `_topic_question_cards`:

```python
def _topic_question_cards(
    db: Session,
    topic: TopicChip,
    include_descendants: bool = True,
) -> list[QuestionCard]:
    allowed_study_ids = set(
        _topic_allowed_study_ids(db, topic, include_descendants=include_descendants)
    )
    if not allowed_study_ids:
        return []
    cards = (
        db.query(QuestionCard)
        .join(NoteGroup, QuestionCard.note_group_id == NoteGroup.id)
        .filter(NoteGroup.module_id == topic.module_id)
        .order_by(QuestionCard.due_at.asc())
        .all()
    )
    return [
        card
        for card in cards
        if any(ref in allowed_study_ids for ref in _question_card_refs(card))
    ]
```

Update Concept question endpoints to accept and pass `include_descendants`:

```python
def list_concept_question_cards(
    concept_id: str,
    include_descendants: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_user),
):
    topic = require_topic_read(db, current_user, concept_id)
    cards = _topic_question_cards(db, topic, include_descendants=include_descendants)
    state_by_card_id = _question_card_learning_state_map(db, cards, current_user)
    return {"question_cards": _serialize_question_cards_for_user(cards, state_by_card_id)}
```

Update `get_concept_question_timeline`:

```python
def get_concept_question_timeline(
    concept_id: str,
    include_descendants: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_user),
):
    topic = require_topic_read(db, current_user, concept_id)
    cards = _topic_question_cards(db, topic, include_descendants=include_descendants)
    state_by_card_id = _question_card_learning_state_map(db, cards, current_user)
    timeline = _build_question_timeline(cards, datetime.now(timezone.utc), state_by_card_id)
    return {
        "timeline": timeline,
        "question_count": len(cards),
        "stale_count": sum(1 for card in cards if card.stale),
    }
```

Update `list_concept_review_question_cards`:

```python
def list_concept_review_question_cards(
    concept_id: str,
    mode: str = Query(default="due"),
    limit: int = Query(default=10, ge=1, le=200),
    include_descendants: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    topic = require_topic_read(db, current_user, concept_id)
    cards = _topic_question_cards(db, topic, include_descendants=include_descendants)
    state_by_card_id = _question_card_learning_state_map(db, cards, current_user)
    now = datetime.now(timezone.utc)
    review_cards = _review_cards_for_mode(cards, mode, limit, state_by_card_id, now)
    return {"question_cards": _serialize_question_cards_for_user(review_cards, state_by_card_id)}
```

Update legacy topic route signatures and delegate with the same flag:

```python
def list_topic_question_cards(
    topic_id: str,
    include_descendants: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_user),
):
    return list_concept_question_cards(
        topic_id,
        include_descendants=include_descendants,
        db=db,
        current_user=current_user,
    )
```

Apply the same legacy delegation shape to `get_topic_question_timeline` and `list_topic_review_question_cards`.

- [ ] **Step 4: Run backend tests**

Run:

```bash
cd backend
.venv/bin/python -m pytest tests/test_topic_scope_routes.py -q
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/main.py backend/tests/test_topic_scope_routes.py
git commit -m "feat: include descendant concept cards in review scope"
```

## Task 3: Backend Mind Map Aggregate Counts

**Files:**
- Modify: `backend/app/schemas.py`
- Modify: `backend/app/mind_map.py`
- Test: `backend/tests/test_mind_map.py`

- [ ] **Step 1: Write failing Mind Map tests**

Add this test method after `test_build_topic_mind_map_response_returns_parent_knowledge_children_and_study_cards` in `backend/tests/test_mind_map.py`:

```python
    def test_topic_mind_map_counts_descendants_without_rendering_descendant_cards(self):
        from app.mind_map import build_topic_mind_map_response

        db = self.SessionLocal()
        try:
            owner = self._owner()
            subject = Subject(id="subject-1", title="Subject", owner_user_id="owner-1")
            module = Module(id="module-1", subject_id="subject-1", title="Module")
            note_group = NoteGroup(id="note-group-1", module_id="module-1", title="Auth", raw_text="target")
            parent = TopicChip(id="topic-parent", module_id="module-1", label="Authentication")
            child = TopicChip(id="topic-child", module_id="module-1", label="Child", parent_topic_id="topic-parent")
            direct_card = StudyCard(id="study-direct", note_group_id="note-group-1", title="Direct", content="Direct")
            child_card = StudyCard(id="study-child", note_group_id="note-group-1", title="Child", content="Child")
            shared_card = StudyCard(id="study-shared", note_group_id="note-group-1", title="Shared", content="Shared")
            db.add_all([owner, subject, module, note_group, parent, child, direct_card, child_card, shared_card])
            db.commit()
            db.execute(study_card_topic_chips.insert().values(study_card_id="study-direct", chip_id="topic-parent"))
            db.execute(study_card_topic_chips.insert().values(study_card_id="study-child", chip_id="topic-child"))
            db.execute(study_card_topic_chips.insert().values(study_card_id="study-shared", chip_id="topic-parent"))
            db.execute(study_card_topic_chips.insert().values(study_card_id="study-shared", chip_id="topic-child"))
            db.commit()

            response = build_topic_mind_map_response(db, "topic-parent")
        finally:
            db.close()

        nodes_by_id = {node.id: node for node in response.nodes}
        current = nodes_by_id["topic-map-current-group:topic-parent"]
        child_node = nodes_by_id["topic-child"]
        study_node_ids = [node.id for node in response.nodes if node.node_type == "study_card"]

        self.assertEqual(current.direct_study_card_count, 2)
        self.assertEqual(current.descendant_study_card_count, 2)
        self.assertEqual(current.total_study_card_count, 3)
        self.assertEqual(current.study_card_count, 3)
        self.assertEqual(child_node.direct_study_card_count, 2)
        self.assertEqual(child_node.descendant_study_card_count, 0)
        self.assertEqual(child_node.total_study_card_count, 2)
        self.assertIn("topic-map-study-card:study-direct", study_node_ids)
        self.assertIn("topic-map-study-card:study-shared", study_node_ids)
        self.assertNotIn("topic-map-study-card:study-child", study_node_ids)
```

Add or update a module/note-group Mind Map test so it asserts a Concept node has all count fields:

```python
        self.assertEqual(nodes_by_id["topic-auth"].direct_study_card_count, 0)
        self.assertEqual(nodes_by_id["topic-auth"].descendant_study_card_count, 1)
        self.assertEqual(nodes_by_id["topic-auth"].total_study_card_count, 1)
        self.assertEqual(nodes_by_id["topic-auth"].study_card_count, 1)
```

- [ ] **Step 2: Run the focused Mind Map test and verify it fails**

Run:

```bash
cd backend
.venv/bin/python -m pytest tests/test_mind_map.py::MindMapServiceTests::test_topic_mind_map_counts_descendants_without_rendering_descendant_cards -q
```

Expected: FAIL because `MindMapNodeOut` lacks the new count fields and Concept Mind Map counts are not aggregate.

- [ ] **Step 3: Add schema fields**

In `backend/app/schemas.py`, add these fields to `MindMapNodeOut` near `study_card_count`:

```python
    direct_study_card_count: int = 0
    descendant_study_card_count: int = 0
    total_study_card_count: int = 0
```

- [ ] **Step 4: Add aggregate count helpers in Mind Map code**

In `backend/app/mind_map.py`, add helpers near `build_topic_mind_map_response`:

```python
def _descendant_topic_ids_for_module(topics: list[TopicChip], topic_id: str) -> list[str]:
    children_by_parent: dict[str, list[TopicChip]] = {}
    for topic in topics:
        if topic.parent_topic_id:
            children_by_parent.setdefault(topic.parent_topic_id, []).append(topic)
    descendants: list[str] = []
    visited = {topic_id}
    stack = list(reversed(children_by_parent.get(topic_id, [])))
    while stack:
        topic = stack.pop()
        if topic.id in visited:
            continue
        visited.add(topic.id)
        descendants.append(topic.id)
        stack.extend(reversed(children_by_parent.get(topic.id, [])))
    return descendants


def _aggregate_topic_study_card_counts(
    topics: list[TopicChip],
    direct_ids_by_topic_id: dict[str, set[str]],
) -> dict[str, dict[str, int]]:
    counts: dict[str, dict[str, int]] = {}
    for topic in topics:
        direct_ids = set(direct_ids_by_topic_id.get(topic.id, set()))
        descendant_ids: set[str] = set()
        for descendant_id in _descendant_topic_ids_for_module(topics, topic.id):
            descendant_ids.update(direct_ids_by_topic_id.get(descendant_id, set()))
        total_ids = direct_ids | descendant_ids
        counts[topic.id] = {
            "direct_study_card_count": len(direct_ids),
            "descendant_study_card_count": len(descendant_ids),
            "total_study_card_count": len(total_ids),
            "study_card_count": len(total_ids),
        }
    return counts
```

- [ ] **Step 5: Use counts in `build_topic_mind_map_response`**

In `build_topic_mind_map_response`, compute direct IDs for current and child Concepts from `study_card_topic_chips`, compute aggregate counts, and merge counts into the dictionaries returned by the local `topic_node` helper plus the current group node dictionary. Keep `study_cards` query filtered to direct `topic.id` only.

The current group should include:

```python
            **topic_counts.get(topic.id, {}),
            "study_card_ids": sorted(direct_study_card_ids_by_topic_id.get(topic.id, set())),
```

Child and parent Concept nodes should include:

```python
            **topic_counts.get(node_topic.id, {}),
            "study_card_ids": sorted(direct_study_card_ids_by_topic_id.get(node_topic.id, set())),
```

- [ ] **Step 6: Use counts in module/note-group Mind Map responses**

In `_build_mind_map_response`, after `study_card_ids_by_topic_id` is populated, compute:

```python
topic_count_values = _aggregate_topic_study_card_counts(topics, study_card_ids_by_topic_id)
```

Then merge `topic_count_values.get(topic.id, {})` into each `topic_nodes` dict and remove the old direct-only `study_card_count` value.

- [ ] **Step 7: Run Mind Map tests**

Run:

```bash
cd backend
.venv/bin/python -m pytest tests/test_mind_map.py -q
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/app/schemas.py backend/app/mind_map.py backend/tests/test_mind_map.py
git commit -m "feat: expose aggregate concept study card counts"
```

## Task 4: Frontend API and Data Loading Toggles

**Files:**
- Modify: `frontend/src/api.js`
- Modify: `frontend/src/hooks/useStudyScopeData.js`
- Modify: `frontend/src/features/review/useReviewWorkflowActions.js`
- Modify: `frontend/src/features/app-shell/StudyAppShell.jsx`
- Test: `frontend/src/api.test.js`
- Test: create `frontend/src/hooks/useStudyScopeData.test.js`
- Test: create `frontend/src/features/review/useReviewWorkflowActions.test.js`

- [ ] **Step 1: Add failing API helper tests**

In `frontend/src/api.test.js`, add tests asserting:

```js
const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ study_cards: [] }));

await listConceptStudyCards("concept-1", { includeDescendants: false });
await listConceptQuestionCards("concept-1", { includeDescendants: false });
await getConceptQuestionTimeline("concept-1", { includeDescendants: false });
await listConceptReviewQuestionCards("concept-1", "due", 10, { includeDescendants: false });

expect(fetchMock).toHaveBeenNthCalledWith(
  1,
  "/concepts/concept-1/study-cards?include_descendants=false",
  expect.any(Object)
);
expect(fetchMock).toHaveBeenNthCalledWith(
  2,
  "/concepts/concept-1/question-cards?include_descendants=false",
  expect.any(Object)
);
expect(fetchMock).toHaveBeenNthCalledWith(
  3,
  "/concepts/concept-1/question-cards/timeline?include_descendants=false",
  expect.any(Object)
);
expect(fetchMock).toHaveBeenNthCalledWith(
  4,
  "/concepts/concept-1/question-cards/review?mode=due&limit=10&include_descendants=false",
  expect.any(Object)
);
```

- [ ] **Step 2: Update API helpers**

In `frontend/src/api.js`, add a query helper near Concept helpers:

```js
function includeDescendantsParam(options = {}) {
  const params = new URLSearchParams();
  if (options.includeDescendants === false) {
    params.set("include_descendants", "false");
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
```

Update Concept APIs:

```js
export function listConceptStudyCards(conceptId, options = {}) {
  return request(`/concepts/${conceptId}/study-cards${includeDescendantsParam(options)}`);
}

export function listConceptQuestionCards(conceptId, options = {}) {
  return request(`/concepts/${conceptId}/question-cards${includeDescendantsParam(options)}`);
}

export function getConceptQuestionTimeline(conceptId, options = {}) {
  return request(`/concepts/${conceptId}/question-cards/timeline${includeDescendantsParam(options)}`);
}
```

Update review helper:

```js
export function listConceptReviewQuestionCards(conceptId, mode, limit, options = {}) {
  const params = new URLSearchParams({ mode });
  if (limit) {
    params.set("limit", String(limit));
  }
  if (options.includeDescendants === false) {
    params.set("include_descendants", "false");
  }
  return request(`/concepts/${conceptId}/question-cards/review?${params.toString()}`);
}
```

- [ ] **Step 3: Add failing hook test and thread include-descendants state into `useStudyScopeData`**

Create `frontend/src/hooks/useStudyScopeData.test.js`. Mock `../api.js`, render a test component that calls `useStudyScopeData`, and assert that Concept loads call:

```js
expect(listConceptStudyCards).toHaveBeenCalledWith("concept-1", { includeDescendants: false });
expect(listConceptQuestionCards).toHaveBeenCalledWith("concept-1", { includeDescendants: false });
```

Then update the hook.

Add `includeDescendantStudyCards = true` to `useStudyScopeData` arguments. Update Concept requests:

```js
const conceptOptions = { includeDescendants: includeDescendantStudyCards };
const studyRequest = selectedConceptId
  ? listConceptStudyCards(selectedConceptId, conceptOptions)
  : listStudyCards(selectedNoteGroupId);
const questionRequest = selectedConceptId
  ? listConceptQuestionCards(selectedConceptId, conceptOptions)
  : listQuestionCards(selectedNoteGroupId);
```

Add `includeDescendantStudyCards` to the effect dependency list.

- [ ] **Step 4: Thread state from `StudyAppShell`**

In `frontend/src/features/app-shell/StudyAppShell.jsx`, add state:

```js
const [includeDescendantStudyCards, setIncludeDescendantStudyCards] = useState(true);
```

Reset it to `true` when `selectedTopicId` changes:

```js
useEffect(() => {
  setIncludeDescendantStudyCards(true);
}, [selectedTopicId]);
```

Pass `includeDescendantStudyCards` into `useStudyAppEffects`, `useReviewWorkflowActions`, and the view model passed to `StudyAppView`.

- [ ] **Step 5: Add failing review action test and update review actions**

Create `frontend/src/features/review/useReviewWorkflowActions.test.js`. Mock API helpers, run `startReview("due", "topic")` from the hook with `selectedTopicId: "concept-1"` and `includeDescendantStudyCards: false`, and assert:

```js
expect(listConceptReviewQuestionCards).toHaveBeenCalledWith(
  "concept-1",
  "due",
  undefined,
  { includeDescendants: false }
);
```

Then update the action hook.

In `frontend/src/features/review/useReviewWorkflowActions.js`, destructure `includeDescendantStudyCards = true` from `ctx` and pass it in Concept review:

```js
? await listConceptReviewQuestionCards(
    selectedTopicId,
    mode,
    mode === "queue" ? Number(reviewCount) || 10 : undefined,
    { includeDescendants: includeDescendantStudyCards }
  )
```

- [ ] **Step 6: Run focused frontend tests**

Run:

```bash
cd frontend
npm run test -- api useStudyScopeData useReviewWorkflowActions StudyAppMainContent StudyScopeContent
```

Expected: PASS after updating affected tests.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/api.js frontend/src/api.test.js frontend/src/hooks/useStudyScopeData.js frontend/src/hooks/useStudyScopeData.test.js frontend/src/features/review/useReviewWorkflowActions.js frontend/src/features/review/useReviewWorkflowActions.test.js frontend/src/features/app-shell/StudyAppShell.jsx frontend/src/features/app-shell/useStudyAppEffects.js
git commit -m "feat: thread descendant concept scope through frontend data"
```

## Task 5: Frontend Concept Toggles and Mind Map Badges

**Files:**
- Modify: `frontend/src/features/study-scope/StudyScopeContent.jsx`
- Modify: `frontend/src/features/app-shell/StudyAppMainContent.jsx`
- Modify: `frontend/src/features/app-shell/StudyAppView.jsx`
- Modify: `frontend/src/features/mind-map/mindMapLayout.js`
- Test: `frontend/src/features/study-scope/StudyScopeContent.test.jsx`
- Test: `frontend/src/features/mind-map/mindMapLayout.test.js`

- [ ] **Step 1: Write failing toggle render tests**

In `StudyScopeContent.test.jsx`, add a Concept View Cards test:

```jsx
test("Concept View Cards renders include descendant Study Cards toggle checked by default", () => {
  const html = renderToStaticMarkup(
    <ConceptScopeContent
      shouldHoldContent={false}
      isViewCardsPage
      isMindMapPage={false}
      isStudyPage={false}
      isQuestionPage={false}
      selectedConcept={{ id: "concept-1", label: "Energy" }}
      studyCards={[]}
      questionCards={[]}
      classes={classes}
      includeDescendantStudyCards
      setIncludeDescendantStudyCards={vi.fn()}
      startReview={vi.fn()}
    />
  );

  expect(html).toContain("Include descendant Study Cards");
  expect(html).toContain("checked");
});
```

Add a second test with `includeDescendantStudyCards={false}` and expect no `checked`.

- [ ] **Step 2: Write failing Mind Map badge tests**

In `mindMapLayout.test.js`, add:

```js
test("renders direct descendant and total Study Card count badges for Concept nodes", () => {
  const graph = {
    scope: "module",
    module_id: "module-1",
    nodes: [
      {
        id: "concept-parent",
        node_type: "concept",
        title: "Parent",
        direct_study_card_count: 2,
        descendant_study_card_count: 3,
        total_study_card_count: 4,
        study_card_count: 4
      }
    ],
    edges: [],
    study_cards: [],
    note_groups: []
  };

  const { nodes } = buildMindMapElements(graph, { title: "Module Mind Map" });
  const parent = nodes.find((node) => node.id === "concept-parent");
  expect(parent.data.badges).toContain("2 direct cards");
  expect(parent.data.badges).toContain("3 descendant cards");
  expect(parent.data.badges).toContain("4 total cards");
});
```

- [ ] **Step 3: Implement Concept toggle UI**

In `StudyScopeContent.jsx`, add props:

```js
includeDescendantStudyCards = true,
setIncludeDescendantStudyCards
```

Create a local control in the Concept branch:

```jsx
const descendantStudyCardToggle = isConceptScope ? (
  <label className="toggle">
    <input
      type="checkbox"
      checked={includeDescendantStudyCards}
      onChange={(event) => setIncludeDescendantStudyCards?.(event.target.checked)}
    />
    Include descendant Study Cards
  </label>
) : null;
```

Render it in Concept View Cards near the fixed Concept filter context and in the review controls area before the review buttons. Do not render it for Note Group pages.

- [ ] **Step 4: Thread toggle props through app content**

Add props to `StudyAppMainContent.jsx` and `StudyAppView.jsx` model passing:

```js
includeDescendantStudyCards,
setIncludeDescendantStudyCards,
```

Pass them into `ConceptScopeContent`.

- [ ] **Step 5: Update Mind Map badges**

In `mindMapLayout.js`, add:

```js
function studyCardCountBadges(node) {
  const badges = [];
  if (node.direct_study_card_count) {
    badges.push(`${node.direct_study_card_count} direct ${node.direct_study_card_count === 1 ? "card" : "cards"}`);
  }
  if (node.descendant_study_card_count) {
    badges.push(`${node.descendant_study_card_count} descendant ${node.descendant_study_card_count === 1 ? "card" : "cards"}`);
  }
  if (node.total_study_card_count) {
    badges.push(`${node.total_study_card_count} total ${node.total_study_card_count === 1 ? "card" : "cards"}`);
  }
  if (!badges.length && node.study_card_count) {
    badges.push(`${node.study_card_count} ${node.study_card_count === 1 ? "card" : "cards"}`);
  }
  return badges;
}
```

Use it inside `conceptBadges`, `topicBadges`, and `knowledgeNodeBadges` only where Concept nodes should show aggregate counts.
Use `studyCardCountBadges(node)` in `conceptBadges` and `topicBadges`. Keep `knowledgeNodeBadges` on the existing direct `study_card_count` display because Knowledge Nodes are not Concept nodes.

- [ ] **Step 6: Run focused frontend tests**

Run:

```bash
cd frontend
npm run test -- StudyScopeContent.test.jsx mindMapLayout.test.js StudyAppMainContent.test.jsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/study-scope/StudyScopeContent.jsx frontend/src/features/study-scope/StudyScopeContent.test.jsx frontend/src/features/app-shell/StudyAppMainContent.jsx frontend/src/features/app-shell/StudyAppView.jsx frontend/src/features/mind-map/mindMapLayout.js frontend/src/features/mind-map/mindMapLayout.test.js
git commit -m "feat: show descendant concept scope controls and counts"
```

## Task 6: Full Verification

**Files:**
- No planned file edits.

- [ ] **Step 1: Run backend focused suites**

Run:

```bash
cd backend
.venv/bin/python -m pytest tests/test_topic_scope_routes.py tests/test_mind_map.py -q
```

Expected: PASS.

- [ ] **Step 2: Run frontend full suite**

Run:

```bash
cd frontend
npm run test
```

Expected: PASS.

- [ ] **Step 3: Run frontend build**

Run:

```bash
cd frontend
npm run build
```

Expected: PASS. Existing large chunk warnings are acceptable.

- [ ] **Step 4: Run git diff review**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors. Only intentional tracked changes should remain. `.superpowers/` may remain untracked and must not be committed.

- [ ] **Step 5: Fix failures in the responsible task**

When a verification command fails, return to the task that introduced that behavior, patch only that task's listed files, rerun the focused command, and amend that task's commit.
