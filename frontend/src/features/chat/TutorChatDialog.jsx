import { ErrorAlert } from "@/components/common/ErrorAlert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

export function TutorChatDialog({ open, title = "Tutor Chat", messages = [], input, loading, error, scopeLabel, onInputChange, onSend, onOpenChange, children }) {
  if (children) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="border-0 bg-transparent p-0 shadow-none sm:max-w-3xl">
          <DialogTitle className="sr-only">{title}</DialogTitle>
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {scopeLabel ? <Badge variant="outline">{scopeLabel}</Badge> : null}
        <ScrollArea className="h-96 pr-4">
          <div className="space-y-3">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className="rounded-md border p-3 text-sm">
                {message.content}
              </div>
            ))}
          </div>
        </ScrollArea>
        <ErrorAlert title="Chat failed" message={error} />
        <Textarea value={input} onChange={(event) => onInputChange(event.target.value)} rows={3} />
        <Button type="button" disabled={loading || !input?.trim()} onClick={onSend}>
          {loading ? "Sending..." : "Send"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
