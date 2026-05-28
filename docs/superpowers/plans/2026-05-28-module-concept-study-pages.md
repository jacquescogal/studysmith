# Module and Concept Study Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Module and Concept Study pages with Note Group grouped Derived Study Cards and a Note Group aware Source Text modal.

**Architecture:** Add a narrow backend source-payload API for the Note Groups represented in a Study scope, then extend the frontend Study scope model to group visible Study Cards by Note Group order. Reuse the existing Source Text modal body as the shared rendering unit, but make its active Note Group selectable when no Study Card is pinned and derived from the pinned card when one is pinned.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic schemas, React, Vite, Vitest, existing app CSS.

---

## File Structure

- Modify `backend/app/schemas.py`: add source-payload response schemas.
- Modify `backend/app/main.py`: add Module and Concept Study source endpoints plus shared serialization helpers.
- Create `backend/tests/test_study_source_routes.py`: verify Module ordering, Concept descendant filtering, dedupe, and source fields.
- Modify `frontend/src/api.js`: add `getModuleStudySources()` and `getConceptStudySources()`.
- Modify `frontend/src/hooks/useStudyScopeData.js`: load Module/Concept scoped Study Cards and source payloads for Study pages.
- Modify `frontend/src/features/app-shell/useStudyAppEffects.js`: derive grouped Study Card data, active source payload, flattened navigation, and source modal callbacks.
- Modify `frontend/src/features/app-shell/StudyAppMainContent.jsx`: pass Module Note Group order and source modal data into `StudyScopeContent`.
- Modify `frontend/src/features/study-scope/StudyScopeContent.jsx`: render grouped Study Cards for Module/Concept/Note Group Study and render the note-group-aware Source Text modal.
- Modify `frontend/src/features/study-scope/StudyScopeContent.test.jsx`: cover grouped cards, dropdown behavior, pinned disabling, and cross-group navigation affordance.
- Modify `frontend/src/styles.css`: add grouped Study Card dividers and blue cross-Note-Group boundary button state.

---

### Task 1: Backend Study Source Payload API

**Files:**
- Modify: `backend/app/schemas.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_study_source_routes.py`

- [ ] **Step 1: Write backend route tests**

Create `backend/tests/test_study_source_routes.py` with tests that build two Note Groups in one Module, three Study Cards, one duplicated Concept link, and source ranges. Define a local `client` fixture that creates an in-memory test database and overrides `get_db`, following the same FastAPI dependency override pattern used in `backend/tests/test_auth_access.py`.

```python
def test_module_study_sources_follow_note_group_order(client):
    response = client.get("/modules/module-1/study-sources")
    assert response.status_code == 200
    payload = response.json()
    assert [group["id"] for group in payload["note_groups"]] == ["note-b", "note-a"]
    assert payload["note_groups"][0]["title"] == "Second"
    assert payload["note_groups"][0]["cleaned_text_markdown"] == "second source"
    assert [card["id"] for card in payload["note_groups"][0]["study_cards"]] == ["card-b"]


def test_concept_study_sources_respect_descendant_toggle_and_dedupe(client):
    included = client.get("/concepts/concept-parent/study-sources").json()
    assert [card["id"] for group in included["note_groups"] for card in group["study_cards"]] == [
        "card-parent",
        "card-child",
    ]

    direct_only = client.get("/concepts/concept-parent/study-sources?include_descendants=false").json()
    assert [card["id"] for group in direct_only["note_groups"] for card in group["study_cards"]] == [
        "card-parent",
    ]
```

- [ ] **Step 2: Run backend route tests to verify failure**

Run:

```bash
cd backend
.venv/bin/python -m pytest tests/test_study_source_routes.py
```

Expected: fails with `404 Not Found` for the new endpoints or import errors for missing schemas.

- [ ] **Step 3: Add backend response schemas**

In `backend/app/schemas.py`, add these classes near the existing Study Card schemas:

```python
class StudySourceNoteGroupStudyCardOut(BaseModel):
    id: str
    note_group_id: str
    title: Optional[str] = None
    content: str
    source_ranges: List["StudyCardSourceRangeOut"] = []

    class Config:
        from_attributes = True


class StudySourceNoteGroupOut(BaseModel):
    id: str
    title: Optional[str] = None
    sort_order: Optional[int] = None
    cleaned_text_markdown: Optional[str] = None
    formatted_sections: List["NoteGroupSectionOut"] = []
    study_cards: List[StudySourceNoteGroupStudyCardOut] = []


class StudySourceResponse(BaseModel):
    note_groups: List[StudySourceNoteGroupOut]
```

Also add `StudySourceResponse` to the import list in `backend/app/main.py`.

- [ ] **Step 4: Implement shared source serialization**

In `backend/app/main.py`, add helpers near `_topic_allowed_study_ids()`:

```python
def _serialize_study_source_note_groups(
    note_groups: list[NoteGroup],
    study_cards_by_note_group_id: dict[str, list[StudyCard]],
) -> dict:
    return {
        "note_groups": [
            {
                "id": group.id,
                "title": group.title,
                "sort_order": group.sort_order,
                "cleaned_text_markdown": group.cleaned_text_markdown,
                "formatted_sections": group.formatted_sections,
                "study_cards": study_cards_by_note_group_id.get(group.id, []),
            }
            for group in note_groups
            if study_cards_by_note_group_id.get(group.id)
        ]
    }
```

- [ ] **Step 5: Implement Module Study sources endpoint**

In `backend/app/main.py`, add:

```python
@app.get("/modules/{module_id}/study-sources", response_model=StudySourceResponse)
def get_module_study_sources(
    module_id: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_user),
):
    require_module_study(db, current_user, module_id)
    note_groups = (
        db.query(NoteGroup)
        .filter(NoteGroup.module_id == module_id)
        .order_by(NoteGroup.sort_order.asc(), NoteGroup.created_at.asc(), NoteGroup.id.asc())
        .all()
    )
    cards = (
        db.query(StudyCard)
        .join(NoteGroup, StudyCard.note_group_id == NoteGroup.id)
        .filter(NoteGroup.module_id == module_id)
        .order_by(NoteGroup.sort_order.asc(), StudyCard.created_at.asc(), StudyCard.id.asc())
        .all()
    )
    cards_by_group: dict[str, list[StudyCard]] = defaultdict(list)
    for card in cards:
        cards_by_group[card.note_group_id].append(card)
    return _serialize_study_source_note_groups(note_groups, cards_by_group)
```

- [ ] **Step 6: Implement Concept Study sources endpoint**

In `backend/app/main.py`, add:

```python
@app.get("/concepts/{concept_id}/study-sources", response_model=StudySourceResponse)
def get_concept_study_sources(
    concept_id: str,
    include_descendants: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_user),
):
    topic = require_topic_read(db, current_user, concept_id)
    allowed_study_ids = _topic_allowed_study_ids(db, topic, include_descendants=include_descendants)
    if not allowed_study_ids:
        return {"note_groups": []}

    cards = (
        db.query(StudyCard)
        .join(NoteGroup, StudyCard.note_group_id == NoteGroup.id)
        .filter(StudyCard.id.in_(allowed_study_ids), NoteGroup.module_id == topic.module_id)
        .order_by(NoteGroup.sort_order.asc(), StudyCard.created_at.asc(), StudyCard.id.asc())
        .all()
    )
    allowed_order = {study_id: index for index, study_id in enumerate(allowed_study_ids)}
    unique_cards = sorted(
        {card.id: card for card in cards}.values(),
        key=lambda card: allowed_order.get(card.id, len(allowed_order)),
    )
    group_ids = {card.note_group_id for card in unique_cards}
    note_groups = (
        db.query(NoteGroup)
        .filter(NoteGroup.id.in_(group_ids), NoteGroup.module_id == topic.module_id)
        .order_by(NoteGroup.sort_order.asc(), NoteGroup.created_at.asc(), NoteGroup.id.asc())
        .all()
    )
    cards_by_group: dict[str, list[StudyCard]] = defaultdict(list)
    for card in unique_cards:
        cards_by_group[card.note_group_id].append(card)
    return _serialize_study_source_note_groups(note_groups, cards_by_group)
```

Add a `/topics/{topic_id}/study-sources` alias that calls `get_concept_study_sources()` if the frontend still uses `topic` route terms.

- [ ] **Step 7: Run backend tests**

Run:

```bash
cd backend
.venv/bin/python -m pytest tests/test_study_source_routes.py
```

Expected: all tests pass.

- [ ] **Step 8: Commit backend API**

```bash
git add backend/app/schemas.py backend/app/main.py backend/tests/test_study_source_routes.py
git commit -m "feat: add scoped study source payloads"
```

---

### Task 2: Frontend API and Data Loading

**Files:**
- Modify: `frontend/src/api.js`
- Modify: `frontend/src/hooks/useStudyScopeData.js`
- Test: `frontend/src/hooks/useStudyScopeData.test.js`

- [ ] **Step 1: Write frontend data loading tests**

Extend `frontend/src/hooks/useStudyScopeData.test.js` to mock and assert Module/Concept source loading:

```jsx
vi.mock("../api.js", () => ({
  getConcept: vi.fn(() => Promise.resolve({ id: "concept-1", label: "Concept" })),
  getModule: vi.fn(),
  getNoteGroup: vi.fn(),
  getModuleStudySources: vi.fn(() => Promise.resolve({ note_groups: [{ id: "note-a", study_cards: [] }] })),
  getConceptStudySources: vi.fn(() => Promise.resolve({ note_groups: [{ id: "note-b", study_cards: [] }] })),
  listAllModules: vi.fn(),
  listConceptQuestionCards: vi.fn(() => Promise.resolve({ question_cards: [] })),
  listConceptStudyCards: vi.fn(() => Promise.resolve({ study_cards: [] })),
  listQuestionCards: vi.fn(() => Promise.resolve({ question_cards: [] })),
  listStudyCards: vi.fn(() => Promise.resolve({ study_cards: [] }))
}));

test("loads module Study source payloads on module Study pages", async () => {
  renderHook(() =>
    useStudyScopeData({
      selectedModuleId: "module-1",
      isStudyPage: true,
      setSelectedSubjectId: vi.fn(),
      setSelectedModuleId: vi.fn(),
      setRouteRestoreError: vi.fn()
    })
  );
  await waitFor(() => expect(getModuleStudySources).toHaveBeenCalledWith("module-1"));
});

test("loads concept Study source payloads with descendant option", async () => {
  renderHook(() =>
    useStudyScopeData({
      selectedConceptId: "concept-1",
      selectedModuleId: "module-1",
      isStudyPage: true,
      includeDescendantStudyCards: false,
      setSelectedSubjectId: vi.fn(),
      setSelectedModuleId: vi.fn(),
      setRouteRestoreError: vi.fn()
    })
  );
  await waitFor(() =>
    expect(getConceptStudySources).toHaveBeenCalledWith("concept-1", { includeDescendants: false })
  );
});
```

- [ ] **Step 2: Run hook tests to verify failure**

```bash
cd frontend
npm run test -- useStudyScopeData.test.js
```

Expected: fails because `getModuleStudySources` and `getConceptStudySources` are missing.

- [ ] **Step 3: Add API methods**

In `frontend/src/api.js`, add:

```js
export function getModuleStudySources(moduleId) {
  return request(`/modules/${moduleId}/study-sources`);
}

export function getConceptStudySources(conceptId, options = {}) {
  const query = includeDescendantsParam(options);
  return request(`/concepts/${conceptId}/study-sources${query ? `?${query}` : ""}`);
}

export function getTopicStudySources(topicId, options = {}) {
  return getConceptStudySources(topicId, options);
}
```

- [ ] **Step 4: Extend study scope hook state**

In `frontend/src/hooks/useStudyScopeData.js`, import the new API functions and add state:

```js
const [studySourceNoteGroups, setStudySourceNoteGroups] = useState([]);
```

Return `studySourceNoteGroups` and `setStudySourceNoteGroups`.

- [ ] **Step 5: Load scoped source payloads**

Extend the hook signature:

```js
export function useStudyScopeData({
  selectedModuleId = "",
  selectedNoteGroupId = "",
  selectedConceptId = "",
  isStudyPage = false,
  includeDescendantStudyCards = true,
  ...
} = {}) {
```

Add reset behavior where existing Study data is cleared:

```js
setStudySourceNoteGroups([]);
```

After the existing Study Card request setup, add:

```js
const sourceRequest = selectedConceptId
  ? getConceptStudySources(selectedConceptId, conceptOptions)
  : selectedNoteGroupId
    ? getNoteGroup(selectedNoteGroupId).then((group) => ({
        note_groups: [{
          id: group.id,
          title: group.title,
          sort_order: group.sort_order,
          cleaned_text_markdown: group.cleaned_text_markdown || "",
          formatted_sections: group.formatted_sections || [],
          study_cards: []
        }]
      }))
    : selectedModuleId && isStudyPage
      ? getModuleStudySources(selectedModuleId)
      : Promise.resolve({ note_groups: [] });

sourceRequest.then((data) => {
  if (!cancelled) {
    setStudySourceNoteGroups(data.note_groups || []);
  }
}).catch((error) => {
  if (!cancelled) {
    setStudySourceNoteGroups([]);
    setStudyCardError(error.message || "Failed to load Study source text");
  }
});
```

Keep the existing `listConceptStudyCards`, `listStudyCards`, and question card requests intact.

- [ ] **Step 6: Pass new parameters from app effects**

In `frontend/src/features/app-shell/useStudyAppEffects.js`, pass `selectedModuleId` and `isStudyPage` into `useStudyScopeData()`, destructure `studySourceNoteGroups`, and return it.

```js
const {
  studyCards,
  ...
  studySourceNoteGroups
} = useStudyScopeData({
  selectedModuleId,
  selectedNoteGroupId,
  selectedConceptId: selectedTopicId,
  isStudyPage,
  includeDescendantStudyCards,
  ...
});
```

- [ ] **Step 7: Run hook tests**

```bash
cd frontend
npm run test -- useStudyScopeData.test.js
```

Expected: all hook tests pass.

- [ ] **Step 8: Commit data loading**

```bash
git add frontend/src/api.js frontend/src/hooks/useStudyScopeData.js frontend/src/hooks/useStudyScopeData.test.js frontend/src/features/app-shell/useStudyAppEffects.js
git commit -m "feat: load scoped study source data"
```

---

### Task 3: Grouped Study Card Model

**Files:**
- Modify: `frontend/src/features/app-shell/useStudyAppEffects.js`
- Modify: `frontend/src/features/app-shell/StudyAppMainContent.jsx`
- Test: `frontend/src/features/study-scope/StudyScopeContent.test.jsx`

- [ ] **Step 1: Write grouped render tests**

Add tests in `StudyScopeContent.test.jsx`:

```jsx
test("renders scoped Study Cards grouped by Note Group order", () => {
  const html = renderToStaticMarkup(
    <NoteGroupScopeContent
      shouldHoldContent={false}
      isInlineStudyPage
      readingAvailable
      studyNoteGroups={[
        {
          id: "note-b",
          title: "Second Note Group",
          studyCards: [{ id: "card-b", title: "Card B", content: "Body B", note_group_id: "note-b" }]
        },
        {
          id: "note-a",
          title: "First Note Group",
          studyCards: [{ id: "card-a", title: "Card A", content: "Body A", note_group_id: "note-a" }]
        }
      ]}
      sourceRangesByCardId={new Map()}
      classes={classes}
    />
  );
  expect(html.indexOf("Second Note Group")).toBeLessThan(html.indexOf("First Note Group"));
  expect(html).toContain("study-note-group-divider");
  expect(html).toContain("Card B");
  expect(html).toContain("Body A");
});
```

- [ ] **Step 2: Run focused test to verify failure**

```bash
cd frontend
npm run test -- StudyScopeContent.test.jsx
```

Expected: fails because `studyNoteGroups` rendering is missing.

- [ ] **Step 3: Derive grouped Study Cards**

In `useStudyAppEffects.js`, add:

```js
const studyNoteGroups = useMemo(() => {
  const sourceGroupsById = new Map((studySourceNoteGroups || []).map((group) => [group.id, group]));
  const orderIndexByNoteGroupId = new Map(
    moduleNoteGroupsForDisplay.map((group, index) => [group.id, index])
  );
  const cardsByGroup = new Map();

  filteredStudyCards.forEach((card) => {
    const groupId = card.note_group_id || selectedNoteGroupId || "";
    if (!groupId) {
      return;
    }
    if (!cardsByGroup.has(groupId)) {
      cardsByGroup.set(groupId, []);
    }
    if (!cardsByGroup.get(groupId).some((item) => item.id === card.id)) {
      cardsByGroup.get(groupId).push(card);
    }
  });

  return Array.from(cardsByGroup.entries())
    .map(([groupId, cards]) => {
      const sourceGroup = sourceGroupsById.get(groupId);
      return {
        id: groupId,
        title: sourceGroup?.title || resolveNoteGroupLabel(groupId) || "Untitled Note Group",
        orderIndex: orderIndexByNoteGroupId.get(groupId) ?? Number.POSITIVE_INFINITY,
        studyCards: cards
      };
    })
    .sort((a, b) => a.orderIndex - b.orderIndex || a.title.localeCompare(b.title));
}, [filteredStudyCards, moduleNoteGroupsForDisplay, resolveNoteGroupLabel, selectedNoteGroupId, studySourceNoteGroups]);
```

Return `studyNoteGroups`.

- [ ] **Step 4: Pass grouped model to content**

In `StudyAppMainContent.jsx`, pass:

```jsx
studyNoteGroups={studyNoteGroups}
studySourceNoteGroups={studySourceNoteGroups}
```

into `NoteGroupScopeContent`.

- [ ] **Step 5: Render grouped Study Cards**

In `StudyScopeContent.jsx`, add props `studyNoteGroups = []` and render groups in the inline Study page:

```jsx
const inlineStudyGroups = studyNoteGroups.length
  ? studyNoteGroups
  : [{
      id: selectedNoteGroupId || "selected-note-group",
      title: selectedNoteGroup?.title || "Study Cards",
      studyCards: studyNoteSections.map((section) => ({
        id: section.study_card_id,
        title: section.title,
        content: section.content,
        note_group_id: selectedNoteGroupId
      })).filter((card) => card.id)
    }];
```

Render:

```jsx
{inlineStudyGroups.map((group) => (
  <section className="study-note-group" key={group.id}>
    <div className="study-note-group-divider">
      <span>{group.title}</span>
    </div>
    {group.studyCards.map((card, index) => {
      const title = card.title || `Study Card ${index + 1}`;
      const sourceRanges = getValidSourceRanges(sourceRangesByCardId, card.id);
      const sourceDisabled = !sourceRanges.length;
      return (
        <section id={`reading-study-${card.id}`} className={`reading-section ${readingPinnedCardId === card.id ? "pinned" : ""}`} key={card.id}>
          <button
            className="reading-section-toggle"
            type="button"
            aria-label={sourceDisabled ? `Source text unavailable for ${title}` : `View source text for ${title}`}
            disabled={sourceDisabled}
            onClick={(event) => handleStudyCardSourceOpen(event, card.id, 0)}
          >
            <Search size={16} aria-hidden="true" />
          </button>
          <div className="reading-section-header"><h3>{title}</h3></div>
          <div className="reading-section-body">{renderMarkdownBlocks(card.content || "")}</div>
        </section>
      );
    })}
  </section>
))}
```

- [ ] **Step 6: Add group divider styles**

In `frontend/src/styles.css`, add:

```css
.study-note-group {
  display: grid;
  gap: 12px;
}

.study-note-group + .study-note-group {
  margin-top: 18px;
}

.study-note-group-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 800;
  text-transform: uppercase;
}

.study-note-group-divider::after {
  content: "";
  height: 1px;
  flex: 1;
  background: #cbd5e1;
}
```

- [ ] **Step 7: Run StudyScope tests**

```bash
cd frontend
npm run test -- StudyScopeContent.test.jsx
```

Expected: tests pass.

- [ ] **Step 8: Commit grouped Study UI**

```bash
git add frontend/src/features/app-shell/useStudyAppEffects.js frontend/src/features/app-shell/StudyAppMainContent.jsx frontend/src/features/study-scope/StudyScopeContent.jsx frontend/src/features/study-scope/StudyScopeContent.test.jsx frontend/src/styles.css
git commit -m "feat: group study cards by note group"
```

---

### Task 4: Note Group Aware Source Text Modal

**Files:**
- Modify: `frontend/src/features/app-shell/useStudyAppEffects.js`
- Modify: `frontend/src/features/study-scope/StudyScopeContent.jsx`
- Test: `frontend/src/features/study-scope/StudyScopeContent.test.jsx`

- [ ] **Step 1: Write modal dropdown tests**

Add tests:

```jsx
test("Source Text modal exposes scoped Note Group selector when unpinned", () => {
  const html = renderToStaticMarkup(
    <SourceTextContainer
      classes={classes}
      readingAvailable
      noteGroupOptions={[
        { value: "note-a", label: "Alpha" },
        { value: "note-b", label: "Beta" }
      ]}
      activeSourceNoteGroupId="note-a"
      onSourceNoteGroupChange={vi.fn()}
      readingPinnedCardId=""
      effectiveCleanedText="source"
    />
  );
  expect(html).toContain("aria-label=\"Select source Note Group\"");
  expect(html).toContain("Alpha");
  expect(html).not.toContain("disabled");
});

test("Source Text modal disables Note Group selector when pinned", () => {
  const html = renderToStaticMarkup(
    <SourceTextContainer
      classes={classes}
      readingAvailable
      noteGroupOptions={[{ value: "note-a", label: "Alpha" }]}
      activeSourceNoteGroupId="note-a"
      onSourceNoteGroupChange={vi.fn()}
      readingPinnedCardId="card-a"
      pinnedStudyCard={{ id: "card-a", title: "Pinned", content: "Body" }}
      pinnedStudyCardPositionLabel="Study Card 1 of 1"
      effectiveCleanedText="source"
    />
  );
  expect(html).toContain("aria-label=\"Select source Note Group\"");
  expect(html).toContain("disabled");
});
```

- [ ] **Step 2: Run focused tests to verify failure**

```bash
cd frontend
npm run test -- StudyScopeContent.test.jsx
```

Expected: selector tests fail.

- [ ] **Step 3: Add active source state and payload selection**

In `StudyScopeContent.jsx`, add:

```js
const [activeSourceNoteGroupId, setActiveSourceNoteGroupId] = useState("");
const sourceGroupsById = useMemo(
  () => new Map((studySourceNoteGroups || []).map((group) => [group.id, group])),
  [studySourceNoteGroups]
);
const pinnedSourceNoteGroupId = pinnedStudyCard?.note_group_id || "";
const resolvedSourceNoteGroupId =
  pinnedSourceNoteGroupId || activeSourceNoteGroupId || studySourceNoteGroups[0]?.id || selectedNoteGroupId || "";
const activeSourceGroup = sourceGroupsById.get(resolvedSourceNoteGroupId);
```

Use `activeSourceGroup?.cleaned_text_markdown` and `activeSourceGroup?.study_cards` to build source ranges for the modal context.

```js
const activeSourceStudyCards = activeSourceGroup?.study_cards || [];
const activeSourceRangesByCardId = useMemo(() => {
  const map = new Map();
  activeSourceStudyCards.forEach((card) => {
    map.set(card.id, Array.isArray(card.source_ranges) ? card.source_ranges : []);
  });
  return map;
}, [activeSourceStudyCards]);
const activeSourceText = activeSourceGroup?.cleaned_text_markdown || "";
```

- [ ] **Step 4: Render selector in `SourceTextContainer`**

Add props `noteGroupOptions`, `activeSourceNoteGroupId`, `onSourceNoteGroupChange`, and render above the source content:

```jsx
{noteGroupOptions?.length ? (
  <label className="source-note-group-picker">
    <span>Note Group</span>
    <select
      aria-label="Select source Note Group"
      value={activeSourceNoteGroupId}
      onChange={(event) => onSourceNoteGroupChange?.(event.target.value)}
      disabled={Boolean(readingPinnedCardId)}
    >
      {noteGroupOptions.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  </label>
) : null}
```

- [ ] **Step 5: Add selector styles**

In `styles.css`:

```css
.source-note-group-picker {
  display: grid;
  gap: 4px;
  max-width: 280px;
  margin-bottom: 12px;
}

.source-note-group-picker span {
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
}
```

- [ ] **Step 6: Run modal tests**

```bash
cd frontend
npm run test -- StudyScopeContent.test.jsx
```

Expected: tests pass.

- [ ] **Step 7: Commit modal selector**

```bash
git add frontend/src/features/study-scope/StudyScopeContent.jsx frontend/src/features/study-scope/StudyScopeContent.test.jsx frontend/src/styles.css
git commit -m "feat: add source note group selector"
```

---

### Task 5: Cross-Note-Group Pinned Navigation

**Files:**
- Modify: `frontend/src/features/app-shell/useStudyAppEffects.js`
- Modify: `frontend/src/features/reading/useReadingWorkflowActions.js`
- Modify: `frontend/src/features/study-scope/StudyScopeContent.jsx`
- Test: `frontend/src/features/reading/useReadingWorkflowActions.test.js`
- Test: `frontend/src/features/study-scope/StudyScopeContent.test.jsx`

- [ ] **Step 1: Write boundary navigation tests**

In `StudyScopeContent.test.jsx`, add:

```jsx
test("marks cross Note Group boundary navigation buttons", () => {
  const html = renderToStaticMarkup(
    <SourceTextContainer
      classes={classes}
      readingAvailable
      readingPinnedCardId="card-last-in-group"
      pinnedStudyCard={{ id: "card-last-in-group", title: "Pinned", content: "Body" }}
      pinnedStudyCardPositionLabel="Study Card 2 of 4"
      hasPreviousStudyCard
      hasNextStudyCard
      nextStudyCardCrossesNoteGroup
      effectiveCleanedText="source"
    />
  );
  expect(getButtonMarkup(html, "Pin next Study Card")).toContain("source-lookup-boundary");
});
```

In `useReadingWorkflowActions.test.js`, add:

```js
test("next Study Card navigation follows flattened visible Study Card order", () => {
  const setReadingPinnedCardId = vi.fn((updater) => updater("card-a"));
  const actions = useReadingWorkflowActions({
    readingPinnedCardId: "card-a",
    visibleStudyCardOrder: [
      { id: "card-a", noteGroupId: "note-1" },
      { id: "card-b", noteGroupId: "note-2" }
    ],
    setReadingPinnedCardId,
    setActiveSourceRangeIndex: vi.fn(),
    setReadingHoverCardId: vi.fn(),
    setReadingMode: vi.fn(),
    readingContentRef: { current: null }
  });
  actions.handleReadingNextStudyCard();
  expect(setReadingPinnedCardId).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run focused tests to verify failure**

```bash
cd frontend
npm run test -- StudyScopeContent.test.jsx useReadingWorkflowActions.test.js
```

Expected: tests fail because cross-group metadata is missing.

- [ ] **Step 3: Build flattened visible order**

In `useStudyAppEffects.js`, derive:

```js
const visibleStudyCardOrder = useMemo(
  () =>
    studyNoteGroups.flatMap((group) =>
      group.studyCards.map((card) => ({ id: card.id, noteGroupId: group.id }))
    ),
  [studyNoteGroups]
);
```

Return it and pass into reading workflow actions in `StudyAppShell.jsx`.

- [ ] **Step 4: Extend reading workflow actions**

In `useReadingWorkflowActions.js`, accept `visibleStudyCardOrder = []`. Replace the `orderedStudyCardIds` lookup with:

```js
const orderedStudyCards = visibleStudyCardOrder.length
  ? visibleStudyCardOrder
  : studyNoteSections.map((section) => ({ id: section.study_card_id, noteGroupId: section.note_group_id || "" })).filter((item) => item.id);
const orderedStudyCardIds = orderedStudyCards.map((item) => item.id);
```

Update previous/next handlers to set `setActiveSourceRangeIndex(0)`, `setReadingHoverCardId(nextId)`, and `setReadingPinnedCardId(nextId)`.

- [ ] **Step 5: Compute boundary metadata**

In `StudyScopeContent.jsx`, compute:

```js
const currentVisibleIndex = visibleStudyCardOrder.findIndex((item) => item.id === readingPinnedCardId);
const previousVisibleCard = currentVisibleIndex > 0 ? visibleStudyCardOrder[currentVisibleIndex - 1] : null;
const nextVisibleCard =
  currentVisibleIndex >= 0 && currentVisibleIndex < visibleStudyCardOrder.length - 1
    ? visibleStudyCardOrder[currentVisibleIndex + 1]
    : null;
const currentVisibleCard = currentVisibleIndex >= 0 ? visibleStudyCardOrder[currentVisibleIndex] : null;
const previousStudyCardCrossesNoteGroup = Boolean(
  previousVisibleCard && currentVisibleCard && previousVisibleCard.noteGroupId !== currentVisibleCard.noteGroupId
);
const nextStudyCardCrossesNoteGroup = Boolean(
  nextVisibleCard && currentVisibleCard && nextVisibleCard.noteGroupId !== currentVisibleCard.noteGroupId
);
```

Pass both booleans into `SourceTextContainer`.

- [ ] **Step 6: Render blue boundary buttons**

In `SourceTextContainer`, add class names:

```jsx
className={previousStudyCardCrossesNoteGroup ? "source-lookup-boundary" : ""}
```

and

```jsx
className={nextStudyCardCrossesNoteGroup ? "source-lookup-boundary" : ""}
```

In `styles.css`:

```css
.source-lookup-nav button.source-lookup-boundary {
  border-color: #2f69aa;
  background: rgba(47, 105, 170, 0.12);
  color: #1f4f82;
}

.source-lookup-nav button.source-lookup-boundary:hover {
  background: rgba(47, 105, 170, 0.18);
  color: #163f69;
}
```

- [ ] **Step 7: Run navigation tests**

```bash
cd frontend
npm run test -- StudyScopeContent.test.jsx useReadingWorkflowActions.test.js
```

Expected: all focused tests pass.

- [ ] **Step 8: Commit cross-group navigation**

```bash
git add frontend/src/features/app-shell/useStudyAppEffects.js frontend/src/features/app-shell/StudyAppShell.jsx frontend/src/features/reading/useReadingWorkflowActions.js frontend/src/features/reading/useReadingWorkflowActions.test.js frontend/src/features/study-scope/StudyScopeContent.jsx frontend/src/features/study-scope/StudyScopeContent.test.jsx frontend/src/styles.css
git commit -m "feat: navigate study sources across note groups"
```

---

### Task 6: Full Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run backend tests**

```bash
cd backend
.venv/bin/python -m pytest tests/test_study_source_routes.py
```

Expected: pass.

- [ ] **Step 2: Run frontend tests**

```bash
cd frontend
npm run test
```

Expected: 36+ test files pass.

- [ ] **Step 3: Run whitespace check**

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 4: Manual verification**

Run the app and verify:

```bash
cd frontend
npm run dev
```

Expected:

- Module Study shows groups in sidebar Note Group order.
- Concept Study updates when the descendant toggle changes.
- Magnifying glass opens Source Text for the card's Note Group.
- Manual `View Source Text` opens a modal with a Note Group dropdown.
- Dropdown is disabled while a card is pinned.
- Boundary previous/next buttons turn blue and cross Note Groups in visible order.

- [ ] **Step 5: Final commit if needed**

If verification fixes were required:

```bash
git add frontend backend
git commit -m "fix: verify grouped study source navigation"
```

---

## Self-Review

- **Spec coverage:** Module and Concept Study pages, Note Group grouping, descendant toggle behavior, dedupe, source modal dropdown, pinned dropdown disabling, boundary navigation, and tests are covered.
- **Placeholder scan:** No placeholders are intentionally left in this plan.
- **Type consistency:** The plan consistently uses `StudySourceResponse`, `studySourceNoteGroups`, `studyNoteGroups`, `visibleStudyCardOrder`, and `SourceTextContainer`.
