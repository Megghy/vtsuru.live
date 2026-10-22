<script setup lang="ts">
import WorkspaceSwitch from '@/apps/manage/components/layout/WorkspaceSwitch.vue'

defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <header
    class="flex items-end justify-between flex-wrap gap-4 min-h-11 py-0.5 pb-1.5 border-b border-border max-[640px]:flex-col max-[640px]:items-stretch max-[640px]:gap-3 max-[640px]:pb-2"
  >
    <div class="flex flex-col gap-1 min-w-0">
      <h1 class="m-0 text-xl font-bold leading-snug text-foreground tracking-tight">{{ title }}</h1>
      <p
        v-if="subtitle"
        class="m-0 text-[13px] text-muted-foreground leading-snug"
      >
        {{ subtitle }}
      </p>
    </div>

    <div class="flex items-center flex-wrap gap-2 ml-auto max-[640px]:ml-0 max-[640px]:justify-between">
      <WorkspaceSwitch />
      <slot name="actions" />
    </div>
  </header>
</template>
