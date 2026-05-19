import { ErrorAlert } from "@/components/common/ErrorAlert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export function ReviewDialog({ open, card, summary, error, children, onOpenChange }) {
  if (children) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="border-0 bg-transparent p-0 shadow-none sm:max-w-none">
          <DialogTitle className="sr-only">{summary ? "Review summary" : card?.prompt || "Review"}</DialogTitle>
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl">
        <DialogHeader>
          <DialogTitle>{summary ? "Review summary" : card?.prompt || "Review"}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-4">
            {summary ? (
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Reviewed: {summary.answered} / {summary.total}</Badge>
                <Badge variant="secondary">Accuracy: {summary.accuracy}%</Badge>
              </div>
            ) : null}
            <ErrorAlert title="Review failed" message={error} />
            {children}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
