<script setup lang="ts">
import { Button } from '@/shared/ui/button'

defineProps<{
  active: boolean
  title: string
  description?: string
  badge?: string
}>()
defineEmits<{ (e: 'click'): void }>()
</script>

<template>
  <Button
    variant="outline"
    class="h-auto min-h-14 w-full py-2.5 px-3 flex flex-col items-start gap-1 text-left font-normal border-[1.5px] hover:border-primary"
    :class="{ 'border-primary bg-primary/10 shadow-[inset_0_0_0_1.5px_var(--primary)]': active }"
    @click="$emit('click')"
  >
    <div class="flex-between gap-1.5">
      <span class="text-[13px] font-semibold leading-tight">{{ title }}</span>
      <span
        v-if="badge"
        class="text-[11px] py-px px-1.5 rounded bg-muted text-muted-foreground border border-border"
        >{{ badge }}</span
      >
    </div>
    <p
      v-if="description"
      class="text-[11px] text-muted-foreground m-0 leading-snug"
    >
      {{ description }}
    </p>
  </Button>
</template>
