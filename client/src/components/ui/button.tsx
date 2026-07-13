import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Global: 16px radius on all buttons; exact 4px icon↔label gap.
  // [&_svg]:m-0 neutralises any legacy per-icon margins (mr-*/ml-*) so the gap is
  // always exactly gap-1 (4px) — the descendant selector wins on specificity.
  "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-[16px] text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:m-0" +
  " hover-elevate active-elevate-2",
  {
    variants: {
      variant: {
        default:
          "btn-primary-gradient text-white",
        destructive:
          "bg-destructive text-destructive-foreground border border-destructive-border",
        // Secondary-level action buttons (e.g. "Apply Leave") use glassmorphism,
        // matching the `secondary` variant for a consistent visual hierarchy.
        // "Secondary Button A".
        outline: "btn-glass text-foreground",
        secondary: "btn-glass text-foreground",
        // "Secondary Button B" — outlined deep-blue glass; for in-form Add/Edit actions.
        secondaryB: "btn-secondary-b text-[#1A4B94]",
        // Add a transparent border so that when someone toggles a border on later, it doesn't shift layout/size.
        ghost: "border border-transparent",
      },
      // Global: all buttons are 2.5rem (h-10) tall. Heights are set as "min" heights so buttons
      // still expand to fit large amounts of content.
      size: {
        default: "min-h-10 px-4 py-2",
        sm: "min-h-10 px-3 text-xs",
        lg: "min-h-10 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
