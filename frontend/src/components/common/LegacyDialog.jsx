import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export function LegacyDialog({ open, onOpenChange, title = "Dialog", wide = false, children }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          wide
            ? "border-0 bg-transparent p-0 shadow-none sm:max-w-5xl"
            : "border-0 bg-transparent p-0 shadow-none sm:max-w-2xl"
        }
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
