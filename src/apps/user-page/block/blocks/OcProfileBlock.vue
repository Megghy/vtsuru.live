<script setup lang="ts">
import { Check, Copy, ExternalLink, Palette, Sparkles } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { Badge } from '@/shared/ui/badge'
import { ImagePreview } from '@/shared/ui/image-preview'

import BlockCard from '../BlockCard.vue'

interface OcImageItem {
  label: string
  src: string
  fileId?: number
}

interface OcPaletteItem {
  name: string
  hex: string
}

interface OcSpecItem {
  label: string
  value: string
}

interface OcCreditItem {
  role: string
  name: string
  url: string
}

const props = defineProps<{ blockProps: unknown; userInfo?: unknown; biliInfo?: unknown }>()

const values = computed<Record<string, unknown>>(() =>
  props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
    ? (props.blockProps as Record<string, unknown>)
    : {},
)

const title = computed(() => (typeof values.value.title === 'string' && values.value.title.trim() ? values.value.title.trim() : 'OC 设定集'))
const characterName = computed(() => (typeof values.value.characterName === 'string' ? values.value.characterName.trim() : ''))
const subtitle = computed(() => (typeof values.value.subtitle === 'string' ? values.value.subtitle.trim() : ''))
const bio = computed(() => (typeof values.value.bio === 'string' ? values.value.bio.trim() : ''))

const images = computed<OcImageItem[]>(() => {
  if (!Array.isArray(values.value.images)) return []
  return values.value.images.flatMap((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
    const o = raw as Record<string, any>
    const file = o.imageFile && typeof o.imageFile === 'object' ? o.imageFile : null
    const src =
      typeof file?.path === 'string' && file.path
        ? file.path
        : typeof o.url === 'string' && /^https:\/\//i.test(o.url.trim())
          ? o.url.trim()
          : ''
    if (!src) return []
    return [{ label: typeof o.label === 'string' && o.label.trim() ? o.label.trim() : '立绘', src, fileId: typeof file?.id === 'number' ? file.id : undefined }]
  })
})

const palette = computed<OcPaletteItem[]>(() => {
  if (!Array.isArray(values.value.palette)) return []
  return values.value.palette.flatMap((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
    const o = raw as Record<string, any>
    const hex = typeof o.hex === 'string' ? o.hex.trim() : ''
    if (!/^#[\da-f]{6}$/i.test(hex)) return []
    return [{ name: typeof o.name === 'string' ? o.name.trim() : '', hex: hex.toUpperCase() }]
  })
})

const specs = computed<OcSpecItem[]>(() => {
  if (!Array.isArray(values.value.specs)) return []
  return values.value.specs.flatMap((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
    const o = raw as Record<string, any>
    const label = typeof o.label === 'string' ? o.label.trim() : ''
    const value = typeof o.value === 'string' ? o.value.trim() : ''
    return label || value ? [{ label, value }] : []
  })
})

const credits = computed<OcCreditItem[]>(() => {
  if (!Array.isArray(values.value.credits)) return []
  return values.value.credits.flatMap((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
    const o = raw as Record<string, any>
    const role = typeof o.role === 'string' ? o.role.trim() : ''
    const name = typeof o.name === 'string' ? o.name.trim() : ''
    const url = typeof o.url === 'string' && /^https:\/\//i.test(o.url.trim()) ? o.url.trim() : ''
    return role || name ? [{ role, name, url }] : []
  })
})

const activeImageIdx = ref(0)
const copiedHex = ref<string | null>(null)

watch(
  () => images.value.length,
  (len) => {
    if (activeImageIdx.value >= len) activeImageIdx.value = 0
  },
)

const activeImage = computed(() => images.value[activeImageIdx.value] ?? null)
const galleryUrls = computed(() => images.value.map((it) => it.src))

async function copyHex(hex: string) {
  try {
    await navigator.clipboard.writeText(hex)
    copiedHex.value = hex
    toast.success(`已复制色号 ${hex}`)
    window.setTimeout(() => {
      if (copiedHex.value === hex) copiedHex.value = null
    }, 1500)
  } catch {
    toast.error('复制失败')
  }
}
</script>

<template>
  <BlockCard
    :framed="values.framed !== false"
    :backgrounded="values.backgrounded !== false"
  >
    <template #header>
      <div class="flex-between w-full">
        <span class="flex items-center gap-1.5 font-semibold text-sm">
          <Sparkles class="size-4 text-primary" />
          {{ title }}
        </span>
        <Badge
          v-if="characterName"
          variant="secondary"
          size="xs"
        >
          {{ characterName }}
        </Badge>
      </div>
    </template>

    <div class="@container grid gap-4" :class="images.length > 0 ? 'grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] @max-[600px]:grid-cols-1' : 'grid-cols-1'">
      <!-- 左侧立绘 / 三视图切换 -->
      <div
        v-if="images.length > 0 && activeImage"
        class="min-w-0 space-y-2"
      >
        <div class="relative overflow-hidden rounded-[var(--radius)] border border-border bg-muted/40 aspect-[3/4] max-h-[420px] flex-center">
          <ImagePreview
            :src="activeImage.src"
            :file-id="activeImage.fileId"
            :is-public="true"
            fallback-transform="preview"
            :crop="false"
            :gallery="galleryUrls"
            :index="activeImageIdx"
            :alt="activeImage.label"
            wrapper-class="block size-full"
          >
            <template #default="{ open, thumbSrc, onError }">
              <img
                :src="thumbSrc || undefined"
                :alt="activeImage.label"
                referrerpolicy="no-referrer"
                decoding="async"
                class="size-full object-contain cursor-zoom-in"
                @error="onError"
                @click="open()"
              />
            </template>
          </ImagePreview>
        </div>

        <div
          v-if="images.length > 1"
          class="flex flex-wrap gap-1.5"
        >
          <button
            v-for="(img, idx) in images"
            :key="`${img.src}-${idx}`"
            type="button"
            class="px-2.5 py-1 rounded-md text-xs border transition-colors cursor-pointer"
            :class="
              activeImageIdx === idx
                ? 'border-primary bg-primary/12 text-foreground font-medium'
                : 'border-border bg-muted/40 text-muted-foreground hover:text-foreground'
            "
            @click="activeImageIdx = idx"
          >
            {{ img.label }}
          </button>
        </div>
      </div>

      <!-- 右侧设定信息、色卡与署名 -->
      <div class="min-w-0 space-y-3.5">
        <div v-if="characterName || subtitle || bio" class="space-y-1">
          <h3
            v-if="characterName"
            class="m-0 text-base font-bold leading-snug"
          >
            {{ characterName }}
          </h3>
          <p
            v-if="subtitle"
            class="m-0 text-xs text-muted-foreground"
          >
            {{ subtitle }}
          </p>
          <p
            v-if="bio"
            class="m-0 pt-1 text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap"
          >
            {{ bio }}
          </p>
        </div>

        <!-- 设定参数 -->
        <div
          v-if="specs.length > 0"
          class="grid grid-cols-2 gap-2"
        >
          <div
            v-for="(spec, idx) in specs"
            :key="idx"
            class="rounded-md border border-border bg-muted/35 px-2.5 py-1.5 min-w-0"
          >
            <div class="text-[11px] text-muted-foreground truncate">{{ spec.label }}</div>
            <div class="text-xs font-medium truncate">{{ spec.value }}</div>
          </div>
        </div>

        <!-- 色卡（点击复制 HEX） -->
        <div
          v-if="palette.length > 0"
          class="space-y-1.5"
        >
          <div class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Palette class="size-3.5" />
            <span>官方色卡（点击复制色号）</span>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="(swatch, idx) in palette"
              :key="`${swatch.hex}-${idx}`"
              type="button"
              class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-muted/40 hover:border-primary/60 transition-colors cursor-pointer text-xs"
              :title="`复制 ${swatch.hex}`"
              @click="copyHex(swatch.hex)"
            >
              <span
                class="size-3.5 rounded-sm border border-border shrink-0"
                :style="{ backgroundColor: swatch.hex }"
              />
              <span
                v-if="swatch.name"
                class="font-medium"
              >
                {{ swatch.name }}
              </span>
              <span class="font-mono text-[11px] text-muted-foreground">{{ swatch.hex }}</span>
              <component
                :is="copiedHex === swatch.hex ? Check : Copy"
                class="size-3 text-muted-foreground"
              />
            </button>
          </div>
        </div>

        <!-- 署名区 -->
        <div
          v-if="credits.length > 0"
          class="space-y-1.5 pt-2 border-t border-border"
        >
          <div class="text-xs font-medium text-muted-foreground">制作与署名</div>
          <div class="flex flex-wrap gap-1.5">
            <template
              v-for="(credit, idx) in credits"
              :key="idx"
            >
              <a
                v-if="credit.url"
                :href="credit.url"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border bg-muted/35 hover:border-primary text-xs text-foreground no-underline transition-colors"
              >
                <span class="text-muted-foreground">{{ credit.role }}</span>
                <span class="font-medium">{{ credit.name }}</span>
                <ExternalLink class="size-3 opacity-70" />
              </a>
              <span
                v-else
                class="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border bg-muted/35 text-xs"
              >
                <span class="text-muted-foreground">{{ credit.role }}</span>
                <span class="font-medium">{{ credit.name }}</span>
              </span>
            </template>
          </div>
        </div>
      </div>
    </div>
  </BlockCard>
</template>
