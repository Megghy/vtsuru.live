<script setup lang="ts">
import { FlagOutline } from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'
import { computed } from 'vue'

import BlockCard from '../BlockCard.vue'

interface MilestoneItem {
  date?: string
  title?: string
  description?: string
}

interface BlockConfig {
  title?: string
  mode?: 'timeline' | 'list'
  items?: MilestoneItem[]
  framed?: boolean
  backgrounded?: boolean
}

const props = defineProps<{ blockProps: unknown; userInfo?: unknown; biliInfo?: unknown }>()

const cfg = computed<BlockConfig>(() => {
  const o =
    props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
      ? (props.blockProps as any)
      : {}
  return {
    title: typeof o.title === 'string' && o.title.trim() ? o.title.trim() : '里程碑',
    mode: o.mode === 'timeline' || o.mode === 'list' ? o.mode : 'timeline',
    items: Array.isArray(o.items) ? o.items : [],
    framed: typeof o.framed === 'boolean' ? o.framed : true,
    backgrounded: typeof o.backgrounded === 'boolean' ? o.backgrounded : true,
  }
})

const items = computed(() => {
  const list = cfg.value.items ?? []
  return list
    .map((it) => ({
      date: typeof it?.date === 'string' ? it.date.trim() : '',
      title: typeof it?.title === 'string' ? it.title.trim() : '',
      description: typeof it?.description === 'string' ? it.description.trim() : '',
    }))
    .filter((it) => it.date || it.title || it.description)
})
</script>

<template>
  <BlockCard
    class="milestone-card"
    :framed="cfg.framed"
    :backgrounded="cfg.backgrounded"
  >
    <template #header>
      <div class="header">
        <NIcon
          size="18"
          depth="2"
        >
          <FlagOutline />
        </NIcon>
        <span>{{ cfg.title }}</span>
      </div>
    </template>

    <div
      v-if="items.length === 0"
      class="empty"
    >
      暂无里程碑
    </div>

    <template v-else>
      <div
        v-if="cfg.mode !== 'list'"
        class="timeline"
      >
        <div
          v-for="(it, idx) in items"
          :key="idx"
          class="timeline-item"
        >
          <span
            class="timeline-marker"
            aria-hidden="true"
          />
          <div
            v-if="it.date"
            class="date"
          >
            {{ it.date }}
          </div>
          <div
            v-if="it.title"
            class="title"
          >
            {{ it.title }}
          </div>
          <div
            v-if="it.description"
            class="desc"
          >
            {{ it.description }}
          </div>
        </div>
      </div>

      <div
        v-else
        class="list"
      >
        <div
          v-for="(it, idx) in items"
          :key="idx"
          class="list-item"
        >
          <div class="meta">
            <span class="date">{{ it.date || '—' }}</span>
            <span
              v-if="it.title"
              class="title"
              >{{ it.title }}</span
            >
          </div>
          <div
            v-if="it.description"
            class="desc"
          >
            {{ it.description }}
          </div>
        </div>
      </div>
    </template>
  </BlockCard>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: var(--vtsuru-page-text, var(--vtsuru-fg));
}

.empty {
  color: var(--vtsuru-fg-muted);
}

.timeline {
  display: grid;
  gap: 0;
}

.timeline-item {
  position: relative;
  min-height: 48px;
  padding: 0 0 18px 24px;
}

.timeline-item:not(:last-child)::before {
  content: '';
  position: absolute;
  top: 12px;
  bottom: -2px;
  left: 5px;
  width: 1px;
  background: var(--vtsuru-border);
}

.timeline-marker {
  position: absolute;
  top: 5px;
  left: 0;
  width: 11px;
  height: 11px;
  border: 2px solid var(--vtsuru-page-primary, var(--vtsuru-brand));
  border-radius: 50%;
  background: var(--vtsuru-bg-elevated);
}

.list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.list-item {
  padding: 12px 14px;
  border: var(--vtsuru-page-border-width) var(--vtsuru-page-border-style) var(--vtsuru-border);
  border-radius: max(0px, calc(var(--vtsuru-page-radius) - 2px));
  background: var(--vtsuru-bg-muted);
}

.meta {
  display: flex;
  gap: 10px;
  align-items: baseline;
  flex-wrap: wrap;
}

.date {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
}

.title {
  font-weight: 700;
  font-size: 14px;
  color: var(--vtsuru-page-text, var(--vtsuru-fg));
}

.desc {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--vtsuru-fg-muted);
  white-space: pre-wrap;
}
</style>
