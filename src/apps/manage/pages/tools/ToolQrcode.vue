<script setup lang="ts">
import { saveAs } from 'file-saver'
import html2canvas from 'html2canvas'
import { showSuccessToast, showErrorToast } from '@/shared/services/toast'
import QrcodeVue from 'qrcode.vue'
import { computed, ref } from 'vue'

import { useAccount } from '@/api/account'
import { trackManageToolSuccess } from '@/shared/services/umami'
import { canvasToBlob } from '@/shared/utils'
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
    const canvas = await html2canvas(qrContainer.value, {
      backgroundColor: isTransparent.value ? null : background.value,
      scale: 2,
    })
    saveAs(await canvasToBlob(canvas), 'qrcode.png')
    trackManageToolSuccess('Qrcode', 'download', {
      size: size.value,
      transparent: isTransparent.value,
    })
    showSuccessToast('已下载')
  } catch {
    showErrorToast('导出失败')
  }
}
</script>

<template>
  <UCard>
    <template #header>二维码生成器</template>
    <div class="tool-qrcode">
      <UInput v-model="text" placeholder="输入链接或文本" />

      <div>
        <p class="field-label">链接预设</p>
        <div class="preset-list">
          <UButton
            v-for="p in linkPresets"
            :key="p.label"
            size="sm"
            variant="soft"
            @click="text = p.value"
          >
            {{ p.label }}
          </UButton>
        </div>
      </div>

      <div>
        <p class="field-label">配色预设</p>
        <div class="preset-list">
          <UButton
            v-for="s in stylePresets"
            :key="s.label"
            size="sm"
            color="neutral"
            variant="soft"
            @click="applyStyle(s)"
          >
            <template #leading>
              <span
                class="color-dot"
                :style="{ background: s.fg, boxShadow: `0 0 0 2px ${s.bg}` }"
              />
            </template>
            {{ s.label }}
          </UButton>
        </div>
      </div>

      <div class="control-list">
        <UFormField label="尺寸">
          <UInputNumber
            v-model="size"
            :min="128"
            :max="1024"
            :step="64"
            style="width: 100px"
          />
        </UFormField>
        <UFormField label="前景色" class="color-picker-wrap">
          <UColorPicker v-model="foreground" />
        </UFormField>
        <UFormField label="背景色" class="color-picker-wrap">
          <UColorPicker v-model="background" />
        </UFormField>
      </div>

      <div
        ref="qrContainer"
        class="qr-preview manage-checkerboard"
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
        <span v-else class="empty-text">请输入内容</span>
      </div>

      <UButton
        :disabled="!text"
        @click="download"
      >
        下载 PNG
      </UButton>
    </div>
  </UCard>
</template>

<style scoped>
.qr-preview {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px;
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
}
.color-picker-wrap {
  width: 200px;
}
.tool-qrcode,
.control-list,
.preset-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.tool-qrcode {
  flex-direction: column;
}
.preset-list {
  gap: 8px;
}
.field-label,
.empty-text {
  margin: 0 0 6px;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}
.color-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
</style>
