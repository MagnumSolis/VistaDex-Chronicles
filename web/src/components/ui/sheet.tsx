// Detail sheet: slides over the page (bottom sheet on phones, side panel on wider screens).
// Built on the Radix dialog, so focus is trapped, Esc closes it and focus returns to the opener.
import { useEffect, useRef, type ReactNode } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";

export function Sheet({ open, onOpenChange, title, description, children, closeControl }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: ReactNode; description?: ReactNode; children: ReactNode; closeControl: string;
}) {
  // Opened from state (no Radix trigger), so remember the opener and give focus back to it on close.
  // Captured while rendering the opening, before the dialog moves focus inside itself.
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current) opener.current = document.activeElement as HTMLElement | null;
  useEffect(() => { wasOpen.current = open; }, [open]);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/50 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          onCloseAutoFocus={e => { e.preventDefault(); opener.current?.focus(); }}
          className="on-light fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-panel bg-background text-foreground outline-none
            data-open:animate-in data-open:slide-in-from-bottom-8 data-closed:animate-out data-closed:fade-out-0
            md:inset-x-auto md:inset-y-3 md:right-3 md:max-h-none md:w-[30rem] md:rounded-panel md:data-open:slide-in-from-right-8"
        >
          <div className="flex items-start justify-between gap-4 p-5 pb-3 md:p-7 md:pb-3">
            <div className="min-w-0">
              <DialogPrimitive.Title className="font-display text-[1.75rem] leading-tight">{title}</DialogPrimitive.Title>
              {description && <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">{description}</DialogPrimitive.Description>}
            </div>
            <DialogPrimitive.Close data-control={closeControl} className="inline-flex size-10 shrink-0 items-center justify-center rounded-control border border-foreground/70 hover:bg-accent">
              <XIcon aria-hidden className="size-5" /><span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>
          <div className="overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:px-7 md:pb-7">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
