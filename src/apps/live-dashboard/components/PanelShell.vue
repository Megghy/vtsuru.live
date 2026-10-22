<script setup lang="ts">
defineProps<{ title: string; count?: number; unread?: number; blurred?: boolean }>()
defineSlots<{ actions?: () => unknown; default: () => unknown }>()
</script>

<template>
  <section
    class="flex flex-col h-full min-w-0 min-h-0 bg-background"
    :class="{ 'blur-[6px] grayscale-[0.6] opacity-50 pointer-events-none': blurred }"
  >
    <header class="flex items-center gap-1.5 h-[30px] px-2 shrink-0 text-xs text-muted-foreground border-b border-border">
      <span class="font-semibold text-foreground">{{ title }}</span>
      <span
        v-if="count !== undefined"
        class="tabular-nums"
        >{{ count }}</span
      >
      <span
        v-if="unread"
        class="px-1.5 rounded-full bg-[var(--brand-soft)] text-[var(--brand)] tabular-nums"
        title="未读"
        >{{ unread }}</span
      >
      <div class="ml-auto flex items-center gap-0.5">
        <slot name="actions" />
      </div>
    </header>
    <div class="flex-1 min-h-0">
      <slot />
    </div>
  </section>
</template>
