<script setup lang="ts">
import { NEmpty } from 'naive-ui'
import { useEventListener } from '@vueuse/core'
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { PageSectionsKey } from '../sectionNavigation'
import BlockCard from '../BlockCard.vue'

const props = defineProps<{ blockProps: unknown }>()
const values = computed<Record<string, unknown>>(() => props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps) ? props.blockProps as Record<string, unknown> : {})
const layout = computed(() => values.value.layout === 'vertical' ? 'vertical' : 'horizontal')
const levels = computed(() => Array.isArray(values.value.levels)
  ? new Set(values.value.levels.map(Number).filter(level => [1, 2, 3].includes(level)))
  : new Set([2, 3]))
const showNumbers = computed(() => values.value.showNumbers === true)
const pageSections = inject(PageSectionsKey)
const sections = computed(() => (pageSections?.value ?? []).filter(section => levels.value.has(section.level)))
const root = ref<HTMLElement>()
const activeId = ref('')
let observer: IntersectionObserver | undefined

function syncHash() {
  const id = decodeURIComponent(window.location.hash.slice(1))
  if (sections.value.some(section => section.anchorId === id)) activeId.value = id
}

async function observeSections() {
  await nextTick()
  observer?.disconnect()
  const page = root.value?.closest('.page')
  const headings = page?.querySelectorAll<HTMLElement>('[data-user-page-section="true"]') ?? []
  observer = new IntersectionObserver((entries) => {
    const current = entries
      .filter(entry => entry.isIntersecting)
      .toSorted((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
    if (current instanceof IntersectionObserverEntry) activeId.value = current.target.id
  }, { rootMargin: '-10% 0px -75% 0px' })
  headings.forEach(heading => observer?.observe(heading))
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
  <BlockCard :framed="values.framed !== false" :backgrounded="values.backgrounded !== false">
    <nav ref="root" class="section-nav" :class="`section-nav--${layout}`" aria-label="页面目录">
      <NEmpty v-if="!sections.length" size="small" description="当前页面没有匹配的标题" />
      <a
        v-for="(section, index) in sections"
        v-else
        :key="section.blockId"
        :href="`#${section.anchorId}`"
        class="section-link"
        :class="{ active: activeId === section.anchorId }"
        :style="{ '--section-indent': `${Math.max(0, section.level - 1) * 12}px` }"
        :aria-current="activeId === section.anchorId ? 'location' : undefined"
        @click="selectSection(section.anchorId)"
      >
        <span v-if="showNumbers" class="section-number">{{ index + 1 }}.</span>
        <span class="section-text">{{ section.text }}</span>
      </a>
    </nav>
  </BlockCard>
</template>

<style scoped>
.section-nav { container-type: inline-size; min-width: 0; }
.section-nav--horizontal { display: flex; flex-wrap: wrap; gap: 4px 14px; }
.section-nav--vertical { display: grid; gap: 2px; }
.section-link { display: flex; align-items: center; min-width: 0; padding: 6px 2px; border-bottom: 2px solid transparent; color: var(--vtsuru-fg-muted); font-size: 13px; line-height: 1.35; text-decoration: none; }
.section-link:hover, .section-link.active { color: var(--vtsuru-page-primary); border-bottom-color: var(--vtsuru-page-primary); }
.section-nav--vertical .section-link { padding-left: calc(8px + var(--section-indent)); border-bottom: 0; border-left: 2px solid var(--vtsuru-border); }
.section-nav--vertical .section-link:hover, .section-nav--vertical .section-link.active { border-left-color: var(--vtsuru-page-primary); background: var(--vtsuru-bg-muted); }
.section-number { flex: none; margin-right: 5px; color: var(--vtsuru-fg-muted); font-variant-numeric: tabular-nums; }
.section-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@container (max-width: 420px) { .section-nav--horizontal { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2px 10px; } }
</style>
