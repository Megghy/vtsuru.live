import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export const toggleGroupVariants = cva(
  'inline-flex items-center justify-center rounded-md border border-border bg-muted/40 p-0.5 text-muted-foreground select-none',
  {
    variants: {
      size: {
        default: 'h-control-default gap-1 p-1',
        sm: 'h-control-sm gap-0.5 p-0.5',
        xs: 'h-control-xs gap-0.5 p-0.5',
        lg: 'h-control-lg gap-1.5 p-1',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
)

export const toggleGroupItemVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2.5 py-1 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm cursor-pointer',
  {
    variants: {
      size: {
        default: 'h-full px-3 text-sm',
        sm: 'h-full px-2.5 text-xs',
        xs: 'h-full px-2 text-xs',
        lg: 'h-full px-4 text-sm',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
)

export type ToggleGroupVariants = VariantProps<typeof toggleGroupVariants>
export type ToggleGroupItemVariants = VariantProps<typeof toggleGroupItemVariants>
