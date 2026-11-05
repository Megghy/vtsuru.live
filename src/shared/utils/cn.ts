import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

const customTwMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      h: ['h-control-xs', 'h-control-sm', 'h-control-default', 'h-control-lg'],
      'min-h': ['min-h-control-xs', 'min-h-control-sm', 'min-h-control-default', 'min-h-control-lg'],
      size: ['size-control-xs', 'size-control-sm', 'size-control-default', 'size-control-lg'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return customTwMerge(clsx(inputs))
}

