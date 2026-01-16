<script setup lang="ts">
import { NButton, NFlex } from 'naive-ui'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BlockCard from '../BlockCard.vue'

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

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
  kind: 'external' | 'page'
  href?: string
  to?: string
}

const normalizedItems = computed<NormalizedButtonItem[]>(() => {
  const list = items.value
  return list.map((raw) => {
    const it = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw as any : {}
    const label = typeof it.label === 'string' ? it.label : ''
    const page = typeof it.page === 'string' ? it.page.trim() : ''
    if (page) {
      const to = getInternalPath(page)
      return { label, kind: 'page', to: to ?? route.fullPath }
    }
    const url = it.url
    return { label, kind: 'external', href: isHttpsUrlString(url) ? url : 'https://' }
  })
})

const direction = computed<'vertical' | 'horizontal'>(() => (propsObj.value.direction === 'horizontal' ? 'horizontal' : 'vertical'))
const gap = computed(() => {
  const v = Number(propsObj.value.gap)
  if (!Number.isFinite(v)) return 10
  if (v < 0) return 0
  if (v > 32) return 32
  return v
})

const buttonType = computed(() => {
  const v = propsObj.value.type
  if (v === 'primary' || v === 'info' || v === 'success' || v === 'warning' || v === 'error' || v === 'default') return v
  return 'primary'
})

const variant = computed<'solid' | 'secondary' | 'tertiary' | 'quaternary' | 'ghost'>(() => {
  const v = propsObj.value.variant
  if (v === 'secondary' || v === 'tertiary' || v === 'quaternary' || v === 'ghost' || v === 'solid') return v
  return 'solid'
})

const align = computed<'start' | 'center' | 'end'>(() => {
  const v = propsObj.value.align
  if (v === 'center' || v === 'end' || v === 'start') return v
  return 'start'
})

const fullWidth = computed(() => {
  const v = propsObj.value.fullWidth
  if (typeof v === 'boolean') return v
  return direction.value === 'vertical'
})

const framed = computed(() => {
  const v = propsObj.value.framed
  if (typeof v === 'boolean') return v
  return false
})

const borderTitle = computed(() => {
  const v = propsObj.value.borderTitle
  return typeof v === 'string' ? v : ''
})
const borderTitleAlign = computed<'left' | 'center' | 'right'>(() => {
  const v = propsObj.value.borderTitleAlign
  if (v === 'center' || v === 'right' || v === 'left') return v
  return 'left'
})

const flexJustify = computed<'start' | 'center' | 'end'>(() => (direction.value === 'horizontal' ? align.value : 'start'))
const flexAlign = computed<'start' | 'center' | 'end'>(() => (direction.value === 'vertical' ? align.value : 'start'))
</script>

<template>
  <BlockCard :framed="framed" :border-title="framed ? borderTitle : ''" :border-title-align="borderTitleAlign">
    <NFlex
      :vertical="direction === 'vertical'"
      :wrap="direction === 'horizontal'"
      :justify="flexJustify"
      :align="flexAlign"
      class="buttons-container"
      :style="{ gap: `${gap}px` }"
    >
      <template v-for="(it, idx) in normalizedItems" :key="idx">
        <NButton
          v-if="it.kind === 'external'"
          tag="a"
          :type="buttonType as any"
          :secondary="variant === 'secondary'"
          :tertiary="variant === 'tertiary'"
          :quaternary="variant === 'quaternary'"
          :ghost="variant === 'ghost'"
          target="_blank"
          rel="noopener noreferrer"
          :href="it.href"
          class="vtsuru-btn"
          :style="fullWidth ? 'width: 100%' : undefined"
        >
          {{ it.label }}
        </NButton>
        <NButton
          v-else
          :type="buttonType as any"
          :secondary="variant === 'secondary'"
          :tertiary="variant === 'tertiary'"
          :quaternary="variant === 'quaternary'"
          :ghost="variant === 'ghost'"
          class="vtsuru-btn"
          :style="fullWidth ? 'width: 100%' : undefined"
          @click="router.push(it.to || route.fullPath)"
        >
          {{ it.label }}
        </NButton>
      </template>
    </NFlex>
  </BlockCard>
</template>

<style scoped>
.buttons-container {
  width: 100%;
}

.vtsuru-btn {
  border-radius: var(--vtsuru-page-radius);
  font-weight: 600;
  transition: transform 0.1s ease;
}

.vtsuru-btn:active {
  transform: scale(0.98);
}
</style>
