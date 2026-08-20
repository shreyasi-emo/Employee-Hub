import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Fragment } from "react";
import { Check } from "lucide-react";

// ======================== The request-form dialog shell ========================
// Every "raise a request" form uses this, so they stop each inventing their own layout.
// The four request forms previously had four different scaffolds: two sticky-footer flex
// columns with differing padding, and two plain dialogs with no scroll region at all.
//
// It gives three fixed regions:
//   header  — title, optional subtitle, optional step bar. Never scrolls.
//   body    — the form itself. Scrolls, and only this scrolls.
//   footer  — the action bar. Never scrolls, so Submit is always reachable.
//
//   <RequestDialog open={open} onClose={close} title="New Travel Request"
//     subtitle="Request travel for business purposes."
//     steps={["Choose type", "Details"]} step={step}
//     footer={<><Button …>Cancel</Button><Button …>Submit</Button></>}>
//     …form fields…
//   </RequestDialog>
//
// The footer lays out as [back slot] … [buttons]. Pass `back` for the left-hand control;
// without it the buttons still sit right, because the spacer is always rendered.

const WIDTH = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
  "2xl": "max-w-3xl",
} as const;

export function RequestDialog({
  open,
  onClose,
  title,
  subtitle,
  steps,
  step = 0,
  footer,
  back,
  size = "lg",
  minHeight,
  children,
  testId,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  /** Optional line under the title. */
  subtitle?: React.ReactNode;
  /** Step labels. Two or more renders the progress bar. Only the Purchase Request form uses
   *  this — the other request forms deliberately show no step bar, even when they have steps. */
  steps?: string[];
  /** Index of the current step, 0-based. */
  step?: number;
  /** Action buttons, right-aligned in the sticky footer. Omit for a form with no actions. */
  footer?: React.ReactNode;
  /** Left-hand footer control, typically a Back button. */
  back?: React.ReactNode;
  size?: keyof typeof WIDTH;
  /** Stops a short first step from collapsing the dialog, e.g. "540px". */
  minHeight?: string;
  children: React.ReactNode;
  testId?: string;
}) {
  const showSteps = Array.isArray(steps) && steps.length > 1;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={`${WIDTH[size]} max-h-[86vh] p-0 gap-0 overflow-hidden flex flex-col`}
        style={minHeight ? { minHeight } : undefined}
        data-testid={testId}
      >
        <DialogHeader className={`px-6 pt-6 ${showSteps || subtitle ? "pb-3" : "pb-5"} flex-shrink-0`}>
          <DialogTitle>{title}</DialogTitle>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </DialogHeader>

        {showSteps && (
          // Compact, centred: numbered circles with their labels beneath, joined by a rule
          // that fills in as you advance. A completed step shows a tick instead of its number.
          <div className="px-6 pb-5 pt-2 flex-shrink-0 border-b border-border">
            {/* (2n-1)*5rem keeps a two-step bar at the 15rem the purchase form has always used. */}
            <div className="mx-auto flex items-start gap-2" style={{ width: `${(steps.length * 2 - 1) * 5}rem` }}>
              {steps.map((label, i) => {
                const done = step > i;
                const reached = step >= i;
                return (
                  <Fragment key={label}>
                    {i > 0 && <div className={`h-0.5 flex-1 rounded mt-3.5 ${reached ? "bg-[#206295]" : "bg-muted"}`} />}
                    <div className="flex flex-col items-center gap-1.5 w-20 flex-shrink-0">
                      <span className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${reached ? "bg-[#206295] text-white" : "bg-muted text-muted-foreground"}`}>
                        {done ? <Check className="h-4 w-4" /> : i + 1}
                      </span>
                      <span className={`text-[11px] font-medium text-center leading-tight ${reached ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </div>
        )}

        {/* min-h-0 is load-bearing: without it this flex child refuses to shrink below its
            content, so long forms push the footer off-screen instead of scrolling. */}
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>

        {footer && (
          <div className="flex-shrink-0 border-t border-border bg-background px-6 py-5 flex items-center justify-between gap-3">
            {back ?? <span />}
            <div className="flex gap-2">{footer}</div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
