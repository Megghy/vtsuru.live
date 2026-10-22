<script setup lang="ts">
import { computed } from 'vue'

import type { UserInfo } from '@/api/api-models'
import { Badge } from '@/shared/ui/badge'

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
      class="@container grid gap-2.5"
      :class="
        layout === 'grid'
          ? 'grid-cols-[repeat(var(--card-columns),minmax(0,1fr))] @max-[620px]:grid-cols-1'
          : ''
      "
      :style="{ '--card-columns': String(columns) }"
    >
      <article
        v-for="item in items"
        :key="item.id"
        class="min-w-0 overflow-hidden border border-border rounded-[var(--radius)] bg-muted"
        :class="
          layout === 'list'
            ? 'grid grid-cols-[minmax(140px,28%)_minmax(0,1fr)] @max-[620px]:grid-cols-1'
            : ''
        "
      >
        <img
          v-if="item.image"
          :src="item.image"
          :alt="item.title"
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer"
          class="block w-full bg-muted object-cover"
          :class="
            layout === 'list'
              ? 'h-full min-h-[150px] aspect-auto @max-[620px]:min-h-0 @max-[620px]:aspect-video'
              : 'aspect-video'
          "
        />
        <div class="grid gap-2.25 p-3">
          <h3
            v-if="item.title"
            class="m-0 text-[15px] leading-snug break-words"
          >
            {{ item.title }}
          </h3>
          <p
            v-if="item.body"
            class="m-0 text-muted-foreground text-[13px] leading-relaxed whitespace-pre-wrap break-words"
          >
            {{ item.body }}
          </p>
          <div
            v-if="item.tags.length"
            class="flex gap-1.5 flex-wrap"
          >
            <Badge
              v-for="tag in item.tags"
              :key="tag"
              variant="secondary"
              class="text-[10px] px-1.5 py-0.5"
            >
              {{ tag }}
            </Badge>
          </div>
          <div class="flex gap-1.5 flex-wrap">
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


