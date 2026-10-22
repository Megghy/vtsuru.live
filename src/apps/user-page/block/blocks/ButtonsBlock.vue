<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import BlockCard from '../BlockCard.vue'
import { buttonAppearanceClass, buttonAppearanceStyle, normalizeButtonAppearance } from '../buttonAppearance'
import { isBlockPropertyAvailable } from '../propertyCapabilities'

import '../buttonAppearance.css'

const props = defineProps<{ blockProps: unknown; userInfo?: unknown; biliInfo?: unknown }>()

const propsObj = computed<Record<string, any>>(() => {
  if (!props.blockProps || typeof props.blockProps !== 'object' || Array.isArray(props.blockProps)) return {}
  return props.blockProps as any
})

const items = computed(() => (Array.isArray(propsObj.value.items) ? propsObj.value.items : []))
const route = useRoute()
const router = useRouter()

function slugOk(slug: string) {
  return /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(slug)
}

function getUserName() {
  const name = (props.userInfo as any)?.name
  return typeof name === 'string' ? name : ''
}

function getInternalPath(slug: string) {
  const userName = getUserName()
  if (!userName) return null
  if (slug === 'home') return `/@${userName}`
  if (!slugOk(slug)) return null
  return `/@${userName}/${slug}`
}

function isHttpsUrlString(v: unknown): v is string {
  if (typeof v !== 'string') return false
  try {
    const u = new URL(v)
    return u.protocol === 'https:'
  } catch {
    return false
  }
}

type NormalizedButtonItem = {
  label: string
  kind: 'external' | 'page' | 'back'
  href?: string
  to?: string
}

const normalizedItems = computed<NormalizedButtonItem[]>(() => {
  const list = items.value
  return list.map((raw) => {
    const it = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as any) : {}
    const label = typeof it.label === 'string' ? it.label : ''
    if (it.back === true) return { label, kind: 'back' }
    const page = typeof it.page === 'string' ? it.page.trim() : ''
    if (page) {
      const to = getInternalPath(page)
      return { label, kind: 'page', to: to ?? route.fullPath }
    }
    const url = it.url
    return { label, kind: 'external', href: isHttpsUrlString(url) ? url : 'https://' }
  })
})

const direction = computed<'vertical' | 'horizontal'>(() =>
  propsObj.value.direction === 'horizontal' ? 'horizontal' : 'vertical',
)
const gap = computed(() => {
  const v = Number(propsObj.value.gap)
  if (!Number.isFinite(v)) return 10
  if (v < 0) return 0
  if (v > 32) return 32
  return v
})

const align = computed<'start' | 'center' | 'end'>(() => {
  if (!isBlockPropertyAvailable('buttons', propsObj.value, 'align')) return 'start'
  const v = propsObj.value.align
  if (v === 'center' || v === 'end' || v === 'start') return v
  return 'start'
})

const fullWidth = computed(() => {
  if (!isBlockPropertyAvailable('buttons', propsObj.value, 'fullWidth')) return false
  return propsObj.value.fullWidth === true
})

const framed = computed(() => propsObj.value.framed === true)
const backgrounded = computed(() => propsObj.value.backgrounded === true)

const borderTitle = computed(() => {
  if (!isBlockPropertyAvailable('buttons', propsObj.value, 'borderTitle')) return ''
  const v = propsObj.value.borderTitle
  return typeof v === 'string' ? v : ''
})
const borderTitleAlign = computed<'left' | 'center' | 'right'>(() => {
  if (!isBlockPropertyAvailable('buttons', propsObj.value, 'borderTitleAlign')) return 'left'
  const v = propsObj.value.borderTitleAlign
  if (v === 'center' || v === 'right' || v === 'left') return v
  return 'left'
})

const appearance = computed(() => normalizeButtonAppearance(propsObj.value))
const btnClass = computed(() => buttonAppearanceClass(appearance.value, fullWidth.value))
const btnStyle = computed(() => buttonAppearanceStyle(appearance.value))

const justifyClass = computed(() => {
  if (direction.value === 'horizontal') {
    if (align.value === 'center') return 'justify-center'
    if (align.value === 'end') return 'justify-end'
    return 'justify-start'
  }
  return 'justify-start'
})

const itemsClass = computed(() => {
  if (direction.value === 'vertical') {
    if (align.value === 'center') return 'items-center'
    if (align.value === 'end') return 'items-end'
    return 'items-start'
  }
  return 'items-start'
})
</script>

<template>
  <BlockCard
    :framed="framed"
    :backgrounded="backgrounded"
    :border-title="framed ? borderTitle : ''"
    :border-title-align="borderTitleAlign"
  >
    <div
      class="w-full max-w-full box-border p-1.5 flex"
      :class="[direction === 'vertical' ? 'flex-col' : 'flex-row flex-wrap', justifyClass, itemsClass]"
      :style="{ gap: `${gap}px` }"
    >
      <template
        v-for="(it, idx) in normalizedItems"
        :key="idx"
      >
        <a
          v-if="it.kind === 'external'"
          target="_blank"
          rel="noopener noreferrer"
          :href="it.href"
          class="inline-flex items-center justify-center font-medium cursor-pointer"
          :class="btnClass"
          :style="btnStyle"
        >
          {{ it.label }}
        </a>
        <button
          v-else
          type="button"
          class="inline-flex items-center justify-center font-medium cursor-pointer"
          :class="btnClass"
          :style="btnStyle"
          @click="it.kind === 'back' ? router.back() : router.push(it.to || route.fullPath)"
        >
          {{ it.label }}
        </button>
      </template>
    </div>
  </BlockCard>
</template>


