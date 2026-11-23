<script setup lang="ts">
import { snapdom } from '@zumer/snapdom'
import { saveAs } from 'file-saver'
import { computed, ref } from 'vue'

import { useAccount } from '@/api/account'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { FormField } from '@/shared/ui/form-field'
import { SettingRow } from '@/shared/ui/setting-row'
import { Slider } from '@/shared/ui/slider'
import { Switch } from '@/shared/ui/switch'
import { useMessage } from '@/shared/utils'

const message = useMessage()

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
    ? new Date(event.value.time).toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
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
  exec((blob) =>
    saveAs(
      blob,
      `vtsuru-dashboard-${event.value!.type}-${event.value!.uid || event.value!.ouid}-${event.value!.time}.png`,
    ),
  )

const copy = () =>
  exec(async (blob) => {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    message.success('已复制到剪贴板')
  })
</script>

<template>
  <Dialog
    :open="!!event"
    @update:open="(v: boolean) => !v && (ui.imageTarget = null)"
  >
    <DialogContent class="max-w-[min(720px,96vw)]">
      <DialogHeader>
        <DialogTitle>保存为图片</DialogTitle>
      </DialogHeader>
      <div
        v-if="event"
        class="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-4"
      >
        <div class="image-dialog__stage overflow-auto p-3 rounded-md">
          <div
            ref="target"
            class="image-target box-border mx-auto"
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
              class="flex gap-2 justify-end mt-1.5 px-1.5 text-[11px] text-muted-foreground"
            >
              <span>VTsuru</span>
              <span>{{ account.name || '' }}</span>
              <span>{{ watermarkTime }}</span>
            </div>
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <FormField
            label="宽度"
            :extra="`${options.width}px`"
          >
            <Slider
              :model-value="[options.width]"
              :min="300"
              :max="600"
              :step="10"
              @update:model-value="(val) => val && (options.width = val[0])"
            />
          </FormField>
          <SettingRow
            variant="none"
            title="粉丝勋章"
          >
            <Switch v-model="options.showMedal" />
          </SettingRow>
          <SettingRow
            variant="none"
            title="模糊用户名"
          >
            <Switch v-model="options.blurName" />
          </SettingRow>
          <SettingRow
            variant="none"
            title="模糊头像"
          >
            <Switch v-model="options.blurAvatar" />
          </SettingRow>
          <SettingRow
            variant="none"
            title="忽略已读状态"
          >
            <Switch v-model="options.ignoreRead" />
          </SettingRow>
          <SettingRow
            variant="none"
            title="水印"
          >
            <Switch v-model="options.watermark" />
          </SettingRow>
          <SettingRow
            variant="none"
            title="额外留白"
          >
            <Switch v-model="options.padding" />
          </SettingRow>
          <div class="flex items-center gap-1 mt-1">
            <Button
              v-for="mode in ['transparent', 'white', 'black'] as const"
              :key="mode"
              :variant="options.background === mode ? 'default' : 'outline'"
              class="flex-1 px-1"
              @click="options.background = mode"
            >
              {{ mode === 'transparent' ? '透明' : mode === 'white' ? '白色' : '黑色' }}
            </Button>
          </div>
        </div>
      </div>
      <DialogFooter>
        <div class="flex justify-end gap-2 w-full">
          <Button
            v-if="canCopy"
            variant="outline"
            :disabled="busy"
            @click="copy"
          >
            复制到剪贴板
          </Button>
          <Button
            :disabled="busy"
            @click="save"
          >
            保存图片
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.image-dialog__stage {
  background: repeating-conic-gradient(var(--muted) 0% 25%, transparent 0% 50%) 50% / 16px 16px;
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
</style>
