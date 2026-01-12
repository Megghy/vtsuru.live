<script setup lang="ts">
import { NCard, NFlex, NText, NTimeline, NTimelineItem } from 'naive-ui'
import { computed } from 'vue'

interface MilestoneItem {
  date?: string
  title?: string
  description?: string
}

interface BlockConfig {
  mode?: 'timeline' | 'list'
  items?: MilestoneItem[]
}

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

const cfg = computed<BlockConfig>(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  return {
    mode: (o.mode === 'timeline' || o.mode === 'list') ? o.mode : 'timeline',
    items: Array.isArray(o.items) ? o.items : [],
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
  <NCard size="small">
    <template #header>
      里程碑
    </template>

    <NText v-if="items.length === 0" depth="3">
      暂无里程碑
    </NText>

    <NTimeline v-else-if="cfg.mode === 'timeline'">
      <NTimelineItem
        v-for="(it, idx) in items"
        :key="idx"
        :title="it.title || it.date || `#${idx + 1}`"
        :time="it.date || undefined"
      >
        <NText v-if="it.description" depth="2" style="white-space: pre-wrap">
          {{ it.description }}
        </NText>
      </NTimelineItem>
    </NTimeline>

    <NFlex v-else vertical style="gap: 10px">
      <div
        v-for="(it, idx) in items"
        :key="idx"
        style="padding: 10px 12px; border: 1px solid var(--n-border-color); border-radius: var(--vtsuru-page-radius);"
      >
        <NText strong style="display:block">
          {{ it.title || it.date || `#${idx + 1}` }}
        </NText>
        <NText v-if="it.date" depth="3" style="display:block; margin-top: 4px">
          {{ it.date }}
        </NText>
        <NText v-if="it.description" depth="2" style="display:block; margin-top: 6px; white-space: pre-wrap">
          {{ it.description }}
        </NText>
      </div>
    </NFlex>
  </NCard>
</template>

