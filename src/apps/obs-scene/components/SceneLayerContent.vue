<script setup lang="ts">
import { computed } from 'vue'

import { resolveFontFamilyCss, useGoogleFont } from '@/apps/user-page/googleFonts'

import type { ObsSceneLayer } from '../types'
import { isSafeHttpUrl } from '../types'
import { buildMaskShapePath } from '../utils/maskShapes'
import SceneMarqueeLayer from './SceneMarqueeLayer.vue'
import SceneObsModuleLayer from './SceneObsModuleLayer.vue'
import SceneObsSourceLayer from './SceneObsSourceLayer.vue'
import SceneSlideshowLayer from './SceneSlideshowLayer.vue'
import SceneWidgetLayer from './SceneWidgetLayer.vue'

const props = defineProps<{
  layer: ObsSceneLayer
  ownerUserId?: number
  authToken?: string
  mode: 'edit' | 'preview' | 'live'
  sourcePreviews?: Record<string, string>
}>()

useGoogleFont(computed(() => (props.layer.type === 'text' ? props.layer.text.fontFamily : undefined)))

function getTextStyle(layer: Extract<ObsSceneLayer, { type: 'text' }>) {
  const t = layer.text
  return {
    fontFamily: resolveFontFamilyCss(t.fontFamily) || t.fontFamily,
    fontSize: `${t.fontSize}px`,
    fontWeight: t.fontWeight,
    color: t.color,
    textAlign: t.align,
    lineHeight: String(t.lineHeight),
    textShadow: layer.disableShadow ? 'none' : t.shadow || undefined,
    WebkitTextStroke: t.strokeWidth > 0 ? `${t.strokeWidth}px ${t.strokeColor}` : undefined,
    backgroundColor: t.backgroundColor || 'transparent',
    padding: `${t.padding}px`,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  }
}

function hasCustomShapeMask(layer: Extract<ObsSceneLayer, { type: 'shape' }>): boolean {
  return Boolean(layer.maskShape && layer.maskShape !== 'none')
}

function getShapeMaskPath(layer: Extract<ObsSceneLayer, { type: 'shape' }>): string {
  return buildMaskShapePath(layer.maskShape, layer.width, layer.height, layer.borderRadius ?? 0)
}

function getShapeStyle(layer: Extract<ObsSceneLayer, { type: 'shape' }>) {
  const s = layer.shape
  const customMask = hasCustomShapeMask(layer)
  return {
    backgroundColor: s.fill,
    border: !customMask && s.borderWidth > 0 ? `${s.borderWidth}px solid ${s.borderColor}` : undefined,
    backdropFilter: s.backdropBlur > 0 ? `blur(${s.backdropBlur}px)` : undefined,
    borderRadius: !customMask && layer.borderRadius ? `${layer.borderRadius}px` : undefined,
  }
}
</script>

<template>
  <SceneWidgetLayer
    v-if="layer.type === 'vtsuru-widget'"
    :layer="layer"
    :owner-user-id="ownerUserId"
    :mode="mode"
  />

  <SceneObsModuleLayer
    v-else-if="layer.type === 'obs-module'"
    :layer="layer"
    :owner-user-id="ownerUserId"
    :auth-token="authToken"
    :mode="mode"
  />

  <SceneObsSourceLayer
    v-else-if="layer.type === 'obs-source'"
    :layer="layer"
    :mode="mode"
    :source-previews="sourcePreviews"
  />

  <SceneMarqueeLayer
    v-else-if="layer.type === 'marquee'"
    :layer="layer"
    :mode="mode"
  />

  <SceneSlideshowLayer
    v-else-if="layer.type === 'slideshow'"
    :layer="layer"
    :mode="mode"
  />

  <img
    v-else-if="layer.type === 'image' && layer.image.url"
    :src="layer.image.url"
    :alt="layer.name"
    draggable="false"
    class="w-full h-full block"
    :style="{ objectFit: layer.image.objectFit }"
  />
  <div
    v-else-if="layer.type === 'image'"
    class="w-full h-full flex-center bg-muted/40 border border-dashed border-border text-muted-foreground text-base"
  >
    请在右侧上传或填写图片地址
  </div>

  <video
    v-else-if="layer.type === 'video' && layer.video.url"
    :src="layer.video.url"
    autoplay
    playsinline
    :loop="layer.video.loop"
    :muted="layer.video.muted"
    class="w-full h-full block"
    :style="{ objectFit: layer.video.objectFit }"
  />
  <div
    v-else-if="layer.type === 'video'"
    class="w-full h-full flex-center bg-muted/40 border border-dashed border-border text-muted-foreground text-base"
  >
    请在右侧填写视频地址
  </div>

  <div
    v-else-if="layer.type === 'text'"
    class="w-full h-full flex items-center"
    :class="{
      'justify-start': layer.text.align === 'left',
      'justify-center': layer.text.align === 'center',
      'justify-end': layer.text.align === 'right',
    }"
    :style="getTextStyle(layer)"
  >
    <span class="w-full">{{ layer.text.content }}</span>
  </div>

  <div v-else-if="layer.type === 'shape'" class="relative w-full h-full" :style="getShapeStyle(layer)">
    <svg
      v-if="hasCustomShapeMask(layer) && layer.shape.borderWidth > 0"
      class="pointer-events-none absolute inset-0 w-full h-full"
      :viewBox="`0 0 ${Math.max(1, layer.width)} ${Math.max(1, layer.height)}`"
      preserveAspectRatio="none"
    >
      <!-- 外层 clip-path 裁掉外半边描边，使 2×borderWidth 精准呈现等宽内边框 -->
      <path
        :d="getShapeMaskPath(layer)"
        fill="none"
        :stroke="layer.shape.borderColor"
        :stroke-width="layer.shape.borderWidth * 2"
        stroke-linejoin="round"
      />
    </svg>
  </div>

  <iframe
    v-else-if="layer.type === 'iframe' && layer.iframe.url && isSafeHttpUrl(layer.iframe.url)"
    :src="layer.iframe.url"
    sandbox="allow-scripts allow-same-origin"
    referrerpolicy="no-referrer"
    class="w-full h-full border-0 bg-transparent"
  />
  <div
    v-else-if="layer.type === 'iframe'"
    class="w-full h-full flex-center bg-muted/40 border border-dashed border-border text-muted-foreground text-base"
  >
    请填写有效的 http(s) 网页地址
  </div>
</template>
