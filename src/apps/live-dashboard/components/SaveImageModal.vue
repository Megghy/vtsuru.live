<script setup lang="ts">
import { snapdom } from '@zumer/snapdom'
import { saveAs } from 'file-saver'
import { NButton, NCheckbox, NModal, NRadioButton, NRadioGroup, NSlider } from 'naive-ui'
import { computed, ref } from 'vue'

import { useAccount } from '@/api/account'
import { usePersistedStorage } from '@/shared/storage/persist'

import { PAID_TYPES } from '../core/types'
import { useDashboardUi } from '../store/ui'
import DanmakuRow from './DanmakuRow.vue'
import PaidCard from './PaidCard.vue'

const ui = useDashboardUi()
const account = useAccount()
const target = ref<HTMLElement>()
const busy = ref(false)

const options = usePersistedStorage('vtsuru:settings:live-dashboard:image', {
  width: 480,
  showMedal: true,
  blurName: false,
  blurAvatar: false,
  ignoreRead: true,
  watermark: true,
  padding: true,
  background: 'transparent' as 'transparent' | 'white' | 'black',
})

const event = computed(() => ui.imageTarget)
const BACKGROUND = { transparent: null, white: '#ffffff', black: '#000000' } as const
const canCopy = typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write
const watermarkTime = computed(() =>
  event.value
    ? new Date(event.value.time).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '',
)

async function render() {
  return snapdom.toBlob(target.value!, {
    type: 'png',
    backgroundColor: BACKGROUND[options.value.background],
    dpr: 2,
  })
}

async function exec(action: (blob: Blob) => Promise<void> | void) {
  busy.value = true
  try {
    await action(await render())
  } catch (error) {
    console.error(error)
    window.$message.error('生成图片失败')
  } finally {
    busy.value = false
  }
}

const save = () =>
  exec((blob) => saveAs(blob, `vtsuru-dashboard-${event.value!.type}-${event.value!.uid || event.value!.ouid}-${event.value!.time}.png`))

const copy = () =>
  exec(async (blob) => {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    window.$message.success('已复制到剪贴板')
  })
</script>

<template>
  <NModal
    :show="!!event"
    preset="card"
    title="保存为图片"
    style="width: min(720px, 96vw)"
    @update:show="(v: boolean) => !v && (ui.imageTarget = null)"
  >
    <div
      v-if="event"
      class="image-dialog"
    >
      <div class="image-dialog__stage">
        <div
          ref="target"
          class="image-target"
          :class="{
            'image-target--pad': options.padding,
            'image-target--no-medal': !options.showMedal,
            'image-target--blur-name': options.blurName,
            'image-target--blur-avatar': options.blurAvatar,
          }"
          :style="{ width: `${options.width}px` }"
        >
          <PaidCard
            v-if="PAID_TYPES.has(event.type)"
            :event="event"
            :ignore-read="options.ignoreRead"
          />
          <DanmakuRow
            v-else
            :event="event"
            :ignore-read="options.ignoreRead"
          />
          <div
            v-if="options.watermark"
            class="image-target__mark"
          >
            <span>VTsuru</span>
            <span>{{ account.name || '' }}</span>
            <span>{{ watermarkTime }}</span>
          </div>
        </div>
      </div>
      <div class="image-dialog__options">
        <label>宽度 {{ options.width }}px</label>
        <NSlider
          v-model:value="options.width"
          :min="300"
          :max="600"
          :step="10"
        />
        <NCheckbox v-model:checked="options.showMedal">
          粉丝勋章
        </NCheckbox>
        <NCheckbox v-model:checked="options.blurName">
          模糊用户名
        </NCheckbox>
        <NCheckbox v-model:checked="options.blurAvatar">
          模糊头像
        </NCheckbox>
        <NCheckbox v-model:checked="options.ignoreRead">
          忽略已读状态
        </NCheckbox>
        <NCheckbox v-model:checked="options.watermark">
          水印
        </NCheckbox>
        <NCheckbox v-model:checked="options.padding">
          额外留白
        </NCheckbox>
        <NRadioGroup
          v-model:value="options.background"
          size="small"
        >
          <NRadioButton value="transparent">
            透明
          </NRadioButton>
          <NRadioButton value="white">
            白色
          </NRadioButton>
          <NRadioButton value="black">
            黑色
          </NRadioButton>
        </NRadioGroup>
      </div>
    </div>
    <template #action>
      <div class="image-dialog__buttons">
        <NButton
          v-if="canCopy"
          :loading="busy"
          @click="copy"
        >
          复制到剪贴板
        </NButton>
        <NButton
          type="primary"
          :loading="busy"
          @click="save"
        >
          保存图片
        </NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.image-dialog {
  display: grid;
  grid-template-columns: 1fr 180px;
  gap: 16px;
}

@media (max-width: 640px) {
  .image-dialog {
    grid-template-columns: 1fr;
  }
}

.image-dialog__stage {
  overflow: auto;
  padding: 12px;
  border-radius: 6px;
  background: repeating-conic-gradient(var(--vtsuru-bg-muted) 0% 25%, transparent 0% 50%) 50% / 16px 16px;
}

.image-target {
  box-sizing: border-box;
  margin: 0 auto;
}

.image-target--pad {
  padding: 16px;
}

.image-target--no-medal :deep(.medal) {
  display: none;
}

.image-target--blur-name :deep(.dm-name),
.image-target--blur-name :deep(.paid__name) {
  filter: blur(5px);
}

.image-target--blur-avatar :deep(.dm-avatar),
.image-target--blur-avatar :deep(.paid__avatar) {
  filter: blur(4px);
}

.image-target__mark {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 6px;
  padding: 0 6px;
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
}

.image-dialog__options {
  display: grid;
  gap: 8px;
  align-content: start;
  font-size: 13px;
}

.image-dialog__buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
