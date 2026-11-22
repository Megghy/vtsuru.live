<script setup lang="ts">
import { Info } from 'lucide-vue-next'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'

withDefaults(
  defineProps<{
    text: string
    side?: 'top' | 'right' | 'bottom' | 'left'
    compact?: boolean
    as?: 'button' | 'span'
    ariaLabel?: string
  }>(),
  {
    side: 'top',
    compact: false,
    as: 'button',
    ariaLabel: '功能说明',
  },
)
</script>

<template>
  <Tooltip>
    <TooltipTrigger
      :as="as"
      :type="as === 'button' ? 'button' : undefined"
      class="inline-flex-center text-muted-foreground/80 hover:text-foreground cursor-help p-0 bg-transparent border-0 shrink-0 transition-colors"
      :aria-label="ariaLabel"
      @click.stop
    >
      <Info :class="compact ? 'size-3' : 'size-3.5'" />
    </TooltipTrigger>
    <TooltipContent :side="side" class="max-w-[280px] whitespace-pre-wrap leading-relaxed text-xs font-normal">
      {{ text }}
    </TooltipContent>
  </Tooltip>
</template>
