import { BookOpen, Layers, Plus, Repeat2, Search } from "lucide-react";

import { ErrorAlert } from "@/components/common/ErrorAlert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export function ContextSidebar({
  subjectTitle,
  moduleTitle,
  onEditSubject,
  onEditModule,
  scope,
  onScopeChange,
  noteGroupSearch,
  topicSearch,
  onNoteGroupSearchChange,
  onTopicSearchChange,
  noteGroups,
  topics,
  selectedNoteGroupId,
  selectedTopicId,
  canCreateNoteGroup = true,
  onSelectNoteGroup,
  onSelectTopic,
  onCreateNoteGroup,
  error
}) {
  const visibleItems = scope === "topics" ? topics : noteGroups;
  const searchValue = scope === "topics" ? topicSearch : noteGroupSearch;
  const onSearchChange = scope === "topics" ? onTopicSearchChange : onNoteGroupSearchChange;

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start gap-3">
            <BookOpen className="mt-1 size-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Subject</p>
              <p className="truncate text-sm font-medium">{subjectTitle || "Subject"}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={onEditSubject}
              aria-label="Switch subject"
            >
              <Repeat2 className="size-4" />
            </Button>
          </div>
          <div className="flex items-start gap-3">
            <Layers className="mt-1 size-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Module</p>
              <p className="truncate text-sm font-medium">{moduleTitle || "Module"}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={onEditModule}
              aria-label="Switch module"
            >
              <Repeat2 className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="flex min-h-0 flex-1 overflow-hidden">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Browse</CardTitle>
            {canCreateNoteGroup ? (
              <Button type="button" size="icon" variant="outline" onClick={onCreateNoteGroup} aria-label="Create note group">
                <Plus className="size-4" />
              </Button>
            ) : null}
          </div>
          <Tabs value={scope} onValueChange={onScopeChange}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="note-groups">Note Groups</TabsTrigger>
              <TabsTrigger value="topics">Topics</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={scope === "topics" ? "Search topics" : "Search note groups"}
              className="sidebar-search-input"
            />
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto border-t bg-muted/30 p-3">
          {visibleItems.length ? (
            visibleItems.map((item) => (
              <button
                key={item.value}
                type="button"
                className={cn(
                  "flex w-full items-start justify-between gap-3 rounded-md border bg-white p-3 text-left text-sm transition-colors hover:bg-accent",
                  (selectedNoteGroupId === item.value || selectedTopicId === item.value) && "border-primary bg-accent"
                )}
                onClick={() => (scope === "topics" ? onSelectTopic(item) : onSelectNoteGroup(item))}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{item.label}</span>
                  {item.description ? (
                    <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                  ) : null}
                </span>
                <span className="flex flex-col items-end gap-1">
                  {item.badge ? <Badge variant="secondary">{item.badge}</Badge> : null}
                  {item.statusLabel ? <Badge variant="outline">{item.statusLabel}</Badge> : null}
                </span>
              </button>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              {searchValue.trim()
                ? scope === "topics"
                  ? "No topics match."
                  : "No note groups match."
                : scope === "topics"
                  ? "No topics yet."
                  : "No note groups yet."}
            </p>
          )}
        </CardContent>
      </Card>
      <ErrorAlert title="Sidebar action failed" message={error} />
    </div>
  );
}
