<script setup lang="ts">
defineProps<{
  title: string
  badge?: string
}>()
</script>

<template>
  <div class="relative [counter-increment:doc-step] before:content-[counter(doc-step)] before:absolute before:-left-[31px] before:top-0.5 before:flex before:size-5 before:items-center before:justify-center before:rounded-full before:border before:border-brand/40 before:bg-card before:text-[11px] before:font-bold before:text-brand">
    <div class="flex flex-wrap items-center gap-2">
      <h4 class="my-0! text-sm font-semibold text-foreground">
        {{ title }}
      </h4>
      <span
        v-if="badge"
        class="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand"
      >
        {{ badge }}
      </span>
    </div>
    <div class="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground [&>p]:my-1.5 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
      <slot />
    </div>
  </div>
</template>
