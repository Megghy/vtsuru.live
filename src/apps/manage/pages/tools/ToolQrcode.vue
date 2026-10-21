<script setup lang="ts">
import './tool-page.css'
import { snapdom } from '@zumer/snapdom'
import { saveAs } from 'file-saver'
import QrcodeVue from 'qrcode.vue'
import { computed, ref } from 'vue'

import { useAccount } from '@/api/account'
import { trackManageToolSuccess } from '@/shared/services/umami'
import { useMessage } from '@/shared/utils'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { ColorPicker } from '@/shared/ui/color-picker'
import { Input } from '@/shared/ui/input'
import NInputNumber from '@/shared/ui/NInputNumber.vue'

const message = useMessage()
const account = useAccount()

const text = ref('')
const size = ref(256)
const foreground = ref('#000000')
const background = ref('#ffffff')
const qrContainer = ref<HTMLDivElement>()

const linkPresets = computed(() => {
  const uid = account.value?.biliId ?? ''
  const roomId = account.value?.biliRoomId ?? ''
  return [
    { label: '直播间', value: `https://live.bilibili.com/${roomId}` },
    { label: '个人空间', value: `https://space.bilibili.com/${uid}` },
    { label: '动态', value: `https://t.bilibili.com/${uid}` },
  ]
})

// Init with first preset
if (account.value?.biliRoomId) {
  text.value = `https://live.bilibili.com/${account.value.biliRoomId}`
} else {
  text.value = 'https://live.bilibili.com/'
}

const stylePresets = [
  { label: '经典黑白', fg: '#000000', bg: '#ffffffff' },
  { label: '透明底', fg: '#000000', bg: '#ffffff00' },
  { label: 'B站粉', fg: '#fb7299', bg: '#fff0f5ff' },
  { label: '深色', fg: '#ffffff', bg: '#1a1a2eff' },
  { label: '科技蓝', fg: '#0066ff', bg: '#f0f8ffff' },
  { label: '暗金', fg: '#d4a843', bg: '#1c1c1cff' },
]

function applyStyle(preset: (typeof stylePresets)[number]) {
  foreground.value = preset.fg
  background.value = preset.bg
}

const isTransparent = computed(() => background.value.endsWith('00') || background.value === 'transparent')

async function download() {
  if (!qrContainer.value) return
  try {
    const blob = await snapdom.toBlob(qrContainer.value, {
      backgroundColor: isTransparent.value ? null : background.value,
      scale: 2,
      dpr: 1,
      type: 'png',
    })
    saveAs(blob, 'qrcode.png')
    trackManageToolSuccess('Qrcode', 'download', {
      size: size.value,
      transparent: isTransparent.value,
    })
    message.success('已下载')
  } catch {
    message.error('导出失败')
  }
}
</script>

<template>
  <Card>
    <CardHeader class="pb-4">
      <CardTitle class="text-base font-semibold">二维码生成器</CardTitle>
    </CardHeader>
    <CardContent class="pt-0">
      <div class="flex flex-col gap-4">
        <Input
          v-model="text"
          placeholder="输入链接或文本"
        />

        <div>
          <span class="text-xs text-muted-foreground mb-1.5 block">
            链接预设
          </span>
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="p in linkPresets"
              :key="p.label"
              size="sm"
              variant="outline"
              class="h-7 text-xs px-2.5"
              @click="text = p.value"
            >
              {{ p.label }}
            </Button>
          </div>
        </div>

        <div>
          <span class="text-xs text-muted-foreground mb-1.5 block">
            配色预设
          </span>
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="s in stylePresets"
              :key="s.label"
              size="sm"
              variant="outline"
              class="h-7 text-xs px-2.5 inline-flex items-center gap-1.5"
              @click="applyStyle(s)"
            >
              <span
                class="color-dot"
                :style="{ background: s.fg, boxShadow: `0 0 0 2px ${s.bg}` }"
              />
              {{ s.label }}
            </Button>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-4">
          <div class="flex flex-col gap-2">
            <span class="text-xs text-muted-foreground"> 尺寸 </span>
            <NInputNumber
              v-model="size"
              :min="128"
              :max="1024"
              :step="64"
              class="w-[100px]"
            />
          </div>
          <div class="flex flex-col gap-2 color-picker-wrap">
            <span class="text-xs text-muted-foreground"> 前景色 </span>
            <ColorPicker
              v-model="foreground"
              :show-alpha="false"
            />
          </div>
          <div class="flex flex-col gap-2 color-picker-wrap">
            <span class="text-xs text-muted-foreground"> 背景色 </span>
            <ColorPicker
              v-model="background"
              :show-alpha="true"
            />
          </div>
        </div>

        <div
          ref="qrContainer"
          class="qr-preview tool-checkerboard"
        >
          <QrcodeVue
            v-if="text"
            :value="text"
            :size="size"
            level="M"
            :foreground="foreground"
            :background="isTransparent ? 'transparent' : background"
            render-as="canvas"
          />
          <span
            v-else
            class="text-xs text-muted-foreground"
          >
            请输入内容
          </span>
        </div>

        <div>
          <Button
            :disabled="!text"
            @click="download"
          >
            下载 PNG
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<style scoped>
.qr-preview {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.color-picker-wrap {
  width: 200px;
}
.color-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
</style>
