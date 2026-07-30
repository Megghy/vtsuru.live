<script setup lang="ts">
import { NTag } from 'naive-ui'
import { computed } from 'vue'

import type { UserInfo } from '@/api/api-models'

import BlockCard from '../BlockCard.vue'
import CardListAction from './CardListAction.vue'

const props = defineProps<{
  blockProps: unknown
  userInfo?: UserInfo
}>()

const values = computed<Record<string, unknown>>(() =>
  props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
    ? (props.blockProps as Record<string, unknown>)
    : {},
)
const layout = computed(() => (values.value.layout === 'list' ? 'list' : 'grid'))
const columns = computed(() => {
  const value = Number(values.value.columns)
  return Number.isInteger(value) ? Math.min(4, Math.max(1, value)) : 3
})
const items = computed(() =>
  Array.isArray(values.value.items)
    ? values.value.items.flatMap((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return []
        const card = item as Record<string, any>
        const file =
          card.imageFile && typeof card.imageFile === 'object' && !Array.isArray(card.imageFile) ? card.imageFile : null
        return [
          {
            id: typeof card._id === 'string' ? card._id : `${card.title ?? ''}:${file?.id ?? ''}`,
            image: typeof file?.path === 'string' ? file.path : '',
            title: typeof card.title === 'string' ? card.title : '',
            body: typeof card.body === 'string' ? card.body : '',
            tags: Array.isArray(card.tags)
              ? card.tags
                  .filter((tag: unknown): tag is string => typeof tag === 'string' && tag.trim().length > 0)
                  .slice(0, 8)
              : [],
            primaryAction: card.primaryAction,
            secondaryAction: card.secondaryAction,
          },
        ]
      })
    : [],
)
</script>

<template>
  <BlockCard
    :framed="values.framed !== false"
    :backgrounded="values.backgrounded !== false"
  >
    <div
      class="cards"
      :class="`cards--${layout}`"
      :style="{ '--card-columns': String(columns) }"
    >
      <article
        v-for="item in items"
        :key="item.id"
        class="card-item"
      >
        <img
          v-if="item.image"
          :src="item.image"
          :alt="item.title"
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer"
          class="card-image"
        />
        <div class="card-content">
          <h3 v-if="item.title">
            {{ item.title }}
          </h3>
          <p v-if="item.body">
            {{ item.body }}
          </p>
          <div
            v-if="item.tags.length"
            class="card-tags"
          >
            <NTag
              v-for="tag in item.tags"
              :key="tag"
              size="small"
              :bordered="false"
            >
              {{ tag }}
            </NTag>
          </div>
          <div class="card-actions">
            <CardListAction
              :action="item.primaryAction"
              :user-name="props.userInfo?.name"
            />
            <CardListAction
              :action="item.secondaryAction"
              :user-name="props.userInfo?.name"
              secondary
            />
          </div>
        </div>
      </article>
    </div>
  </BlockCard>
</template>

<style scoped>
.cards {
  container-type: inline-size;
  display: grid;
  gap: 10px;
}
.cards--grid {
  grid-template-columns: repeat(var(--card-columns), minmax(0, 1fr));
}
.card-item {
  min-width: 0;
  overflow: hidden;
  border: var(--vtsuru-page-border-width) var(--vtsuru-page-border-style) var(--vtsuru-border);
  border-radius: var(--vtsuru-page-radius);
  background: var(--vtsuru-bg-muted);
}
.card-image {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  background: var(--vtsuru-bg-muted);
}
.card-content {
  display: grid;
  gap: 9px;
  padding: 12px;
}
.card-content h3,
.card-content p {
  margin: 0;
  overflow-wrap: anywhere;
}
.card-content h3 {
  font-size: 15px;
  line-height: 1.4;
}
.card-content p {
  color: var(--vtsuru-fg-muted);
  font-size: 13px;
  line-height: 1.55;
  white-space: pre-wrap;
}
.card-tags,
.card-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.cards--list .card-item {
  display: grid;
  grid-template-columns: minmax(140px, 28%) minmax(0, 1fr);
}
.cards--list .card-image {
  height: 100%;
  min-height: 150px;
  aspect-ratio: auto;
}

@container (max-width: 620px) {
  .cards--grid {
    grid-template-columns: 1fr;
  }
  .cards--list .card-item {
    grid-template-columns: 1fr;
  }
  .cards--list .card-image {
    min-height: 0;
    aspect-ratio: 16 / 9;
  }
}
</style>
