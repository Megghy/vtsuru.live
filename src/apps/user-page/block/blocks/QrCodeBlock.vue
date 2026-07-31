<script setup lang="ts">
import { DownloadOutline, OpenOutline } from '@vicons/ionicons5'
import { NButton, NFlex, NIcon } from 'naive-ui'
import QrcodeVue from 'qrcode.vue'
import { computed, ref } from 'vue'

import BlockCard from '../BlockCard.vue'
import { hasQrCodeCapacity } from '../qrcode'
import type { QrCodeLevel } from '../qrcode'

interface QrCodeConfig {
  content: string
  title: string
  size: number
  foreground: string
  background: string
  level: QrCodeLevel
  margin: number
  framed: boolean
  backgrounded: boolean
}

const props = defineProps<{ blockProps: unknown }>()
const qrRoot = ref<HTMLElement>()

const config = computed<QrCodeConfig>(() => {
  const value = props.blockProps as Partial<QrCodeConfig>
  return {
    content: value.content ?? '',
    title: value.title ?? '',
    size: value.size ?? 256,
    foreground: value.foreground ?? '#000000',
    background: value.background ?? '#ffffff',
    level: value.level ?? 'M',
    margin: value.margin ?? 8,
    framed: value.framed ?? true,
    backgrounded: value.backgrounded ?? true,
  }
})

const linkUrl = computed(() => {
  try {
    const url = new URL(config.value.content)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''
  } catch {
    return ''
  }
})
const canRender = computed(() => !!config.value.content && hasQrCodeCapacity(config.value.content, config.value.level))

function downloadPng() {
  const canvas = qrRoot.value?.querySelector('canvas')
  if (!canvas) return
  const link = document.createElement('a')
  link.href = canvas.toDataURL('image/png')
  link.download = `qrcode-${Math.floor(Date.now() / 1000)}.png`
  link.click()
}
</script>

<template>
  <BlockCard
    :framed="config.framed"
    :backgrounded="config.backgrounded"
    :content-style="{ padding: 'var(--vtsuru-page-spacing)' }"
  >
    <div class="qrcode-block">
      <h3
        v-if="config.title"
        class="qrcode-title"
      >
        {{ config.title }}
      </h3>
      <div
        ref="qrRoot"
        class="qrcode-canvas-wrap"
      >
        <QrcodeVue
          v-if="canRender"
          :value="config.content"
          :size="config.size"
          :foreground="config.foreground"
          :background="config.background"
          :level="config.level"
          :margin="config.margin"
          render-as="canvas"
          class="qrcode-canvas"
        />
        <span
          v-else
          class="qrcode-state"
        >
          {{ config.content ? '内容超出当前纠错等级容量' : '请填写二维码内容' }}
        </span>
      </div>
      <NFlex
        justify="center"
        :wrap="true"
        :size="8"
      >
        <NButton
          v-if="linkUrl"
          tag="a"
          :href="linkUrl"
          target="_blank"
          rel="noopener noreferrer"
          secondary
        >
          <template #icon>
            <NIcon><OpenOutline /></NIcon>
          </template>
          打开链接
        </NButton>
        <NButton
          secondary
          :disabled="!canRender"
          @click="downloadPng"
        >
          <template #icon>
            <NIcon><DownloadOutline /></NIcon>
          </template>
          下载 PNG
        </NButton>
      </NFlex>
    </div>
  </BlockCard>
</template>

<style scoped>
.qrcode-block {
  display: grid;
  justify-items: center;
  gap: 14px;
}

.qrcode-title {
  margin: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
  color: var(--vtsuru-fg);
  font-size: 18px;
  line-height: 1.4;
  letter-spacing: 0;
  text-align: center;
}

.qrcode-canvas-wrap {
  display: grid;
  place-items: center;
  max-width: 100%;
  overflow: hidden;
  border-radius: var(--vtsuru-page-radius);
}

.qrcode-state {
  display: grid;
  place-items: center;
  min-height: 128px;
  padding: 16px;
  color: var(--vtsuru-fg-muted);
  text-align: center;
}

.qrcode-canvas-wrap :deep(canvas) {
  display: block;
  max-width: 100%;
  height: auto !important;
}
</style>
