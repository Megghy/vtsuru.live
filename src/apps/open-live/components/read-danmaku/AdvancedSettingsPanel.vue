<script setup lang="ts">
import { useSpeechService } from '@/store/useSpeechService'
import { Badge } from '@/shared/ui/badge'
import { Checkbox } from '@/shared/ui/checkbox'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { Slider } from '@/shared/ui/slider'

import SectionField from './SectionField.vue'

defineProps<{
  audioOutputDevices: Array<{ label: string; value: string }>
  audioOutputDevicesLoading: boolean
}>()
const emit = defineEmits<{ (e: 'deviceChange'): void }>()

const { settings } = useSpeechService()

const eventOptions = [
  { label: '醒目留言 (SC)', value: 'sc' },
  { label: '上舰', value: 'guard' },
  { label: '礼物', value: 'gift' },
  { label: '弹幕', value: 'message' },
  { label: '进入', value: 'enter' },
]

function togglePriorityEvent(val: string) {
  const idx = settings.value.priorityEvents.indexOf(val)
  if (idx > -1) {
    settings.value.priorityEvents.splice(idx, 1)
  } else {
    settings.value.priorityEvents.push(val)
  }
}

function toggleNotificationEvent(val: string) {
  const list = settings.value.notificationSound.events as string[]
  const idx = list.indexOf(val)
  if (idx > -1) {
    list.splice(idx, 1)
  } else {
    list.push(val)
  }
}
</script>

<template>
  <div class="panel">
    <SectionField label="音频输出设备">
      <Select
        v-model="settings.outputDeviceId"
        @update:model-value="emit('deviceChange')"
      >
        <SelectTrigger class="w-full">
          <SelectValue placeholder="默认设备" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="d in audioOutputDevices"
            :key="d.value"
            :value="d.value"
            class="text-xs"
          >
            {{ d.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </SectionField>

    <Separator class="my-1" />

    <SectionField label="礼物合并">
      <div class="flex items-center gap-3">
        <label class="flex items-center gap-2 cursor-pointer text-xs">
          <Checkbox
            :checked="settings.combineGiftDelay != null"
            @update:checked="(c: boolean) => (settings.combineGiftDelay = c ? 2 : undefined)"
          />
          <span>启用</span>
        </label>
        <div
          v-if="settings.combineGiftDelay != null"
          class="flex items-center border rounded-md overflow-hidden text-xs w-[180px]"
        >
          <span class="bg-muted px-2 py-1 text-muted-foreground border-r shrink-0">间隔(秒)</span>
          <NInputNumber
            v-model:value="settings.combineGiftDelay"
            :min="1"
            :max="10"
            size="small"
            class="border-0 shadow-none flex-1"
          />
        </div>
      </div>
    </SectionField>

    <SectionField
      label="优先级插队"
      hint="这些事件类型会插到队列最前面"
    >
      <div class="flex flex-wrap gap-1.5">
        <Badge
          v-for="opt in eventOptions"
          :key="opt.value"
          :variant="settings.priorityEvents.includes(opt.value) ? 'default' : 'outline'"
          class="cursor-pointer text-xs py-0.5"
          @click="togglePriorityEvent(opt.value)"
        >
          {{ opt.label }}
        </Badge>
      </div>
    </SectionField>

    <Separator class="my-1" />

    <SectionField label="提示音">
      <div class="flex flex-col gap-2.5">
        <label class="flex items-center gap-2 cursor-pointer text-xs">
          <Checkbox
            :checked="settings.notificationSound.enabled"
            @update:checked="settings.notificationSound.enabled = $event"
          />
          <span>播报前播放提示音</span>
        </label>
        <template v-if="settings.notificationSound.enabled">
          <div class="flex flex-wrap gap-1.5">
            <Badge
              v-for="opt in eventOptions"
              :key="opt.value"
              :variant="(settings.notificationSound.events as string[]).includes(opt.value) ? 'default' : 'outline'"
              class="cursor-pointer text-xs py-0.5"
              @click="toggleNotificationEvent(opt.value)"
            >
              {{ opt.label }}
            </Badge>
          </div>
          <SectionField
            label="提示音音量"
            :value="`${(settings.notificationSound.volume * 100).toFixed(0)}%`"
          >
            <Slider
              :model-value="[settings.notificationSound.volume]"
              :min="0"
              :max="1"
              :step="0.05"
              @update:model-value="settings.notificationSound.volume = $event?.[0] ?? 0.5"
            />
          </SectionField>
        </template>
      </div>
    </SectionField>

    <Separator class="my-1" />

    <SectionField label="队列上限">
      <div class="max-w-[140px]">
        <NInputNumber
          v-model:value="settings.maxQueueSize"
          :min="10"
          :max="200"
          size="small"
        />
      </div>
    </SectionField>

    <SectionField label="队列满时策略">
      <Select v-model="settings.queueFullStrategy">
        <SelectTrigger class="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            value="drop-oldest"
            class="text-xs"
          >
            丢弃最旧
          </SelectItem>
          <SelectItem
            value="reject-new"
            class="text-xs"
          >
            拒绝新消息
          </SelectItem>
        </SelectContent>
      </Select>
    </SectionField>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
