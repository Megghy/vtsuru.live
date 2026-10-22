<script setup lang="ts">
import { FlagOutline } from '@vicons/ionicons5'
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
      <div class="flex items-center gap-2 font-bold text-foreground">
        <component
          :is="FlagOutline"
          class="size-4.5 text-muted-foreground"
        />
        <span>{{ cfg.title }}</span>
      </div>
    </template>

    <div
      v-if="items.length === 0"
      class="text-xs text-muted-foreground"
    >
      暂无里程碑
    </div>

    <template v-else>
      <div
        v-if="cfg.mode !== 'list'"
        class="grid"
      >
        <div
          v-for="(it, idx) in items"
          :key="idx"
          class="timeline-item relative min-h-12 pl-6 pb-[18px]"
        >
          <span
            class="absolute top-1.25 left-0 size-[11px] rounded-full border-2 border-primary bg-popover"
            aria-hidden="true"
          />
          <div
            v-if="it.date"
            class="text-xs text-muted-foreground"
          >
            {{ it.date }}
          </div>
          <div
            v-if="it.title"
            class="font-bold text-sm text-foreground"
          >
            {{ it.title }}
          </div>
          <div
            v-if="it.description"
            class="mt-1.5 text-[13px] leading-relaxed text-muted-foreground whitespace-pre-wrap"
          >
            {{ it.description }}
          </div>
        </div>
      </div>

      <div
        v-else
        class="flex flex-col gap-3"
      >
        <div
          v-for="(it, idx) in items"
          :key="idx"
          class="px-3.5 py-3 border border-border rounded-[calc(var(--radius)-2px)] bg-muted"
        >
          <div class="flex gap-2.5 items-baseline flex-wrap">
            <span class="text-xs text-muted-foreground">{{ it.date || '—' }}</span>
            <span
              v-if="it.title"
              class="font-bold text-sm text-foreground"
              >{{ it.title }}</span
            >
          </div>
          <div
            v-if="it.description"
            class="mt-1.5 text-[13px] leading-relaxed text-muted-foreground whitespace-pre-wrap"
          >
            {{ it.description }}
          </div>
        </div>
      </div>
    </template>
  </BlockCard>
</template>

<style scoped>
.timeline-item:not(:last-child)::before {
  content: '';
  position: absolute;
  top: 12px;
  bottom: -2px;
  left: 5px;
  width: 1px;
  background: var(--border);
}
</style>
