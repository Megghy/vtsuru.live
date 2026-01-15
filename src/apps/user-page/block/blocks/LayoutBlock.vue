<script setup lang="ts">
import type { UserInfo } from '@/api/api-models'
import type { BlockNode } from '../schema'
import { BLOCK_COMPONENTS } from '../registry'
import { computed } from 'vue'

const props = defineProps<{
  blockProps: unknown
  userInfo: UserInfo | undefined
  biliInfo: any | undefined
  highlightBlockId?: string | null
}>()

function asObject(v: unknown): Record<string, any> | null {
  if (!v || typeof v !== 'object') return null
  if (Array.isArray(v)) return null
  return v as any
}

function asBlocks(v: unknown): BlockNode[] {
  if (!Array.isArray(v)) return []
  return v.filter((it): it is BlockNode => {
    const o = asObject(it)
    return !!o && typeof o.id === 'string' && typeof o.type === 'string'
  }) as any
}

const propsObj = computed(() => asObject(props.blockProps) ?? {})
const layout = computed<'row' | 'column' | 'grid'>(() => {
  const v = propsObj.value.layout
  if (v === 'grid' || v === 'column' || v === 'row') return v
  return 'row'
})
const columns = computed(() => {
  const v = Number(propsObj.value.columns)
  if (!Number.isFinite(v) || !Number.isInteger(v)) return 2
  if (v < 1) return 1
  if (v > 12) return 12
  return v
})
const gap = computed(() => {
  const v = Number(propsObj.value.gap)
  if (!Number.isFinite(v)) return null
  if (v < 0) return 0
  if (v > 80) return 80
  return v
})
const wrap = computed(() => (typeof propsObj.value.wrap === 'boolean' ? propsObj.value.wrap : true))
const maxWidth = computed(() => {
  const v = propsObj.value.maxWidth
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (!s) return null
  if (!/^\d+(?:\.\d+)?(?:px|%)$/.test(s)) return null
  return s
})

function mapJustify(v: unknown) {
  switch (String(v)) {
    case 'center':
      return { flex: 'center', grid: 'center' }
    case 'end':
      return { flex: 'flex-end', grid: 'end' }
    case 'between':
      return { flex: 'space-between', grid: 'space-between' }
    case 'around':
      return { flex: 'space-around', grid: 'space-around' }
    case 'evenly':
      return { flex: 'space-evenly', grid: 'space-evenly' }
    default:
      return { flex: 'flex-start', grid: 'start' }
  }
}

function mapAlign(v: unknown) {
  switch (String(v)) {
    case 'center':
      return { flex: 'center', grid: 'center' }
    case 'end':
      return { flex: 'flex-end', grid: 'end' }
    case 'stretch':
      return { flex: 'stretch', grid: 'stretch' }
    default:
      return { flex: 'stretch', grid: 'stretch' }
  }
}

const justify = computed(() => mapJustify(propsObj.value.justify))
const align = computed(() => mapAlign(propsObj.value.align))
const alignKey = computed<'start' | 'center' | 'end' | 'stretch'>(() => {
  const v = String(propsObj.value.align)
  if (v === 'start' || v === 'center' || v === 'end' || v === 'stretch') return v
  return 'stretch'
})

const gridJustifyItems = computed<'start' | 'center' | 'end' | 'stretch'>(() => {
  switch (String(propsObj.value.justify)) {
    case 'center':
      return 'center'
    case 'end':
      return 'end'
    case 'start':
      return 'start'
    default:
      return 'stretch'
  }
})

const children = computed(() => asBlocks(propsObj.value.children))
const visibleChildren = computed(() => children.value.filter(it => !it.hidden))
const containerStyle = computed(() => ({
  '--vtsuru-layout-gap': gap.value === null ? 'var(--vtsuru-page-spacing)' : `${gap.value}px`,
  '--vtsuru-layout-columns': String(columns.value),
  maxWidth: maxWidth.value ?? undefined,
  margin: maxWidth.value ? '0 auto' : undefined,
  width: maxWidth.value ? '100%' : undefined,
  justifyContent: layout.value === 'grid' ? justify.value.grid : justify.value.flex,
  alignItems: layout.value === 'grid' ? align.value.grid : align.value.flex,
  alignContent: layout.value === 'grid'
    ? align.value.grid
    : (wrap.value && layout.value === 'row' ? align.value.flex : undefined),
  justifyItems: layout.value === 'grid' ? gridJustifyItems.value : undefined,
}))

const blockComponents = BLOCK_COMPONENTS
</script>

<template>
  <div
    class="layout"
    :class="{
      grid: layout === 'grid',
      row: layout === 'row',
      column: layout === 'column',
      wrap: wrap && layout === 'row',
      'align-stretch': layout === 'row' && alignKey === 'stretch',
    }"
    :style="containerStyle"
  >
    <div
      v-for="child in visibleChildren"
      :key="child.id"
      class="item"
      :class="{ highlight: !!props.highlightBlockId && props.highlightBlockId === child.id }"
      :data-block-id="child.id"
      :data-block-type="child.type"
    >
      <component
        :is="blockComponents[child.type]"
        :block-props="child.props"
        :user-info="userInfo"
        :bili-info="biliInfo"
        v-bind="child.type === 'layout' ? { highlightBlockId: props.highlightBlockId } : {}"
      />
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  gap: var(--vtsuru-layout-gap);
}

.layout.wrap {
  flex-wrap: wrap;
}

.layout.column {
  flex-direction: column;
}

.layout.row .item {
  flex: 0 1 240px;
  min-width: 0;
}

.layout.row.align-stretch .item {
  align-self: stretch;
  display: flex;
}

.layout.row.align-stretch .item > :deep(*) {
  flex: 1;
  min-width: 0;
}

.layout.column .item {
  flex: 0 0 auto;
  min-width: 0;
}

.layout.grid {
  display: grid;
  grid-template-columns: repeat(var(--vtsuru-layout-columns), minmax(0, 1fr));
}

@media (max-width: 520px) {
  .layout.grid {
    grid-template-columns: 1fr;
  }
}

.item {
  min-width: 0;
  position: relative;
}

.item.highlight {
  outline: 1px solid rgba(0, 0, 0, 0);
}

.item.highlight::before {
  content: "";
  position: absolute;
  inset: -2px;
  border-radius: calc(var(--vtsuru-page-radius) + 2px);
  border: 1px solid var(--vtsuru-page-primary);
  opacity: 0.55;
  pointer-events: none;
}

.item.highlight::after {
  content: attr(data-block-type);
  position: absolute;
  top: -10px;
  left: 10px;
  padding: 2px 8px;
  font-size: 11px;
  line-height: 16px;
  border-radius: 999px;
  background: var(--user-page-ui-surface-bg, rgba(0, 0, 0, 0.45));
  border: 1px solid var(--vtsuru-page-primary);
  color: var(--vtsuru-page-text, var(--n-text-color, #fff));
  pointer-events: none;
  user-select: none;
}
</style>
