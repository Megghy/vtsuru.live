<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import BlockCard from '../BlockCard.vue'

const props = defineProps<{ blockProps: unknown; userInfo?: unknown; biliInfo?: unknown }>()

function asObject(v: unknown): Record<string, any> | null {
  if (!v || typeof v !== 'object') return null
  if (Array.isArray(v)) return null
  return v as any
}

function asCssSize(v: unknown): string {
  if (typeof v !== 'string') return ''
  const s = v.trim()
  if (!s.length) return ''
  if (!/^\d+(?:\.\d+)?(?:px|%)$/.test(s)) return ''
  return s
}

const model = computed(() => {
  const o = asObject(props.blockProps) ?? {}
  const file = asObject(o.imageFile)
  return {
    url: file && typeof file.path === 'string' && file.path ? file.path : '',
    alt: typeof o.alt === 'string' ? o.alt : '',
    maxWidth: asCssSize(o.maxWidth),
    maxHeight: asCssSize(o.maxHeight),
    shape: o.shape === 'square' || o.shape === 'rounded' || o.shape === 'circle' ? o.shape : 'rounded',
    framed: typeof o.framed === 'boolean' ? o.framed : true,
    backgrounded: typeof o.backgrounded === 'boolean' ? o.backgrounded : true,
  }
})

const wrapStyle = computed(() => {
  // 当用户设置了最大尺寸时，外层容器跟随图片尺寸收缩，避免出现“空边框”
  if (!model.value.maxWidth && !model.value.maxHeight) return undefined
  return {
    width: 'fit-content',
    maxWidth: model.value.maxWidth || '100%',
    margin: '0 auto',
  } as const
})

const imgStyle = computed(() => {
  const hasConstraint = !!model.value.maxWidth || !!model.value.maxHeight
  const radius =
    model.value.shape === 'circle' ? '9999px' : model.value.shape === 'square' ? '0px' : 'var(--vtsuru-page-radius)'
  return {
    width: hasConstraint ? 'auto' : '100%',
    height: 'auto',
    maxWidth: model.value.maxWidth || '100%',
    maxHeight: model.value.maxHeight || undefined,
    display: 'block',
    borderRadius: radius,
    objectFit: model.value.shape === 'circle' ? 'cover' : 'contain',
  } as const
})

const failed = ref(false)
const loaded = ref(false)
watch(
  () => model.value.url,
  () => {
    failed.value = false
    loaded.value = false
  },
)
</script>

<template>
  <BlockCard
    v-if="model.url"
    :framed="model.framed"
    :backgrounded="model.backgrounded"
    :content-style="{ padding: 0 }"
    :wrap-style="wrapStyle"
  >
    <div
      class="image-wrap"
      :class="{ loaded, failed }"
      :style="{ borderRadius: imgStyle.borderRadius }"
    >
      <span
        v-if="!loaded"
        class="image-state"
        role="status"
        >{{ failed ? '图片加载失败' : '图片加载中' }}</span
      >
      <img
        v-if="!failed"
        :src="model.url"
        :alt="model.alt"
        referrerpolicy="no-referrer"
        decoding="async"
        :style="imgStyle"
        @load="loaded = true"
        @error="failed = true"
      />
    </div>
  </BlockCard>
</template>

<style scoped>
.image-wrap {
  position: relative;
  display: grid;
  min-width: min(100%, 280px);
  min-height: 160px;
  overflow: hidden;
  background: var(--vtsuru-bg-muted);
}
.image-wrap img {
  position: relative;
  z-index: 1;
  opacity: 0;
  transition: opacity 180ms ease;
}
.image-wrap.loaded {
  min-height: 0;
}
.image-wrap.loaded img {
  opacity: 1;
}
.image-state {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  min-height: 160px;
  padding: 16px;
  color: var(--vtsuru-fg-muted);
  text-align: center;
}
@media (prefers-reduced-motion: reduce) {
  img {
    transition: none;
  }
}
</style>
