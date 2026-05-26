<script setup lang="ts">
import {
  NCheckbox, NDivider, NFlex, NInputGroup, NInputGroupLabel,
  NInputNumber, NSelect, NSlider, NText,
} from 'naive-ui'
import { useSpeechService } from '@/store/useSpeechService'
import SectionField from './SectionField.vue'

const props = defineProps<{
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
      <NSelect
        v-model:value="settings.outputDeviceId"
        :options="audioOutputDevices"
        :loading="audioOutputDevicesLoading"
        size="small"
        @update:value="emit('deviceChange')"
      />
    </SectionField>

    <NDivider style="margin: 4px 0" />

    <SectionField label="礼物合并">
      <NFlex align="center" :size="8">
        <NCheckbox
          :checked="settings.combineGiftDelay != null"
          @update:checked="(c: boolean) => settings.combineGiftDelay = c ? 2 : undefined"
        >
          <NText style="font-size: 12px">
            启用
          </NText>
        </NCheckbox>
        <NInputGroup v-if="settings.combineGiftDelay != null" size="small" style="max-width: 180px">
          <NInputGroupLabel size="small">
            间隔(秒)
          </NInputGroupLabel>
          <NInputNumber
            v-model:value="settings.combineGiftDelay"
            :min="1" :max="10" size="small"
          />
        </NInputGroup>
      </NFlex>
    </SectionField>

    <SectionField label="优先级插队" hint="这些事件类型会插到队列最前面">
      <NSelect
        v-model:value="settings.priorityEvents"
        :options="eventOptions"
        multiple size="small"
        placeholder="选择优先事件类型"
      />
    </SectionField>

    <NDivider style="margin: 4px 0" />

    <SectionField label="提示音">
      <NFlex vertical :size="8">
        <NCheckbox v-model:checked="settings.notificationSound.enabled">
          <NText style="font-size: 12px">
            播报前播放提示音
          </NText>
        </NCheckbox>
        <template v-if="settings.notificationSound.enabled">
          <NSelect
            v-model:value="settings.notificationSound.events"
            :options="eventOptions"
            multiple size="small"
            placeholder="哪些事件触发提示音"
          />
          <SectionField label="提示音音量" :value="`${(settings.notificationSound.volume * 100).toFixed(0)}%`">
            <NSlider
              v-model:value="settings.notificationSound.volume"
              :min="0" :max="1" :step="0.05"
            />
          </SectionField>
        </template>
      </NFlex>
    </SectionField>

    <NDivider style="margin: 4px 0" />

    <SectionField label="队列上限">
      <NInputNumber
        v-model:value="settings.maxQueueSize"
        :min="10" :max="200" size="small"
        style="max-width: 140px"
      />
    </SectionField>

    <SectionField label="队列满时策略">
      <NSelect
        v-model:value="settings.queueFullStrategy"
        :options="queueStrategyOptions"
        size="small"
        style="max-width: 180px"
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
