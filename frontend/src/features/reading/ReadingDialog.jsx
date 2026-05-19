import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ReadingDialog({ open, mode, title = "Reading", sections = [], children, onModeChange, onOpenChange, renderShell = true }) {
  if (!renderShell) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="border-0 bg-transparent p-0 shadow-none sm:max-w-5xl">
          <DialogTitle className="sr-only">{title}</DialogTitle>
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Tabs value={mode} onValueChange={onModeChange}>
          <TabsList>
            <TabsTrigger value="study">Study notes</TabsTrigger>
            <TabsTrigger value="clean">Clean text</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap gap-2">
          {sections.map((section) => (
            <Button key={section.id || section.title} type="button" variant="outline" size="sm" onClick={section.onClick}>
              {section.title}
            </Button>
          ))}
          {sections.length ? <Badge variant="secondary">{sections.length} sections</Badge> : null}
        </div>
        <ScrollArea className="max-h-[65vh] pr-4">{children}</ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
