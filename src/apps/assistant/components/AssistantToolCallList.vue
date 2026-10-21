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
    class="tool-trace"
  >
    <div
      v-for="tool in visibleTools"
      :key="tool.id"
      class="tool-line"
      :class="`tool-line--${tool.status}`"
    >
      <button
        type="button"
        class="tool-line__head"
        :aria-expanded="isOpen(tool)"
        @click="toggle(tool)"
      >
        <span class="tool-line__state">
          <component
            :is="STATUS_META[tool.status].icon"
            class="size-3.5"
          />
        </span>
        <span class="tool-line__title">{{ tool.title || tool.name }}</span>
        <span class="tool-line__meta">
          {{ STATUS_META[tool.status].label }}
          <template v-if="formatDuration(tool.durationMs)"> · {{ formatDuration(tool.durationMs) }} </template>
        </span>
        <component
          :is="ChevronDown12Regular"
          class="size-3 tool-line__chevron transition-transform duration-200"
          :class="{ 'rotate-180': isOpen(tool) }"
        />
      </button>

      <div
        v-if="isOpen(tool)"
        class="tool-line__body"
      >
        <p
          v-if="tool.error"
          class="tool-line__detail text-destructive text-xs"
        >
          {{ tool.error }}
        </p>
        <p
          v-else-if="tool.summary"
          class="tool-line__detail text-muted-foreground text-xs"
        >
          {{ tool.summary }}
        </p>
        <p
          v-else
          class="tool-line__detail tool-line__detail--muted text-muted-foreground/60 text-xs"
        >
          {{ tool.name }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tool-trace {
  display: grid;
  gap: 4px;
  margin: 1px 0 2px;
}

.tool-line {
  min-width: 0;
  border-radius: 7px;
  background: var(--muted, rgba(128, 128, 128, 0.055));
}

.tool-line__head {
  width: 100%;
  min-height: 30px;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto 14px;
  align-items: center;
  gap: 6px;
  padding: 5px 7px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.tool-line__head:hover {
  background: rgba(128, 128, 128, 0.07);
}

.tool-line__state {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--muted-foreground);
}

.tool-line--running .tool-line__state {
  color: var(--brand, #23ade5);
  animation: tool-pulse 1.2s ease-in-out infinite;
}

.tool-line--completed .tool-line__state {
  color: #18a058;
}

.tool-line--failed .tool-line__state {
  color: #d03050;
}

.tool-line__title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
}

.tool-line__meta {
  color: var(--muted-foreground);
  font-size: 11px;
  white-space: nowrap;
}

.tool-line__chevron {
  color: var(--muted-foreground);
}

.tool-line__body {
  padding: 0 7px 7px 31px;
}

.tool-line__detail {
  margin: 0;
  line-height: 1.5;
  word-break: break-all;
}

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
