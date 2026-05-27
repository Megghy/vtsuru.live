<script setup lang="ts">
import { Add20Filled, Delete20Filled } from '@vicons/fluent'
import {
  NButton, NCheckbox, NDivider, NDynamicInput, NFlex, NIcon,
  NInput, NInputGroup, NInputGroupLabel, NInputNumber, NSwitch, NText,
} from 'naive-ui'
import { EventDataTypes } from '@/api/api-models'
import { copyToClipboard } from '@/shared/utils'
import { templateConstants, useSpeechService } from '@/store/useSpeechService'

const speechService = useSpeechService()
const { settings, speechState } = speechService

const templateRows = [
  { key: 'danmakuTemplate' as const, label: '弹幕', type: EventDataTypes.Message, eventKey: 'message' as const },
  { key: 'giftTemplate' as const, label: '礼物', type: EventDataTypes.Gift, eventKey: 'gift' as const },
  { key: 'scTemplate' as const, label: 'SC', type: EventDataTypes.SC, eventKey: 'sc' as const },
  { key: 'guardTemplate' as const, label: '上舰', type: EventDataTypes.Guard, eventKey: 'guard' as const },
  { key: 'enterTemplate' as const, label: '进入', type: EventDataTypes.Enter, eventKey: 'enter' as const },
  { key: 'followTemplate' as const, label: '关注', type: EventDataTypes.Follow, eventKey: 'follow' as const },
]

function test(type: EventDataTypes) {
  const data: any = {
    type, uname: '测试用户', uid: 0, msg: '', price: 0, num: 0,
    time: Date.now(), guard_level: 0, fans_medal_level: 1,
    fans_medal_name: '', fans_medal_wearing_status: false,
    emoji: undefined, uface: '', open_id: '', ouid: '',
  }
  const map: Partial<Record<EventDataTypes, any>> = {
    [EventDataTypes.Message]: { msg: '测试弹幕' },
    [EventDataTypes.Enter]: {},
    [EventDataTypes.SC]: { msg: '测试留言', price: 30, num: 1 },
    [EventDataTypes.Guard]: { msg: '舰长', num: 1, guard_level: 3 },
    [EventDataTypes.Gift]: { msg: '测试礼物', price: 5, num: 5 },
  }
  Object.assign(data, map[type] ?? {})
  if (speechState.canSpeech) speechService.addToQueue(data)
  else speechService.forceSpeak(data)
}
</script>

<template>
  <div class="panel">
    <NText depth="3" style="font-size: 11px">
      模板留空则不播报对应类型，点击变量复制。开关可独立控制是否播报。
    </NText>

    <NFlex :size="4" :wrap="true" style="margin: 4px 0">
      <NButton
        v-for="item in Object.values(templateConstants)"
        :key="item.name"
        size="tiny" tertiary
        @click="copyToClipboard(item.words)"
      >
        {{ item.words }}
      </NButton>
    </NFlex>

    <div class="template-rows">
      <div v-for="row in templateRows" :key="row.key" class="template-row">
        <NCheckbox
          v-model:checked="settings.enabledEvents[row.eventKey]"
          style="flex-shrink: 0"
        />
        <NInputGroup size="small" style="flex: 1">
          <NInputGroupLabel size="small" style="min-width: 48px; text-align: center">
            {{ row.label }}
          </NInputGroupLabel>
          <NInput
            v-model:value="settings[row.key]"
            size="small"
            :placeholder="`留空则不播报${row.label}`"
            :disabled="!settings.enabledEvents[row.eventKey]"
          />
          <NButton
            size="small" type="primary" tertiary
            :disabled="!settings.enabledEvents[row.eventKey]"
            :loading="speechState.isApiAudioLoading"
            @click="test(row.type)"
          >
            测试
          </NButton>
        </NInputGroup>
      </div>
    </div>

    <NDivider style="margin: 4px 0" />

    <NFlex align="center" :size="8">
      <NSwitch v-model:value="settings.timedBroadcast.enabled" size="small" />
      <NText style="font-size: 12px">定时播报</NText>
      <NInputNumber
        v-model:value="settings.timedBroadcast.intervalMinutes"
        :min="1" :max="120" size="small"
        :disabled="!settings.timedBroadcast.enabled"
        style="width: 80px"
      />
      <NText depth="3" style="font-size: 11px">分钟/次</NText>
    </NFlex>

    <template v-if="settings.timedBroadcast.enabled">
      <div v-for="(_, i) in settings.timedBroadcast.texts" :key="i" class="broadcast-row">
        <NInput
          v-model:value="settings.timedBroadcast.texts[i]"
          size="small" placeholder="播报文本"
          style="flex: 1"
        />
        <NButton size="tiny" tertiary type="error" @click="settings.timedBroadcast.texts.splice(i, 1)">
          <template #icon>
            <NIcon :component="Delete20Filled" />
          </template>
        </NButton>
      </div>
      <NButton size="tiny" tertiary type="primary" @click="settings.timedBroadcast.texts.push('')">
        <template #icon>
          <NIcon :component="Add20Filled" />
        </template>
        添加播报文本
      </NButton>
    </template>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.broadcast-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.template-rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.template-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
