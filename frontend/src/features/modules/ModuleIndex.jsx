import { ArrowLeft, Layers, Plus, Trash2 } from "lucide-react";

import { ErrorAlert } from "@/components/common/ErrorAlert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ModuleIndex({
  modules,
  dueCounts,
  subjectDescription,
  error,
  onOpenWizard,
  onBack,
  onSelect,
  onDelete
}) {
  return (
    <section className="space-y-6">
      <div className="border-b pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Module selection</Badge>
              <Badge variant="outline">
                {modules.length} module{modules.length === 1 ? "" : "s"}
              </Badge>
            </div>
            <h2 className="text-2xl font-semibold tracking-normal">Modules</h2>
            <p className="text-sm text-muted-foreground">
              {subjectDescription ||
                "Choose a module to see its note groups, review cards, and chat with your notes."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onBack}>
              <ArrowLeft className="size-4" /> Subjects
            </Button>
            <Button type="button" onClick={onOpenWizard}>
              <Plus className="size-4" /> Create module
            </Button>
          </div>
        </div>
      </div>
      <ErrorAlert title="Module action failed" message={error} />
      {modules.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white p-8 text-center">
          <p className="text-sm text-muted-foreground">No modules yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white shadow-sm">
          {modules.map((module) => {
            const dueCount = dueCounts[module.id];
            const dueLabel = Number.isInteger(dueCount) ? dueCount : "...";
            return (
              <div
                key={module.id}
                className="grid gap-4 border-b p-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
              >
                <div className="flex min-w-0 items-start gap-4">
                  <div className="rounded-md border bg-muted/40 p-3">
                    <Layers className="size-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">{module.title}</h3>
                      <Badge variant={Number.isInteger(dueCount) && dueCount > 0 ? "default" : "outline"}>
                        Due now: {dueLabel}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {module.description || "No description yet."}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <Button type="button" onClick={() => onSelect(module)}>
                    Open module
                  </Button>
                  <Button type="button" variant="outline" size="icon" aria-label={`Delete ${module.title}`} onClick={() => onDelete(module)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
