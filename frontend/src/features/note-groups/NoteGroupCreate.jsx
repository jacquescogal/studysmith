import { AlertTriangle, CheckCircle2, RefreshCcw } from "lucide-react";

import { ErrorAlert } from "@/components/common/ErrorAlert";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function NoteGroupCreate({
  uniqueId,
  rawText,
  additionalInstructions,
  sourceChecking,
  sourceConfirmed,
  sourceDuplicateCount,
  sourceDuplicates,
  sourceCheckError,
  autoCreateError,
  autoCreateLoading,
  rawTextDisabled = false,
  createDisabled = false,
  additionalInstructionsMeta,
  onUniqueIdChange,
  onGenerateUniqueId,
  onCheckSource,
  onConfirmDuplicate,
  onRawTextChange,
  onAdditionalInstructionsChange,
  onCreate
}) {
  return (
    <div className="space-y-6">
      <Card id="step-source">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Unique ID</CardTitle>
              <CardDescription>Enter a Unique ID, or generate one automatically.</CardDescription>
            </div>
            {sourceConfirmed ? (
              <Badge variant="secondary">
                <CheckCircle2 className="size-3" /> Verified
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="note-group-unique-id">Unique ID</Label>
            <Input
              id="note-group-unique-id"
              value={uniqueId}
              onChange={(event) => onUniqueIdChange(event.target.value)}
              aria-invalid={Boolean(sourceCheckError)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onGenerateUniqueId}>
              <RefreshCcw className="size-4" /> Generate
            </Button>
            <Button type="button" variant="outline" disabled={sourceChecking} onClick={onCheckSource}>
              {sourceChecking ? "Checking..." : "Check Unique ID"}
            </Button>
          </div>
          <ErrorAlert title="Unique ID check failed" message={sourceCheckError} />
          {sourceDuplicateCount > 0 ? (
            <Alert className="border-amber-200 bg-amber-50 text-amber-950">
              <AlertTriangle className="size-4" />
              <AlertTitle>Possible duplicate Unique ID</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>{sourceDuplicateCount} existing Note Group records look related.</p>
                <ul className="list-disc pl-5">
                  {sourceDuplicates.map((item) => (
                    <li key={item.id}>{item.title || item.source || item.id}</li>
                  ))}
                </ul>
                <Button type="button" variant="outline" onClick={onConfirmDuplicate}>
                  Continue anyway
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card id="create-note-group">
        <CardHeader>
          <CardTitle>Create note group</CardTitle>
          <CardDescription>Paste Raw Text, then create the note group.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="note-group-raw-text">Raw Text</Label>
            <Textarea
              id="note-group-raw-text"
              value={rawText}
              disabled={rawTextDisabled || !sourceConfirmed}
              onChange={(event) => onRawTextChange(event.target.value)}
              rows={14}
            />
          </div>
          <details className="optional-parameters">
            <summary>Optional parameters</summary>
            <div className="mt-4 space-y-2">
              <Label htmlFor="note-group-instructions">Additional Generation Instructions</Label>
              <Textarea
                id="note-group-instructions"
                value={additionalInstructions}
                disabled={rawTextDisabled || !sourceConfirmed}
                onChange={(event) => onAdditionalInstructionsChange(event.target.value)}
                rows={4}
              />
              {additionalInstructionsMeta ? (
                <p className="text-sm text-muted-foreground">{additionalInstructionsMeta}</p>
              ) : null}
            </div>
          </details>
          <ErrorAlert title="Create note group failed" message={autoCreateError} />
          <Button type="button" disabled={!sourceConfirmed || autoCreateLoading || createDisabled} onClick={onCreate}>
            {autoCreateLoading ? "Creating..." : "Create note group"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
