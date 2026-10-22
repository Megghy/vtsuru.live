<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { Empty } from '@/shared/ui/empty'

import BlockCard from '../BlockCard.vue'
import { PageSectionsKey } from '../sectionNavigation'

const props = defineProps<{ blockProps: unknown }>()
const values = computed<Record<string, unknown>>(() =>
  props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
    ? (props.blockProps as Record<string, unknown>)
    : {},
)
const layout = computed(() => (values.value.layout === 'vertical' ? 'vertical' : 'horizontal'))
const levels = computed(() =>
  Array.isArray(values.value.levels)
    ? new Set(values.value.levels.map(Number).filter((level) => [1, 2, 3].includes(level)))
    : new Set([2, 3]),
)
const showNumbers = computed(() => values.value.showNumbers === true)
const pageSections = inject(PageSectionsKey)
const sections = computed(() => (pageSections?.value ?? []).filter((section) => levels.value.has(section.level)))
const root = ref<HTMLElement>()
const activeId = ref('')
let observer: IntersectionObserver | undefined

function syncHash() {
  const id = decodeURIComponent(window.location.hash.slice(1))
  if (sections.value.some((section) => section.anchorId === id)) activeId.value = id
}

async function observeSections() {
  await nextTick()
  observer?.disconnect()
  const page = root.value?.closest('.page')
  const headings = page?.querySelectorAll<HTMLElement>('[data-user-page-section="true"]') ?? []
  observer = new IntersectionObserver(
    (entries) => {
      const current = entries
        .filter((entry) => entry.isIntersecting)
        .toSorted((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (current instanceof IntersectionObserverEntry) activeId.value = current.target.id
    },
    { rootMargin: '-10% 0px -75% 0px' },
  )
  headings.forEach((heading) => observer?.observe(heading))
  if (!activeId.value) activeId.value = sections.value[0]?.anchorId ?? ''
  syncHash()
}

function selectSection(anchorId: string) {
  activeId.value = anchorId
}

useEventListener(window, 'hashchange', syncHash)
onMounted(observeSections)
watch(sections, observeSections)
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <BlockCard
    :framed="values.framed !== false"
    :backgrounded="values.backgrounded !== false"
  >
    <nav
      ref="root"
      class="@container min-w-0"
      :class="
        layout === 'horizontal'
          ? 'flex flex-wrap gap-x-3.5 gap-y-1 @max-[420px]:grid @max-[420px]:grid-cols-2 @max-[420px]:gap-x-2.5 @max-[420px]:gap-y-0.5'
          : 'grid gap-0.5'
      "
      aria-label="页面目录"
    >
      <Empty
        v-if="!sections.length"
        description="当前页面没有匹配的标题"
        class="py-2 text-xs"
      />
      <a
        v-for="(section, index) in sections"
        v-else
        :key="section.blockId"
        :href="`#${section.anchorId}`"
        class="flex items-center min-w-0 py-1.5 px-0.5 text-[13px] leading-snug no-underline transition-colors"
        :class="
          layout === 'vertical'
            ? [
                'border-l-2 pl-[calc(8px+var(--section-indent))]',
                activeId === section.anchorId
                  ? 'border-primary text-primary bg-muted'
                  : 'border-border text-muted-foreground hover:border-primary hover:text-primary hover:bg-muted',
              ]
            : [
                'border-b-2',
                activeId === section.anchorId
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:border-primary hover:text-primary',
              ]
        "
        :style="{ '--section-indent': `${Math.max(0, section.level - 1) * 12}px` }"
        :aria-current="activeId === section.anchorId ? 'location' : undefined"
        @click="selectSection(section.anchorId)"
      >
        <span
          v-if="showNumbers"
          class="flex-none mr-1.25 text-muted-foreground tabular-nums"
          >{{ index + 1 }}.</span
        >
        <span class="truncate">{{ section.text }}</span>
      </a>
    </nav>
  </BlockCard>
</template>

