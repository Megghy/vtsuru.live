<script setup lang="ts">
import type { Component } from 'vue'

import { Button } from '@/shared/ui/button'
import { SimpleTooltip } from '@/shared/ui/tooltip'

defineProps<{ icon: Component; tip: string; active?: boolean }>()
defineEmits<{ click: [MouseEvent] }>()
</script>

<template>
  <SimpleTooltip :content="tip">
    <Button
      variant="ghost"
      size="icon-xs"
      :class="active ? 'text-primary' : 'text-muted-foreground'"
      :aria-label="tip"
      @click="$emit('click', $event)"
    >
      <component
        :is="icon"
        class="size-3.5"
      />
    </Button>
  </SimpleTooltip>
</template>
