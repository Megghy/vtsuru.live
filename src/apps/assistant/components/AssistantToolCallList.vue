<script setup lang="ts">
import { CheckmarkCircle16Regular, ChevronDown12Regular, ErrorCircle16Regular, Toolbox16Regular } from '@vicons/fluent'
import { computed, reactive } from 'vue'

import type { AssistantToolEvent } from '../api/assistant'

const props = defineProps<{ tools: AssistantToolEvent[] }>()
const expanded = reactive<Record<string, boolean>>({})

const visibleTools = computed(() => props.tools.filter((t) => t.title || t.name))

const STATUS_META = {
  running: { label: '执行中', icon: Toolbox16Regular },
  completed: { label: '完成', icon: CheckmarkCircle16Regular },
  failed: { label: '失败', icon: ErrorCircle16Regular },
} as const

function isOpen(tool: AssistantToolEvent): boolean {
  return expanded[tool.id] ?? tool.status === 'failed'
}

function toggle(tool: AssistantToolEvent) {
  expanded[tool.id] = !isOpen(tool)
}

function formatDuration(ms?: number): string {
  if (!ms) return ''
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}
</script>

<template>
  <div
    v-if="visibleTools.length"
    class="grid gap-1 my-px mb-0.5"
  >
    <div
      v-for="tool in visibleTools"
      :key="tool.id"
      class="min-w-0 rounded-[7px] bg-muted/60"
      :class="`tool-line--${tool.status}`"
    >
      <button
        type="button"
        class="w-full min-h-[30px] grid grid-cols-[18px_minmax(0,1fr)_auto_14px] items-center gap-1.5 py-[5px] px-[7px] border-0 rounded-[7px] bg-transparent text-inherit cursor-pointer text-left hover:bg-[rgba(128,128,128,0.07)]"
        :aria-expanded="isOpen(tool)"
        @click="toggle(tool)"
      >
        <span
          class="size-[18px] inline-flex-center text-muted-foreground"
          :class="{
            'text-brand animate-[tool-pulse_1.2s_ease-in-out_infinite]': tool.status === 'running',
            'text-emerald-600': tool.status === 'completed',
            'text-destructive': tool.status === 'failed',
          }"
        >
          <component
            :is="STATUS_META[tool.status].icon"
            class="size-3.5"
          />
        </span>
        <span class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold">{{
          tool.title || tool.name
        }}</span>
        <span class="text-muted-foreground text-[11px] whitespace-nowrap">
          {{ STATUS_META[tool.status].label }}
          <template v-if="formatDuration(tool.durationMs)"> · {{ formatDuration(tool.durationMs) }} </template>
        </span>
        <component
          :is="ChevronDown12Regular"
          class="size-3 text-muted-foreground transition-transform duration-200"
          :class="{ 'rotate-180': isOpen(tool) }"
        />
      </button>

      <div
        v-if="isOpen(tool)"
        class="pt-0 pr-[7px] pb-[7px] pl-[31px]"
      >
        <p
          v-if="tool.error"
          class="m-0 leading-normal break-all text-destructive text-xs"
        >
          {{ tool.error }}
        </p>
        <p
          v-else-if="tool.summary"
          class="m-0 leading-normal break-all text-muted-foreground text-xs"
        >
          {{ tool.summary }}
        </p>
        <p
          v-else
          class="m-0 leading-normal break-all text-muted-foreground/60 text-xs"
        >
          {{ tool.name }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes tool-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.9);
  }
}
</style>
