<script setup lang="ts">
import type { Component } from 'vue'
import { Button } from '@/shared/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

defineProps<{ icon: Component; tip: string; active?: boolean }>()
defineEmits<{ click: [MouseEvent] }>()
</script>

<template>
  <TooltipProvider :delay-duration="400">
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          class="h-6 w-6"
          :class="active ? 'text-primary' : 'text-muted-foreground'"
          :aria-label="tip"
          @click="$emit('click', $event)"
        >
          <component :is="icon" class="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {{ tip }}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
