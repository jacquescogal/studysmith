import { Edit, Eye, Plus, RefreshCcw, Trash2 } from "lucide-react";

import { ErrorAlert } from "@/components/common/ErrorAlert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getMasteryScore, getMasteryTier } from "@/lib/review";

export function QuestionCardList({
  cards,
  masteryFilter,
  reviewCount,
  generationStatus,
  generating,
  canEdit,
  showEditControls = canEdit,
  canReview = true,
  editingQuestionCardId,
  editingQuestionCard,
  studyCards,
  error,
  onMasteryFilterChange,
  onReviewCountChange,
  onStartReviewDue,
  onStartReviewNext,
  onStartReviewAll,
  onCreate,
  onEdit,
  onEditingChange,
  onSave,
  onCancelEdit,
  onDelete,
  onFocus,
  onGenerate,
  onCancelGeneration,
  onToggleReference
}) {
  return (
    <section className="space-y-6" id="question-list">
      <Card id="question-review">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="review-count">Review count</label>
            <Input id="review-count" type="number" min="1" value={reviewCount} onChange={(event) => onReviewCountChange(Number(event.target.value))} className="w-28" />
          </div>
          <Button type="button" onClick={onStartReviewDue} disabled={!canReview}>Review Due</Button>
          <Button type="button" onClick={onStartReviewNext} disabled={!canReview}>Review Next</Button>
          <Button type="button" variant="outline" onClick={onStartReviewAll} disabled={!canReview}>Review All</Button>
        </CardContent>
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Question Cards</h2>
          <p className="text-sm text-muted-foreground">{cards.length} cards in this scope.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={masteryFilter} onValueChange={onMasteryFilterChange}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Mastery" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All mastery</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
          {showEditControls ? (
            <Button type="button" onClick={onCreate} disabled={!canEdit}>
              <Plus className="size-4" /> Add Question Card
            </Button>
          ) : null}
          {showEditControls ? (
            <>
              <Button type="button" variant="outline" disabled={!canEdit || generating} onClick={onGenerate}>
                <RefreshCcw className="size-4" /> {generating ? "Generating..." : "Generate"}
              </Button>
              {generationStatus !== "idle" ? <Badge variant="secondary">{generationStatus}</Badge> : null}
              {generating ? (
                <Button type="button" variant="outline" onClick={onCancelGeneration} disabled={!canEdit}>
                  Cancel
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
      <ErrorAlert title="Question Card action failed" message={error} />
      <div className="grid gap-4">
        {cards.map((card) => {
          const isEditing = editingQuestionCardId === card.id;
          const masteryScore = getMasteryScore(card);
          const masteryTier = getMasteryTier(masteryScore);
          const displayType =
            card.type === "mcq" && (card.correct_option_indices || []).length > 1
              ? "multi"
              : card.type;
          return (
            <Card
              key={card.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!isEditing) {
                  onFocus(card.id);
                }
              }}
              onKeyDown={(event) => {
                if ((event.key === "Enter" || event.key === " ") && !isEditing) {
                  event.preventDefault();
                  onFocus(card.id);
                }
              }}
            >
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <CardTitle>{displayType?.toUpperCase?.() || "Question Card"}</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    {card.stale ? <Badge variant="destructive">Stale</Badge> : null}
                    <Badge variant="secondary">
                      Mastery: {masteryScore === null ? "—" : masteryScore.toFixed(1)}
                    </Badge>
                    <Badge variant="outline">{masteryTier}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <div className="space-y-3" onClick={(event) => event.stopPropagation()}>
                    <Select
                      value={editingQuestionCard.type}
                      onValueChange={(value) => onEditingChange({ ...editingQuestionCard, type: value })}
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
                      onChange={(event) => onEditingChange({ ...editingQuestionCard, prompt: event.target.value })}
                      rows={3}
                      aria-label="Question Card prompt"
                    />
                    <Textarea
                      value={editingQuestionCard.optionsText}
                      onChange={(event) => onEditingChange({ ...editingQuestionCard, optionsText: event.target.value })}
                      rows={4}
                      aria-label="Question Card options"
                    />
                    <Input
                      value={editingQuestionCard.correctIndicesText}
                      onChange={(event) => onEditingChange({ ...editingQuestionCard, correctIndicesText: event.target.value })}
                      aria-label="Correct option indices"
                    />
                    <div className="flex flex-wrap gap-3">
                      {studyCards.map((studyCard) => (
                        <label key={studyCard.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={editingQuestionCard.refs.includes(studyCard.id)}
                            onCheckedChange={() => onToggleReference(studyCard.id)}
                          />
                          {studyCard.title || studyCard.id.slice(0, 6)}
                        </label>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" onClick={() => onSave(card.id)}>Save</Button>
                      <Button type="button" variant="outline" onClick={onCancelEdit}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm">{card.prompt}</p>
                    <ul className="space-y-2 text-sm">
                      {(card.options || []).map((option, index) => (
                        <li
                          key={`${card.id}-${index}`}
                          className={
                            (card.correct_option_indices || []).includes(index)
                              ? "rounded-md border border-green-300 bg-green-50 p-2 text-green-950"
                              : "rounded-md border p-2"
                          }
                        >
                          {option}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground">Refs: {(card.study_card_refs || []).join(", ") || "None"}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={(event) => { event.stopPropagation(); onFocus(card.id); }}><Eye className="size-4" /> Details</Button>
                      {showEditControls ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={(event) => { event.stopPropagation(); onEdit(card); }}
                            disabled={!canEdit}
                          >
                            <Edit className="size-4" /> Edit
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={(event) => { event.stopPropagation(); onDelete(card.id); }}
                            disabled={!canEdit}
                          >
                            <Trash2 className="size-4" /> Delete
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
