import { BookOpen, Edit, Plus, Trash2 } from "lucide-react";

import { ErrorAlert } from "@/components/common/ErrorAlert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SubjectIndex({
  subjects,
  error,
  canCreate = true,
  showCreate = canCreate,
  showEditControls = true,
  canEditSubject = () => true,
  canDeleteSubject = canEditSubject,
  onOpenWizard,
  onSelect,
  onEdit,
  onDelete
}) {
  return (
    <section className="space-y-8">
      <div className="rounded-lg border bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <Badge variant="secondary">Subject selection</Badge>
            <div className="space-y-2">
              <h2 className="text-3xl font-semibold tracking-normal">Subjects</h2>
              <p className="text-base text-muted-foreground">
                Choose a broad learning area before narrowing into modules and note groups.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="h-9 px-3">
              {subjects.length} subject{subjects.length === 1 ? "" : "s"}
            </Badge>
            {showCreate ? (
              <Button type="button" onClick={onOpenWizard} disabled={!canCreate}>
                <Plus className="size-4" /> Create new subject
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      <ErrorAlert title="Subject action failed" message={error} />
      {subjects.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white p-8 text-center">
          <p className="text-sm text-muted-foreground">No subjects yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {subjects.map((subject) => (
            <Card key={subject.id} className="overflow-hidden">
              <CardHeader className="min-h-40 justify-between bg-muted/30">
                <div className="flex items-start justify-between gap-4">
                  <div className="rounded-md border bg-background p-3">
                    <BookOpen className="size-5 text-muted-foreground" />
                  </div>
                  <Badge variant="outline">Subject</Badge>
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-xl">{subject.title}</CardTitle>
                  {subject.goal ? <CardDescription className="text-sm">{subject.goal}</CardDescription> : null}
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 p-4">
                <Button type="button" className="min-w-32" onClick={() => onSelect(subject)}>
                  Open
                </Button>
                {showEditControls ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${subject.title}`}
                      onClick={() => onEdit(subject)}
                      disabled={!canEditSubject(subject)}
                    >
                      <Edit className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${subject.title}`}
                      onClick={() => onDelete(subject)}
                      disabled={!canDeleteSubject(subject)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
