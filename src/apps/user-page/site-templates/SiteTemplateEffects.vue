<script setup lang="ts">
import { computed } from 'vue'

import { useGoogleFonts } from '@/apps/user-page/googleFonts'

import { getSiteTemplate, type SiteTemplateId } from './registry'

const props = defineProps<{
  templateId: SiteTemplateId
}>()

const accentFonts = computed(() => getSiteTemplate(props.templateId).accentFonts ?? [])
useGoogleFonts(accentFonts)
</script>

<template>
  <!-- 内联 SVG 滤镜库：零网络请求提供液态玻璃折射与微颗粒质感 -->
  <svg
    aria-hidden="true"
    class="pointer-events-none fixed h-0 w-0 overflow-hidden opacity-0"
    focusable="false"
  >
    <defs>
      <filter
        id="vtsuru-liquid-refract"
        x="-10%"
        y="-10%"
        width="120%"
        height="120%"
        color-interpolation-filters="sRGB"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.012 0.018"
          numOctaves="2"
          seed="7"
          result="noise"
        />
        <feGaussianBlur
          in="noise"
          stdDeviation="1.4"
          result="softNoise"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="softNoise"
          scale="8"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>

      <filter id="vtsuru-paper-grain">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.78"
          numOctaves="3"
          stitchTiles="stitch"
        />
        <feColorMatrix
          type="saturate"
          values="0"
        />
      </filter>
    </defs>
  </svg>
</template>
