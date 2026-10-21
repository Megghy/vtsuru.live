import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"


export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border-[length:var(--ui-border-width,1px)] [border-style:var(--ui-border-style,solid)] border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        brand: "bg-brand text-brand-foreground shadow-sm hover:opacity-90",
      },
      size: {
        "default": "h-[var(--ui-height,2rem)] px-3 text-xs",
        "sm": "h-[var(--ui-height-sm,1.75rem)] rounded px-2.5 text-xs",
        "xs": "h-6 rounded px-2 text-[11px]",
        "lg": "h-[var(--ui-height-lg,2.25rem)] rounded-md px-4 text-sm",
        "icon": "h-8 w-8",
        "icon-sm": "size-7",
        "icon-xs": "size-6",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export type ButtonVariants = VariantProps<typeof buttonVariants>
