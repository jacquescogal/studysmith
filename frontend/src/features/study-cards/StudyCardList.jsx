import { Edit, Plus, Trash2 } from "lucide-react";

import { ErrorAlert } from "@/components/common/ErrorAlert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { renderMarkdownBlocks } from "@/lib/text-rendering";

export function StudyCardList({
  cards,
  canEdit,
  topicChips,
  editingStudyCardId,
  editingStudyCard,
  error,
  onCreate,
  onEdit,
  onEditingChange,
  onSave,
  onCancelEdit,
  onDelete,
  onToggleTopic
}) {
  return (
    <section className="space-y-4" id="study-list">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Study Cards</h2>
          <p className="text-sm text-muted-foreground">{cards.length} cards in this scope.</p>
        </div>
        {canEdit ? (
          <Button type="button" onClick={onCreate}>
            <Plus className="size-4" /> Add Study Card
          </Button>
        ) : null}
      </div>
      <ErrorAlert title="Study Card action failed" message={error} />
      <div className="grid gap-4">
        {cards.map((card) => {
          const isEditing = editingStudyCardId === card.id;
          return (
            <Card key={card.id}>
              <CardHeader>
                {isEditing ? (
                  <Input
                    value={editingStudyCard.title}
                    onChange={(event) => onEditingChange({ ...editingStudyCard, title: event.target.value })}
                    aria-label="Study Card title"
                  />
                ) : (
                  <CardTitle>{card.title || "Untitled Study Card"}</CardTitle>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <>
                    <Textarea
                      value={editingStudyCard.content}
                      onChange={(event) => onEditingChange({ ...editingStudyCard, content: event.target.value })}
                      rows={8}
                      aria-label="Study Card content"
                    />
                    <div className="flex flex-wrap gap-3">
                      {topicChips.map((topic) => (
                        <label key={topic.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={editingStudyCard.chipIds.includes(topic.id)}
                            onCheckedChange={(checked) => onToggleTopic(topic.id, checked)}
                          />
                          {topic.label}
                        </label>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" onClick={() => onSave(card.id)}>Save</Button>
                      <Button type="button" variant="outline" onClick={onCancelEdit}>Cancel</Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="prose prose-sm max-w-none text-sm dark:prose-invert">{renderMarkdownBlocks(card.content)}</div>
                    <div className="flex flex-wrap gap-2">
                      {(card.topic_chips || []).map((topic) => (
                        <Badge key={topic.id} variant="secondary" className="topic-chip">{topic.label}</Badge>
                      ))}
                    </div>
                    {canEdit ? (
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={() => onEdit(card)}>
                          <Edit className="size-4" /> Edit
                        </Button>
                        <Button type="button" variant="destructive" onClick={() => onDelete(card.id)}>
                          <Trash2 className="size-4" /> Delete
                        </Button>
                      </div>
                    ) : null}
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
