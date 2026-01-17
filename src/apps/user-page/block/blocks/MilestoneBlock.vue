<script setup lang="ts">
import { computed } from 'vue'
import { FlagOutline } from '@vicons/ionicons5'
import { NIcon, NText, NTimeline, NTimelineItem } from 'naive-ui'
import BlockCard from '../BlockCard.vue'

interface MilestoneItem {
  date?: string
  title?: string
  description?: string
}

interface BlockConfig {
  mode?: 'timeline' | 'list'
  items?: MilestoneItem[]
  framed?: boolean
  backgrounded?: boolean
}

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

const cfg = computed<BlockConfig>(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  return {
    mode: (o.mode === 'timeline' || o.mode === 'list') ? o.mode : 'timeline',
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
    .filter(it => it.date || it.title || it.description)
})
</script>

<template>
  <BlockCard class="milestone-card" :framed="cfg.framed" :backgrounded="cfg.backgrounded">
    <template #header>
      <div class="header">
        <NIcon size="18" depth="2">
          <FlagOutline />
        </NIcon>
        <span>里程碑</span>
      </div>
    </template>

    <NText v-if="items.length === 0" depth="3">
      暂无里程碑
    </NText>

    <template v-else>
      <NTimeline v-if="cfg.mode !== 'list'" class="timeline">
        <NTimelineItem
          v-for="(it, idx) in items"
          :key="idx"
          :time="it.date || undefined"
          :title="it.title || undefined"
        >
          <div v-if="it.description" class="desc">
            {{ it.description }}
          </div>
        </NTimelineItem>
      </NTimeline>

      <div v-else class="list">
        <div v-for="(it, idx) in items" :key="idx" class="list-item">
          <div class="meta">
            <span class="date">{{ it.date || '—' }}</span>
            <span v-if="it.title" class="title">{{ it.title }}</span>
          </div>
          <div v-if="it.description" class="desc">
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
}

.timeline :deep(.n-timeline-item__content) {
  color: var(--n-text-color-2);
}

.list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.list-item {
  padding: 12px 14px;
  border: 1px solid var(--n-divider-color);
  border-radius: calc(var(--vtsuru-page-radius) - 2px);
  background: var(--n-action-color);
}

.meta {
  display: flex;
  gap: 10px;
  align-items: baseline;
  flex-wrap: wrap;
}

.date {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.title {
  font-weight: 700;
  font-size: 14px;
}

.desc {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--n-text-color-2);
  white-space: pre-wrap;
}
</style>
