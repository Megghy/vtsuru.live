<script setup lang="ts">
import { DownloadOutline, OpenOutline } from '@vicons/ionicons5'
import QrcodeVue from 'qrcode.vue'
import { computed, ref } from 'vue'

import { Button } from '@/shared/ui/button'

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
    <div class="grid justify-items-center gap-3.5">
      <h3
        v-if="config.title"
        class="m-0 max-w-full break-words text-foreground text-lg leading-snug text-center"
      >
        {{ config.title }}
      </h3>
      <div
        ref="qrRoot"
        class="grid place-items-center max-w-full overflow-hidden rounded-[var(--radius)] [&_canvas]:block [&_canvas]:max-w-full [&_canvas]:h-auto"
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
        />
        <span
          v-else
          class="grid place-items-center min-h-32 p-4 text-muted-foreground text-center"
        >
          {{ config.content ? '内容超出当前纠错等级容量' : '请填写二维码内容' }}
        </span>
      </div>
      <div class="flex justify-center flex-wrap gap-2">
        <Button
          v-if="linkUrl"
          as="a"
          :href="linkUrl"
          target="_blank"
          rel="noopener noreferrer"
          variant="outline"
          class="font-medium"
        >
          <component
            :is="OpenOutline"
            class="size-3.5 mr-1.5"
          />
          打开链接
        </Button>
        <Button
          variant="outline"
          class="font-medium"
          :disabled="!canRender"
          @click="downloadPng"
        >
          <component
            :is="DownloadOutline"
            class="size-3.5 mr-1.5"
          />
          下载 PNG
        </Button>
      </div>
    </div>
  </BlockCard>
</template>


