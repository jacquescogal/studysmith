import { useMemo, useState } from "react";
import { Edit, Search, Trash2, X } from "lucide-react";

import { ErrorAlert } from "@/components/common/ErrorAlert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatDurationMs, formatPercent } from "@/lib/format";
import { renderMarkdownBlocks } from "@/lib/text-rendering";

export function NoteGroupViewCards({
  rows = [],
  studyCards = [],
  questionCards = [],
  topicChips = [],
  canEdit = false,
  showEditControls = canEdit,
  editingStudyCardId = "",
  editingStudyCard = { title: "", content: "" },
  editingQuestionCardId = "",
  editingQuestionCard = {
    type: "mcq",
    prompt: "",
    optionsText: "",
    correctIndicesText: "",
    refs: [],
  },
  unlinkedQuestionCount = 0,
  fixedTopicFilter = null,
  loading = false,
  error = "",
  onEditStudyCard,
  onEditingStudyCardChange,
  onSaveStudyCard,
  onCancelStudyCardEdit,
  onDeleteStudyCard,
  onEditQuestionCard,
  onEditingQuestionCardChange,
  onSaveQuestionCard,
  onCancelQuestionCardEdit,
  onDeleteQuestionCard,
}) {
  const [selectedStudyCardId, setSelectedStudyCardId] = useState("");
  const [selectedQuestionCardId, setSelectedQuestionCardId] = useState("");
  const [masteryFilter, setMasteryFilter] = useState("all");
  const [reviewedFilter, setReviewedFilter] = useState("all");
  const [dueFilter, setDueFilter] = useState("all");
  const [selectedTopicFilters, setSelectedTopicFilters] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "default", direction: "asc" });
  const questionCount = rows.reduce(
    (total, row) => total + (row.question_cards || []).length,
    0
  );
  const studyCardsById = useMemo(() => new Map(studyCards.map((card) => [card.id, card])), [studyCards]);
  const questionCardsById = useMemo(
    () => new Map(questionCards.map((card) => [card.id, card])),
    [questionCards]
  );
  const availableTopicFilters = useMemo(() => {
    if (topicChips.length) {
      return topicChips;
    }
    const topicsById = new Map();
    studyCards.forEach((card) => {
      (card.topic_chips || []).forEach((topic) => {
        if (topic?.id && !topicsById.has(topic.id)) {
          topicsById.set(topic.id, topic);
        }
      });
    });
    return Array.from(topicsById.values()).sort((a, b) =>
      String(a.label || "").localeCompare(String(b.label || ""))
    );
  }, [studyCards, topicChips]);
  const isTopicFilterFixed = Boolean(fixedTopicFilter?.id);
  const activeTopicFilters = useMemo(
    () => (isTopicFilterFixed ? [fixedTopicFilter.id] : selectedTopicFilters),
    [fixedTopicFilter, isTopicFilterFixed, selectedTopicFilters]
  );
  const selectedTopicFilterLabels = useMemo(
    () =>
      isTopicFilterFixed
        ? [fixedTopicFilter]
        : availableTopicFilters.filter((topic) =>
            selectedTopicFilters.includes(topic.id)
          ),
    [availableTopicFilters, fixedTopicFilter, isTopicFilterFixed, selectedTopicFilters]
  );
  const selectedStudyCard = selectedStudyCardId ? studyCardsById.get(selectedStudyCardId) : null;
  const selectedRow = selectedStudyCardId
    ? rows.find((row) => row.study_card.id === selectedStudyCardId)
    : null;
  const selectedQuestions = selectedRow?.question_cards || [];
  const selectedTitle =
    selectedStudyCard?.title || selectedRow?.study_card?.title || "Untitled Study Card";
  const selectedTopics = selectedStudyCard?.topic_chips || [];
  const isEditingSelected = editingStudyCardId === selectedStudyCardId;
  const selectedQuestionCard = selectedQuestionCardId
    ? questionCardsById.get(selectedQuestionCardId)
    : null;
  const selectedQuestionRow = selectedQuestionCardId
    ? rows
        .flatMap((row) => row.question_cards || [])
        .find((question) => question.id === selectedQuestionCardId)
    : null;
  const selectedQuestionPrompt =
    selectedQuestionCard?.prompt || selectedQuestionRow?.prompt || "Untitled Question Card";
  const selectedQuestionRefs = selectedQuestionCard?.study_card_refs || [];
  const isEditingQuestionSelected = editingQuestionCardId === selectedQuestionCardId;

  const formatMastery = (question) => {
    if (question.mastery === null || question.mastery === undefined) {
      return "Unknown";
    }
    const tier = question.mastery_tier || "unknown";
    const label = tier.charAt(0).toUpperCase() + tier.slice(1);
    return `${label} (${Number(question.mastery).toFixed(1)})`;
  };

  const formatNullablePercent = (value) =>
    value === null || value === undefined ? "—" : formatPercent(value);

  const formatDueDate = (value) => {
    if (!value) {
      return "—";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "—";
    }
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const matchesDueFilter = (question, now) => {
    if (dueFilter === "all") {
      return true;
    }
    if (!question.due_at) {
      return dueFilter === "none";
    }
    const dueTime = new Date(question.due_at).getTime();
    if (Number.isNaN(dueTime)) {
      return dueFilter === "none";
    }
    if (dueFilter === "due") {
      return dueTime <= now;
    }
    if (dueFilter === "upcoming") {
      return dueTime > now;
    }
    return true;
  };

  const questionSortValue = (question, key) => {
    if (key === "question") {
      return (question.prompt || "").toLowerCase();
    }
    if (key === "mastery") {
      return question.mastery ?? Number.NEGATIVE_INFINITY;
    }
    if (key === "success") {
      return question.success_rate ?? Number.NEGATIVE_INFINITY;
    }
    if (key === "median") {
      return question.median_response_time_ms ?? Number.POSITIVE_INFINITY;
    }
    if (key === "reviews") {
      return question.reviews ?? 0;
    }
    if (key === "due") {
      if (!question.due_at) {
        return Number.POSITIVE_INFINITY;
      }
      const dueTime = new Date(question.due_at).getTime();
      return Number.isNaN(dueTime) ? Number.POSITIVE_INFINITY : dueTime;
    }
    return 0;
  };

  const compareQuestions = (a, b) => {
    if (sortConfig.key === "default") {
      return 0;
    }
    const left = questionSortValue(a, sortConfig.key);
    const right = questionSortValue(b, sortConfig.key);
    let comparison = 0;
    if (typeof left === "string" || typeof right === "string") {
      comparison = String(left).localeCompare(String(right));
    } else {
      comparison = left - right;
    }
    return sortConfig.direction === "desc" ? -comparison : comparison;
  };

  const filteredRows = useMemo(() => {
    const now = Date.now();
    const query = searchQuery.trim().toLowerCase();
    const hasQuestionFilters =
      masteryFilter !== "all" || reviewedFilter !== "all" || dueFilter !== "all";
    const nextRows = rows
      .map((row) => {
        const fullStudyCard = studyCardsById.get(row.study_card.id);
        const studyTopicIds = new Set(
          (fullStudyCard?.topic_chips || row.study_card.topic_chips || []).map((topic) => topic.id)
        );
        const topicMatches =
          activeTopicFilters.length === 0 ||
          activeTopicFilters.some((topicId) => studyTopicIds.has(topicId));
        const studyTitle = row.study_card.title || "Untitled Study Card";
        const studyMatches = !query || studyTitle.toLowerCase().includes(query);
        if (!topicMatches) {
          return null;
        }
        const questions = (row.question_cards || []).filter((question) => {
          const prompt = question.prompt || "";
          const searchMatches = studyMatches || !query || prompt.toLowerCase().includes(query);
          const masteryMatches =
            masteryFilter === "all" || (question.mastery_tier || "unknown") === masteryFilter;
          const reviewCount = question.reviews ?? 0;
          const reviewedMatches =
            reviewedFilter === "all" ||
            (reviewedFilter === "reviewed" ? reviewCount > 0 : reviewCount === 0);
          return (
            searchMatches &&
            masteryMatches &&
            reviewedMatches &&
            matchesDueFilter(question, now)
          );
        });

        if (!questions.length) {
          if (!row.question_cards?.length && !hasQuestionFilters && studyMatches) {
            return { ...row, question_cards: [] };
          }
          return null;
        }

        return {
          ...row,
          question_cards:
            sortConfig.key === "default" ? questions : [...questions].sort(compareQuestions),
        };
      })
      .filter(Boolean);

    if (sortConfig.key === "default") {
      return nextRows;
    }
    return [...nextRows].sort((a, b) => {
      const aQuestion = a.question_cards?.[0];
      const bQuestion = b.question_cards?.[0];
      if (!aQuestion && !bQuestion) {
        return 0;
      }
      if (!aQuestion) {
        return 1;
      }
      if (!bQuestion) {
        return -1;
      }
      return compareQuestions(aQuestion, bQuestion);
    });
  }, [
    rows,
    studyCardsById,
    masteryFilter,
    reviewedFilter,
    dueFilter,
    activeTopicFilters,
    searchQuery,
    sortConfig,
  ]);

  const filteredQuestionCount = filteredRows.reduce(
    (total, row) => total + (row.question_cards || []).length,
    0
  );

  const toggleSort = (key) => {
    setSortConfig((current) => {
      if (current.key !== key) {
        return { key, direction: "asc" };
      }
      return { key, direction: current.direction === "asc" ? "desc" : "asc" };
    });
  };

  const toggleTopicFilter = (topicId) => {
    setSelectedTopicFilters((current) =>
      current.includes(topicId)
        ? current.filter((id) => id !== topicId)
        : [...current, topicId]
    );
  };

  const sortLabel = (key, label) => {
    if (sortConfig.key !== key) {
      return `${label} ↕`;
    }
    return `${label} ${sortConfig.direction === "asc" ? "↑" : "↓"}`;
  };

  const closeStudyCardDialog = () => {
    onCancelStudyCardEdit?.();
    setSelectedStudyCardId("");
  };

  const closeQuestionCardDialog = () => {
    onCancelQuestionCardEdit?.();
    setSelectedQuestionCardId("");
  };

  const saveSelectedStudyCard = async () => {
    if (!selectedStudyCardId) {
      return;
    }
    await onSaveStudyCard?.(selectedStudyCardId);
  };

  const deleteSelectedStudyCard = async () => {
    if (!selectedStudyCardId) {
      return;
    }
    const deleted = await onDeleteStudyCard?.(selectedStudyCardId);
    if (deleted) {
      setSelectedStudyCardId("");
    }
  };

  const saveSelectedQuestionCard = async () => {
    if (!selectedQuestionCardId) {
      return;
    }
    await onSaveQuestionCard?.(selectedQuestionCardId);
  };

  const deleteSelectedQuestionCard = async () => {
    if (!selectedQuestionCardId) {
      return;
    }
    const deleted = await onDeleteQuestionCard?.(selectedQuestionCardId);
    if (deleted) {
      setSelectedQuestionCardId("");
    }
  };

  const toggleEditingTopic = (topicId) => {
    const currentIds = editingStudyCard.chipIds || [];
    onEditingStudyCardChange?.({
      ...editingStudyCard,
      chipIds: currentIds.includes(topicId)
        ? currentIds.filter((id) => id !== topicId)
        : [...currentIds, topicId],
    });
  };

  const toggleEditingQuestionReference = (studyCardId) => {
    const refs = editingQuestionCard.refs || [];
    onEditingQuestionCardChange?.({
      ...editingQuestionCard,
      refs: refs.includes(studyCardId)
        ? refs.filter((id) => id !== studyCardId)
        : [...refs, studyCardId],
    });
  };

  const renderStudyCardCell = (row) => {
    const studyCard = studyCardsById.get(row.study_card.id) || row.study_card;

    return (
      <div className="flex items-start justify-between gap-3">
        <div>{row.study_card.title || "Untitled Study Card"}</div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="View Study Card details"
          onClick={() => setSelectedStudyCardId(studyCard.id)}
        >
          <Search className="size-4" />
        </Button>
      </div>
    );
  };

  const renderQuestionCardCell = (question) => {
    const questionCard = questionCardsById.get(question.id) || question;

    return (
      <div className="flex items-start justify-between gap-3">
        <div>{questionCard.prompt || "Untitled Question Card"}</div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="View Question Card details"
          onClick={() => setSelectedQuestionCardId(questionCard.id)}
        >
          <Search className="size-4" />
        </Button>
      </div>
    );
  };

  return (
    <section className="space-y-4" id="view-cards">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">View Cards</h2>
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Loading cards."
              : `${filteredRows.length} Study Cards and ${filteredQuestionCount} of ${questionCount} linked Question Cards.`}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3 text-card-foreground shadow-sm">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="view-cards-search">
            Search
          </label>
          <Input
            id="view-cards-search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search cards"
            className="w-56"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Mastery</label>
          <Select value={masteryFilter} onValueChange={setMasteryFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Mastery" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All mastery</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Topic</label>
          {isTopicFilterFixed ? (
            <div className="flex h-9 items-center">
              <Badge variant="secondary">Fixed topic: {fixedTopicFilter.label}</Badge>
            </div>
          ) : (
            <Popover>
              <PopoverTrigger
                type="button"
                className={buttonVariants({
                  variant: "outline",
                  className: "h-9 w-56 justify-between",
                })}
                aria-label="Filter Study Cards by topics"
              >
                {selectedTopicFilters.length
                  ? `${selectedTopicFilters.length} topics selected`
                  : "All topics"}
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-2">
                {availableTopicFilters.length ? (
                  <div className="space-y-1">
                    {availableTopicFilters.map((topic) => (
                      <label
                        key={topic.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                      >
                        <Checkbox
                          checked={selectedTopicFilters.includes(topic.id)}
                          onCheckedChange={() => toggleTopicFilter(topic.id)}
                        />
                        {topic.label}
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="px-2 py-1.5 text-sm text-muted-foreground">
                    No topics available.
                  </p>
                )}
              </PopoverContent>
            </Popover>
          )}
          {selectedTopicFilterLabels.length && !isTopicFilterFixed ? (
            <div className="flex max-w-56 flex-wrap gap-1">
              {selectedTopicFilterLabels.map((topic) => (
                <Badge key={topic.id} variant="outline">
                  {topic.label}
                  <button
                    type="button"
                    aria-label={`Remove ${topic.label} topic filter`}
                    onClick={() => toggleTopicFilter(topic.id)}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Reviewed</label>
          <Select value={reviewedFilter} onValueChange={setReviewedFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Reviewed" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All reviews</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="unreviewed">Unreviewed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Due</label>
          <Select value={dueFilter} onValueChange={setDueFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Due" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All due dates</SelectItem>
              <SelectItem value="due">Due now</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="none">No due date</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setSearchQuery("");
            setMasteryFilter("all");
            setReviewedFilter("all");
            setDueFilter("all");
            if (!isTopicFilterFixed) {
              setSelectedTopicFilters([]);
            }
            setSortConfig({ key: "default", direction: "asc" });
          }}
        >
          Reset
        </Button>
      </div>
      <ErrorAlert title="View Cards failed" message={error} />
      {unlinkedQuestionCount ? (
        <p className="text-sm text-muted-foreground">
          {unlinkedQuestionCount} Question Cards are not linked to a Study Card.
        </p>
      ) : null}
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[32%] px-4">Study Card</TableHead>
              <TableHead className="px-4">
                <Button type="button" variant="ghost" size="sm" onClick={() => toggleSort("question")}>
                  {sortLabel("question", "Question Card")}
                </Button>
              </TableHead>
              <TableHead className="px-4">
                <Button type="button" variant="ghost" size="sm" onClick={() => toggleSort("mastery")}>
                  {sortLabel("mastery", "Mastery")}
                </Button>
              </TableHead>
              <TableHead className="px-4">
                <Button type="button" variant="ghost" size="sm" onClick={() => toggleSort("success")}>
                  {sortLabel("success", "Success Rate")}
                </Button>
              </TableHead>
              <TableHead className="px-4">
                <Button type="button" variant="ghost" size="sm" onClick={() => toggleSort("median")}>
                  {sortLabel("median", "Median Time")}
                </Button>
              </TableHead>
              <TableHead className="px-4">
                <Button type="button" variant="ghost" size="sm" onClick={() => toggleSort("reviews")}>
                  {sortLabel("reviews", "Reviews")}
                </Button>
              </TableHead>
              <TableHead className="px-4">
                <Button type="button" variant="ghost" size="sm" onClick={() => toggleSort("due")}>
                  {sortLabel("due", "Due")}
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell className="px-4 py-6 text-sm text-muted-foreground" colSpan={7}>
                  Loading cards.
                </TableCell>
              </TableRow>
            ) : filteredRows.length ? (
              filteredRows.map((row) => {
                const questions = row.question_cards || [];
                if (!questions.length) {
                  return (
                    <TableRow key={row.study_card.id}>
                      <TableCell className="px-4 align-top font-medium whitespace-normal">
                        {renderStudyCardCell(row)}
                      </TableCell>
                      <TableCell className="px-4 text-muted-foreground whitespace-normal">
                        No linked Question Cards
                      </TableCell>
                      <TableCell className="px-4 text-muted-foreground">—</TableCell>
                      <TableCell className="px-4 text-muted-foreground">—</TableCell>
                      <TableCell className="px-4 text-muted-foreground">—</TableCell>
                      <TableCell className="px-4 text-muted-foreground">—</TableCell>
                      <TableCell className="px-4 text-muted-foreground">—</TableCell>
                    </TableRow>
                  );
                }
                return questions.map((question, index) => (
                  <TableRow key={`${row.study_card.id}-${question.id}`}>
                    {index === 0 ? (
                      <TableCell
                        className="px-4 align-top font-medium whitespace-normal"
                        rowSpan={questions.length}
                      >
                        {renderStudyCardCell(row)}
                      </TableCell>
                    ) : null}
                    <TableCell className="px-4 whitespace-normal">
                      {renderQuestionCardCell(question)}
                    </TableCell>
                    <TableCell className="px-4">{formatMastery(question)}</TableCell>
                    <TableCell className="px-4">
                      {formatNullablePercent(question.success_rate)}
                    </TableCell>
                    <TableCell className="px-4">
                      {formatDurationMs(question.median_response_time_ms)}
                    </TableCell>
                    <TableCell className="px-4">{question.reviews ?? 0}</TableCell>
                    <TableCell className="px-4">{formatDueDate(question.due_at)}</TableCell>
                  </TableRow>
                ));
              })
            ) : (
              <TableRow>
                <TableCell className="px-4 py-6 text-sm text-muted-foreground" colSpan={7}>
                  No Study Cards found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <Dialog open={Boolean(selectedStudyCardId)} onOpenChange={(open) => {
        if (!open) {
          closeStudyCardDialog();
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{isEditingSelected ? "Edit Study Card" : selectedTitle}</DialogTitle>
          </DialogHeader>
          {selectedStudyCard || selectedRow ? (
            <div className="space-y-5">
              {isEditingSelected ? (
                <div className="space-y-4">
                  <Input
                    value={editingStudyCard.title}
                    onChange={(event) =>
                      onEditingStudyCardChange?.({
                        ...editingStudyCard,
                        title: event.target.value,
                      })
                    }
                    aria-label="Study Card title"
                  />
                  <Textarea
                    value={editingStudyCard.content}
                    onChange={(event) =>
                      onEditingStudyCardChange?.({
                        ...editingStudyCard,
                        content: event.target.value,
                      })
                    }
                    rows={10}
                    aria-label="Study Card content"
                  />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Topics</p>
                    {topicChips.length ? (
                      <div className="flex flex-wrap gap-3">
                        {topicChips.map((topic) => (
                          <label key={topic.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={(editingStudyCard.chipIds || []).includes(topic.id)}
                              onCheckedChange={() => toggleEditingTopic(topic.id)}
                            />
                            {topic.label}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No topics available.</p>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Content</p>
                    <div className="prose prose-sm max-w-none rounded-md border bg-muted/20 p-3 text-sm dark:prose-invert">
                      {selectedStudyCard?.content
                        ? renderMarkdownBlocks(selectedStudyCard.content)
                        : <p className="text-muted-foreground">No content.</p>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Topics</p>
                    {selectedTopics.length ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedTopics.map((topic) => (
                          <Badge key={topic.id} variant="secondary">
                            {topic.label}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No topics.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Linked Question Cards</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedQuestions.length} linked Question Cards.
                    </p>
                  </div>
                </>
              )}
            </div>
          ) : null}
          <DialogFooter>
            {isEditingSelected ? (
              <>
                <Button type="button" onClick={saveSelectedStudyCard}>
                  Save
                </Button>
                <Button type="button" variant="outline" onClick={onCancelStudyCardEdit}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                {showEditControls ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => selectedStudyCard && onEditStudyCard?.(selectedStudyCard)}
                      disabled={!canEdit}
                    >
                      <Edit className="size-4" /> Edit
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={deleteSelectedStudyCard}
                      disabled={!canEdit}
                    >
                      <Trash2 className="size-4" /> Delete
                    </Button>
                  </>
                ) : null}
                <Button type="button" variant="outline" onClick={closeStudyCardDialog}>
                  Close
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(selectedQuestionCardId)} onOpenChange={(open) => {
        if (!open) {
          closeQuestionCardDialog();
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {isEditingQuestionSelected ? "Edit Question Card" : "Question Card"}
            </DialogTitle>
          </DialogHeader>
          {selectedQuestionCard || selectedQuestionRow ? (
            <div className="space-y-5">
              {isEditingQuestionSelected ? (
                <div className="space-y-4">
                  <Select
                    value={editingQuestionCard.type}
                    onValueChange={(value) =>
                      onEditingQuestionCardChange?.({
                        ...editingQuestionCard,
                        type: value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Question type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mcq">MCQ</SelectItem>
                      <SelectItem value="multi">Multi-answer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea
                    value={editingQuestionCard.prompt}
                    onChange={(event) =>
                      onEditingQuestionCardChange?.({
                        ...editingQuestionCard,
                        prompt: event.target.value,
                      })
                    }
                    rows={4}
                    aria-label="Question Card prompt"
                  />
                  <Textarea
                    value={editingQuestionCard.optionsText}
                    onChange={(event) =>
                      onEditingQuestionCardChange?.({
                        ...editingQuestionCard,
                        optionsText: event.target.value,
                      })
                    }
                    rows={5}
                    aria-label="Question Card options"
                  />
                  <Input
                    value={editingQuestionCard.correctIndicesText}
                    onChange={(event) =>
                      onEditingQuestionCardChange?.({
                        ...editingQuestionCard,
                        correctIndicesText: event.target.value,
                      })
                    }
                    aria-label="Correct option indices"
                  />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Study Card References</p>
                    <div className="flex flex-wrap gap-3">
                      {studyCards.map((studyCard) => (
                        <label key={studyCard.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={(editingQuestionCard.refs || []).includes(studyCard.id)}
                            onCheckedChange={() => toggleEditingQuestionReference(studyCard.id)}
                          />
                          {studyCard.title || "Untitled Study Card"}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {(selectedQuestionCard?.type || "Question Card").toUpperCase()}
                    </Badge>
                    {selectedQuestionCard?.stale ? <Badge variant="destructive">Stale</Badge> : null}
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Prompt</p>
                    <p className="rounded-md border bg-muted/20 p-3 text-sm">
                      {selectedQuestionPrompt}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Options</p>
                    <ul className="space-y-2 text-sm">
                      {(selectedQuestionCard?.options || []).map((option, index) => (
                        <li
                          key={`${selectedQuestionCard.id}-${index}`}
                          className={
                            (selectedQuestionCard.correct_option_indices || []).includes(index)
                              ? "rounded-md border border-green-300 bg-green-50 p-2 text-green-950"
                              : "rounded-md border p-2"
                          }
                        >
                          {option}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Study Card References</p>
                    {selectedQuestionRefs.length ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedQuestionRefs.map((studyCardId) => (
                          <Badge key={studyCardId} variant="outline">
                            {studyCardsById.get(studyCardId)?.title || studyCardId.slice(0, 8)}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No Study Card references.</p>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : null}
          <DialogFooter>
            {isEditingQuestionSelected ? (
              <>
                <Button type="button" onClick={saveSelectedQuestionCard}>
                  Save
                </Button>
                <Button type="button" variant="outline" onClick={onCancelQuestionCardEdit}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                {showEditControls ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        selectedQuestionCard && onEditQuestionCard?.(selectedQuestionCard)
                      }
                      disabled={!canEdit}
                    >
                      <Edit className="size-4" /> Edit
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={deleteSelectedQuestionCard}
                      disabled={!canEdit}
                    >
                      <Trash2 className="size-4" /> Delete
                    </Button>
                  </>
                ) : null}
                <Button type="button" variant="outline" onClick={closeQuestionCardDialog}>
                  Close
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
