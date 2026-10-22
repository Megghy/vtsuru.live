import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"


export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] select-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border-0 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        brand: "bg-brand text-brand-foreground shadow-sm hover:opacity-90",
      },
      size: {
        "default": "h-control-default px-4 py-2",
        "sm": "h-control-sm rounded-md px-3 text-xs",
        "xs": "h-control-xs rounded px-2.5 text-xs",
        "lg": "h-control-lg rounded-md px-8",
        "icon": "size-control-default",
        "icon-sm": "size-control-sm",
        "icon-xs": "size-control-xs",
        "icon-lg": "size-control-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "sm",
    },
  },
)

export type ButtonVariants = VariantProps<typeof buttonVariants>
