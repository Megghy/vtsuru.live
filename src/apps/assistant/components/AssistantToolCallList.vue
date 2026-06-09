<script setup lang="ts">
import { computed, reactive } from 'vue'
import { NCollapseTransition, NIcon, NText } from 'naive-ui'
import {
  CheckmarkCircle16Regular,
  ChevronDown12Regular,
  ErrorCircle16Regular,
  Toolbox16Regular,
} from '@vicons/fluent'
import type { AssistantToolEvent } from '../api/assistant'

const props = defineProps<{ tools: AssistantToolEvent[] }>()
const expanded = reactive<Record<string, boolean>>({})

const visibleTools = computed(() => props.tools.filter(t => t.title || t.name))

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
  <div v-if="visibleTools.length" class="tool-trace">
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
          <NIcon :component="STATUS_META[tool.status].icon" size="15" />
        </span>
        <span class="tool-line__title">{{ tool.title || tool.name }}</span>
        <span class="tool-line__meta">
          {{ STATUS_META[tool.status].label }}
          <template v-if="formatDuration(tool.durationMs)">
            · {{ formatDuration(tool.durationMs) }}
          </template>
        </span>
        <NIcon
          :component="ChevronDown12Regular"
          size="12"
          class="tool-line__chevron"
          :class="{ 'is-open': isOpen(tool) }"
        />
      </button>

      <NCollapseTransition :show="isOpen(tool)">
        <div class="tool-line__body">
          <NText v-if="tool.error" type="error" class="tool-line__detail">
            {{ tool.error }}
          </NText>
          <NText v-else-if="tool.summary" depth="3" class="tool-line__detail">
            {{ tool.summary }}
          </NText>
          <NText v-else depth="3" class="tool-line__detail tool-line__detail--muted">
            {{ tool.name }}
          </NText>
        </div>
      </NCollapseTransition>
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
  background: var(--vtsuru-bg-muted, rgba(128, 128, 128, 0.055));
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
  color: var(--vtsuru-fg-muted, var(--n-text-color-3));
}

.tool-line--running .tool-line__state {
  color: var(--vtsuru-brand, #23ade5);
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
  color: var(--vtsuru-fg-muted, var(--n-text-color-3));
  font-size: 11px;
  white-space: nowrap;
}

.tool-line__chevron {
  color: var(--vtsuru-fg-muted, var(--n-text-color-3));
  transition: transform 0.2s;
}

.tool-line__chevron.is-open {
  transform: rotate(180deg);
}

.tool-line__body {
  padding: 0 7px 7px 31px;
}

.tool-line__detail {
  display: block;
  min-width: 0;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.tool-line__detail--muted {
  color: var(--vtsuru-fg-muted, var(--n-text-color-3));
}

@keyframes tool-pulse {
  0%, 100% { opacity: 0.52; }
  50% { opacity: 1; }
}
</style>
