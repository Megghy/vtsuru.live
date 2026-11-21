<script setup lang="ts">
import { Briefcase, Check, Clock, Copy, ExternalLink, Sparkles } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { ImagePreview } from '@/shared/ui/image-preview'

import BlockCard from '../BlockCard.vue'

interface CommissionItem {
  name: string
  price: string
  description: string
  tags: string[]
  featured: boolean
  image: string
  fileId?: number
}

const props = defineProps<{ blockProps: unknown; userInfo?: unknown; biliInfo?: unknown }>()

const values = computed<Record<string, unknown>>(() =>
  props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
    ? (props.blockProps as Record<string, unknown>)
    : {},
)

const title = computed(() => (typeof values.value.title === 'string' && values.value.title.trim() ? values.value.title.trim() : '约稿 / 合作说明'))
const status = computed<'open' | 'waitlist' | 'closed'>(() => {
  const s = values.value.status
  return s === 'waitlist' || s === 'closed' ? s : 'open'
})
const statusText = computed(() => {
  if (typeof values.value.statusText === 'string' && values.value.statusText.trim()) return values.value.statusText.trim()
  if (status.value === 'waitlist') return '排单中'
  if (status.value === 'closed') return '暂已截稿'
  return '接稿中'
})
const statusVariant = computed(() => {
  if (status.value === 'open') return 'default' as const
  if (status.value === 'waitlist') return 'secondary' as const
  return 'outline' as const
})
const turnaround = computed(() => (typeof values.value.turnaround === 'string' ? values.value.turnaround.trim() : ''))
const notice = computed(() => (typeof values.value.notice === 'string' ? values.value.notice.trim() : ''))
const contactLabel = computed(() =>
  typeof values.value.contactLabel === 'string' && values.value.contactLabel.trim()
    ? values.value.contactLabel.trim()
    : '联系约稿',
)
const contactCopyText = computed(() => (typeof values.value.contactCopyText === 'string' ? values.value.contactCopyText.trim() : ''))
const contactUrl = computed(() => {
  const raw = typeof values.value.contactUrl === 'string' ? values.value.contactUrl.trim() : ''
  return /^https:\/\//i.test(raw) ? raw : ''
})

const items = computed<CommissionItem[]>(() => {
  if (!Array.isArray(values.value.items)) return []
  return values.value.items.flatMap((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
    const o = raw as Record<string, any>
    const file = o.imageFile && typeof o.imageFile === 'object' ? o.imageFile : null
    return [
      {
        name: typeof o.name === 'string' ? o.name.trim() : '',
        price: typeof o.price === 'string' ? o.price.trim() : '',
        description: typeof o.description === 'string' ? o.description.trim() : '',
        tags: Array.isArray(o.tags)
          ? o.tags.filter((t: unknown): t is string => typeof t === 'string' && t.trim().length > 0).slice(0, 6)
          : [],
        featured: o.featured === true,
        image: typeof file?.path === 'string' ? file.path : '',
        fileId: typeof file?.id === 'number' ? file.id : undefined,
      },
    ]
  })
})

const copied = ref(false)
async function handleCopyContact() {
  if (!contactCopyText.value) return
  try {
    await navigator.clipboard.writeText(contactCopyText.value)
    copied.value = true
    toast.success('已复制联系方式')
    window.setTimeout(() => {
      copied.value = false
    }, 1500)
  } catch {
    toast.error('复制失败，请手动复制')
  }
}
</script>

<template>
  <BlockCard
    :framed="values.framed !== false"
    :backgrounded="values.backgrounded !== false"
  >
    <template #header>
      <div class="flex-between gap-2 w-full flex-wrap">
        <span class="flex items-center gap-1.5 font-semibold text-sm">
          <Briefcase class="size-4 text-primary" />
          {{ title }}
        </span>
        <div class="flex items-center gap-2">
          <span
            v-if="turnaround"
            class="inline-flex items-center gap-1 text-xs text-muted-foreground"
          >
            <Clock class="size-3.5" />
            {{ turnaround }}
          </span>
          <Badge
            :variant="statusVariant"
            size="xs"
          >
            {{ statusText }}
          </Badge>
        </div>
      </div>
    </template>

    <div class="@container space-y-3">
      <p
        v-if="notice"
        class="m-0 rounded-md border border-border bg-muted/35 px-3 py-2 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap"
      >
        {{ notice }}
      </p>

      <div
        v-if="items.length > 0"
        class="grid grid-cols-2 @max-[560px]:grid-cols-1 gap-2.5"
      >
        <article
          v-for="(item, idx) in items"
          :key="idx"
          class="flex flex-col overflow-hidden rounded-[var(--radius)] border transition-colors min-w-0"
          :class="item.featured ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'"
        >
          <ImagePreview
            v-if="item.image"
            :src="item.image"
            :file-id="item.fileId"
            :is-public="true"
            fallback-transform="card"
            :alt="item.name || '例图'"
            wrapper-class="block w-full"
          >
            <template #default="{ open, thumbSrc, onError }">
              <img
                :src="thumbSrc || undefined"
                :alt="item.name || '例图'"
                referrerpolicy="no-referrer"
                decoding="async"
                class="block w-full aspect-video object-cover cursor-zoom-in bg-muted"
                @error="onError"
                @click="open()"
              />
            </template>
          </ImagePreview>
          <div class="p-3 flex-1 flex flex-col gap-1.5">
            <div class="flex-between gap-2 items-start">
              <div class="flex items-center gap-1.5 min-w-0">
                <Sparkles
                  v-if="item.featured"
                  class="size-3.5 text-primary shrink-0"
                />
                <strong class="text-sm font-semibold truncate">{{ item.name || '未命名档位' }}</strong>
              </div>
              <span
                v-if="item.price"
                class="text-sm font-bold text-primary shrink-0 tabular-nums"
              >
                {{ item.price }}
              </span>
            </div>
            <p
              v-if="item.description"
              class="m-0 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap"
            >
              {{ item.description }}
            </p>
            <div
              v-if="item.tags.length > 0"
              class="flex flex-wrap gap-1 pt-1 mt-auto"
            >
              <Badge
                v-for="tag in item.tags"
                :key="tag"
                variant="secondary"
                size="xs"
              >
                {{ tag }}
              </Badge>
            </div>
          </div>
        </article>
      </div>

      <div
        v-if="contactCopyText || contactUrl"
        class="flex flex-wrap items-center gap-2 pt-1"
      >
        <Button
          v-if="contactCopyText"
          variant="default"
          class="gap-1.5"
          @click="handleCopyContact"
        >
          <component
            :is="copied ? Check : Copy"
            class="size-3.5"
          />
          {{ contactLabel }}
        </Button>
        <Button
          v-if="contactUrl"
          as="a"
          :variant="contactCopyText ? 'outline' : 'default'"
          :href="contactUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="gap-1.5 no-underline"
        >
          <ExternalLink class="size-3.5" />
          {{ contactCopyText ? '前往约稿平台' : contactLabel }}
        </Button>
      </div>
    </div>
  </BlockCard>
</template>
