import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

// ============================ Glass Back Button ============================
// The app-wide standard "back" control: a square (40×40) glassmorphic button with a
// left chevron. Used on detail / sub pages and inside detail side panels. Reuse this
// everywhere a "go back" affordance is needed so the look stays consistent.
//   <GlassBackButton onClick={() => navigate("/somewhere")} />
export function GlassBackButton({
  onClick,
  className = "",
  ariaLabel = "Back",
  "data-testid": testId = "glass-back-button",
}: {
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
  "data-testid"?: string;
}) {
  return (
    <Button
      variant="secondary"
      size="icon"
      className={`h-10 w-10 flex-shrink-0 ${className}`}
      onClick={onClick}
      aria-label={ariaLabel}
      data-testid={testId}
    >
      <ChevronLeft className="h-4 w-4" />
    </Button>
  );
}
