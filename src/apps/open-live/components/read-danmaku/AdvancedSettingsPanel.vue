<script setup lang="ts">
import { useSpeechService } from '@/store/useSpeechService'

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

const queueStrategyOptions = [
  { label: '丢弃最旧', value: 'drop-oldest' },
  { label: '拒绝新消息', value: 'reject-new' },
]
</script>

<template>
  <div class="panel">
    <SectionField label="音频输出设备">
      <USelectMenu
        v-model="settings.outputDeviceId"
        :items="audioOutputDevices"
        :loading="audioOutputDevicesLoading"
        size="small"
        @update:value="emit('deviceChange')"
        value-key="value"
      />
    </SectionField>

    <USeparator style="margin: 4px 0" />

    <SectionField label="礼物合并">
      <div
        align="center"
        :size="8"
      >
        <UCheckbox
          :model-value="settings.combineGiftDelay != null"
          @update:model-value="(c: boolean) => (settings.combineGiftDelay = c ? 2 : undefined)"
        >
          <span style="font-size: 12px"> 启用 </span>
        </UCheckbox>
        <div
          v-if="settings.combineGiftDelay != null"
          size="small"
          style="max-width: 180px"
        >
          <span size="small"> 间隔(秒) </span>
          <UInputNumber
            v-model="settings.combineGiftDelay"
            :min="1"
            :max="10"
            size="small"
          />
        </div>
      </div>
    </SectionField>

    <SectionField
      label="优先级插队"
      hint="这些事件类型会插到队列最前面"
    >
      <USelectMenu
        v-model="settings.priorityEvents"
        :items="eventOptions"
        multiple
        size="small"
        placeholder="选择优先事件类型"
        value-key="value"
      />
    </SectionField>

    <USeparator style="margin: 4px 0" />

    <SectionField label="提示音">
      <div
        vertical
        :size="8"
      >
        <UCheckbox v-model="settings.notificationSound.enabled">
          <span style="font-size: 12px"> 播报前播放提示音 </span>
        </UCheckbox>
        <template v-if="settings.notificationSound.enabled">
          <USelectMenu
            v-model="settings.notificationSound.events"
            :items="eventOptions"
            multiple
            size="small"
            placeholder="哪些事件触发提示音"
            value-key="value"
          />
          <SectionField
            label="提示音音量"
            :value="`${(settings.notificationSound.volume * 100).toFixed(0)}%`"
          >
            <USlider
              v-model="settings.notificationSound.volume"
              :min="0"
              :max="1"
              :step="0.05"
            />
          </SectionField>
        </template>
      </div>
    </SectionField>

    <USeparator style="margin: 4px 0" />

    <SectionField label="队列上限">
      <UInputNumber
        v-model="settings.maxQueueSize"
        :min="10"
        :max="200"
        size="small"
        style="max-width: 140px"
      />
    </SectionField>

    <SectionField label="队列满时策略">
      <USelectMenu
        v-model="settings.queueFullStrategy"
        :items="queueStrategyOptions"
        size="small"
        style="max-width: 180px"
        value-key="value"
      />
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
