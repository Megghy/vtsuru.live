<script setup lang="ts">
import { computed } from 'vue'

import { Badge } from '@/shared/ui/badge'
import { FormField } from '@/shared/ui/form-field'
import { SettingRow } from '@/shared/ui/setting-row'
import { Slider } from '@/shared/ui/slider'
import { useSpeechService } from '@/store/useSpeechService'

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

const queueFullStrategyOptions = [
  { label: '丢弃最旧', value: 'drop-oldest' },
  { label: '拒绝新消息', value: 'reject-new' },
]

const isCombineGiftEnabled = computed({
  get: () => settings.value.combineGiftDelay != null,
  set: (val: boolean) => {
    settings.value.combineGiftDelay = val ? 2 : undefined
  },
})

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
  <div class="flex flex-col gap-3">
    <!-- 音频输出设备 -->
    <SettingRow
      type="select"
      variant="line"
      title="音频输出设备"
      description="选择播报语音的声卡输出通道"
      :options="audioOutputDevices"
      v-model="settings.outputDeviceId"
      @change="emit('deviceChange')"
    />

    <!-- 礼物合并 -->
    <SettingRow
      type="switch"
      variant="line"
      title="礼物合并"
      description="短时间内连续赠送的相同礼物合并为一条播报"
      v-model="isCombineGiftEnabled"
    />
    <SettingRow
      v-if="settings.combineGiftDelay != null"
      type="number"
      variant="compact"
      title="合并间隔 (秒)"
      description="在此间隔内收到的相同礼物将自动合并"
      :min="1"
      :max="10"
      control-class="w-24 font-mono"
      v-model="settings.combineGiftDelay"
    />

    <!-- 优先级插队 -->
    <FormField
      label="优先级插队"
      hint="这些事件类型会插到队列最前面优先播报"
    >
      <div class="flex flex-wrap gap-1.5 pt-1">
        <Badge
          v-for="opt in eventOptions"
          :key="opt.value"
          :variant="settings.priorityEvents.includes(opt.value) ? 'default' : 'outline'"
          class="cursor-pointer py-0.5 select-none"
          @click="togglePriorityEvent(opt.value)"
        >
          {{ opt.label }}
        </Badge>
      </div>
    </FormField>

    <!-- 提示音 -->
    <SettingRow
      type="switch"
      variant="line"
      title="播报提示音"
      description="在消息播报前播放提示音"
      v-model="settings.notificationSound.enabled"
    />
    <template v-if="settings.notificationSound.enabled">
      <FormField label="提示音触发事件">
        <div class="flex flex-wrap gap-1.5 pt-1">
          <Badge
            v-for="opt in eventOptions"
            :key="opt.value"
            :variant="(settings.notificationSound.events as string[]).includes(opt.value) ? 'default' : 'outline'"
            class="cursor-pointer py-0.5 select-none"
            @click="toggleNotificationEvent(opt.value)"
          >
            {{ opt.label }}
          </Badge>
        </div>
      </FormField>

      <FormField
        label="提示音音量"
        :extra="`${(settings.notificationSound.volume * 100).toFixed(0)}%`"
      >
        <div class="pt-2">
          <Slider
            :model-value="[settings.notificationSound.volume]"
            :min="0"
            :max="1"
            :step="0.05"
            @update:model-value="settings.notificationSound.volume = $event?.[0] ?? 0.5"
          />
        </div>
      </FormField>
    </template>

    <!-- 队列上限与策略 -->
    <SettingRow
      type="number"
      variant="line"
      title="队列上限"
      description="积压未播报的最大消息条数"
      :min="10"
      :max="200"
      :step="5"
      control-class="w-28 font-mono"
      v-model="settings.maxQueueSize"
    />

    <SettingRow
      type="select"
      variant="line"
      title="队列满时策略"
      description="超出队列上限时的处理方式"
      :options="queueFullStrategyOptions"
      v-model="settings.queueFullStrategy"
    />
  </div>
</template>
