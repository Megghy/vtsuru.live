<script setup lang="ts">
import html2canvas from 'html2canvas'
import { NButton, NCard, NColorPicker, NFlex, NInput, NInputNumber, NText } from 'naive-ui'
import QrcodeVue from 'qrcode.vue'
import { computed, ref } from 'vue'
import { useAccount } from '@/api/account'

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

function applyStyle(preset: typeof stylePresets[number]) {
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
    canvas.toBlob((blob) => {
      if (!blob) { message.error('生成图片失败'); return }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'qrcode.png'
      a.click()
      URL.revokeObjectURL(url)
      message.success('已下载')
    }, 'image/png')
  } catch { message.error('导出失败') }
}
</script>

<template>
  <NCard title="二维码生成器">
    <NFlex vertical :size="16">
      <NInput v-model:value="text" placeholder="输入链接或文本" clearable />

      <div>
        <NText depth="3" style="font-size: 12px; margin-bottom: 6px; display: block">
          链接预设
        </NText>
        <NFlex :size="8">
          <NButton v-for="p in linkPresets" :key="p.label" size="small" secondary @click="text = p.value">
            {{ p.label }}
          </NButton>
        </NFlex>
      </div>

      <div>
        <NText depth="3" style="font-size: 12px; margin-bottom: 6px; display: block">
          配色预设
        </NText>
        <NFlex :size="8" wrap>
          <NButton v-for="s in stylePresets" :key="s.label" size="small" secondary @click="applyStyle(s)">
            <template #icon>
              <span class="color-dot" :style="{ background: s.fg, boxShadow: `0 0 0 2px ${s.bg}` }" />
            </template>
            {{ s.label }}
          </NButton>
        </NFlex>
      </div>

      <NFlex :size="16" align="center" wrap>
        <NFlex vertical :size="8">
          <NText depth="3">
            尺寸
          </NText>
          <NInputNumber v-model:value="size" :min="128" :max="1024" :step="64" style="width: 100px" />
        </NFlex>
        <NFlex vertical :size="8" class="color-picker-wrap">
          <NText depth="3">
            前景色
          </NText>
          <NColorPicker v-model:value="foreground" :show-alpha="false" />
        </NFlex>
        <NFlex vertical :size="8" class="color-picker-wrap">
          <NText depth="3">
            背景色
          </NText>
          <NColorPicker v-model:value="background" :show-alpha="true" />
        </NFlex>
      </NFlex>

      <div ref="qrContainer" class="qr-preview">
        <QrcodeVue
          v-if="text"
          :value="text"
          :size="size"
          level="M"
          :foreground="foreground"
          :background="isTransparent ? 'transparent' : background"
          render-as="canvas"
        />
        <NText v-else depth="3">
          请输入内容
        </NText>
      </div>

      <NButton type="primary" :disabled="!text" @click="download">
        下载 PNG
      </NButton>
    </NFlex>
  </NCard>
</template>

<style scoped>
.qr-preview {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background-image: linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
    linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
    linear-gradient(-45deg, transparent 75%, #f0f0f0 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
  background-color: #fafafa;
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
