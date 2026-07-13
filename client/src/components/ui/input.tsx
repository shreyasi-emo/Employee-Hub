import * as React from "react"

import { cn } from "@/lib/utils"

// Native pickers (date/time/month/week) only open on the icon by default.
// For these types, open the picker on a click anywhere in the field.
const PICKER_TYPES = ["date", "time", "datetime-local", "month", "week"];

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onClick, ...props }, ref) => {
    // Global form-field style: 2.5rem tall, 16px radius, 80% opacity.
    return (
      <input
        type={type}
        onClick={(e) => {
          if (type && PICKER_TYPES.includes(type)) {
            try { (e.currentTarget as any).showPicker?.(); } catch { /* not user-activated / unsupported */ }
          }
          onClick?.(e);
        }}
        className={cn(
          "flex h-10 w-full rounded-[16px] opacity-80 border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          type && PICKER_TYPES.includes(type) ? "cursor-pointer" : "",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
