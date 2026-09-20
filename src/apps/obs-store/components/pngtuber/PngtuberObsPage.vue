<script setup lang="ts">
import { NAlert, NButton, NCard, NSpace, NText } from 'naive-ui'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useObsBridge } from '@/apps/obs-store/sync'
import { firstQueryValue } from '@/shared/obs/obsUrl'
import { normalizePngtuberState } from '@/shared/pngtuber/normalize'
import { DEFAULT_PNGTUBER_STATE } from '@/shared/pngtuber/types'
import type { PngtuberState } from '@/shared/pngtuber/types'
import { usePngtuberRuntime } from '@/shared/pngtuber/usePngtuberRuntime'

import PngtuberDisplay from './PngtuberDisplay.vue'
import PngtuberMicrophone from './PngtuberMicrophone.vue'
const route = useRoute()
const channel = computed(() => firstQueryValue(route.query.channel) || 'default')
const debug = computed(() => 'debug' in route.query && firstQueryValue(route.query.debug) !== '0')
const bridge = useObsBridge<PngtuberState>({
  componentId: 'pngtuber',
  channelId: channel,
  defaultState: {} as PngtuberState,
  role: 'viewer',
})
const normalized = computed(() => {
  try {
    return { state: normalizePngtuberState(bridge.state.value), error: '' }
  } catch (error) {
    return { state: structuredClone(DEFAULT_PNGTUBER_STATE), error: String(error) }
  }
})
const state = computed(() => normalized.value.state)
const live = usePngtuberRuntime(bridge.userId, channel)
const { runtime, connected, error: runtimeError } = live
const { isReady, errorMessage, userId } = bridge
const localVolume = ref(0),
  localSpeaking = ref(false),
  assetError = ref('')
const microphone = computed(() => state.value.inputMode === 'microphone')
function sample(volume: number, speaking: boolean) {
  localVolume.value = volume
  localSpeaking.value = speaking
}
function retry() {
  window.location.reload()
}
</script>
<template>
  <PngtuberDisplay
    :state="state"
    :is-speaking="microphone ? localSpeaking : runtime.isSpeaking"
    :volume="microphone ? localVolume : runtime.volume"
    :expression-id="runtime.expressionId"
    :muted="runtime.muted"
    :away="runtime.away"
    @asset-error="assetError = $event"
  />
  <div :class="{ diagnostics: debug }">
    <NCard
      v-if="debug"
      title="PNGTuber · OBS 诊断"
      size="small"
    >
      <NSpace vertical>
        <NText>用户 {{ userId || '未指定' }} · 频道 {{ channel }} · 输入 {{ state.inputMode }}</NText>
        <NText
          >配置 {{ isReady ? '就绪' : '加载中' }} · 运行时 {{ connected ? '已连接' : '未连接' }} · 来源
          {{ runtime.source || '无' }}</NText
        >
        <NText
          >表情 {{ runtime.expressionId || state.defaultExpressionId }} · 音量
          {{ Math.round(microphone ? localVolume : runtime.volume) }} ·
          {{ runtime.muted ? '静音' : runtime.away ? '暂离' : '正常' }}</NText
        >
        <NAlert
          v-if="normalized.error || errorMessage || runtimeError || assetError"
          type="warning"
          >{{ normalized.error || errorMessage || runtimeError || assetError }}</NAlert
        >
        <NAlert
          v-if="!userId"
          type="warning"
          >链接缺少用户 ID，请从管理页重新复制浏览器源链接。</NAlert
        >
        <NAlert
          v-if="state.inputMode === 'client' || state.inputMode === 'obs'"
          type="info"
          >需要启动 VTsuru 客户端并启用同频道输入。OBS 模式还需客户端连接 OBS。</NAlert
        >
        <NAlert
          v-if="state.inputMode === 'controller'"
          type="info"
          >请保持同频道管理页打开并启动麦克风。</NAlert
        >
        <NButton
          size="small"
          @click="retry"
          >重新加载 / 重试连接</NButton
        >
        <NText depth="3">通过 OBS 浏览器源「交互」选择设备；完成后移除链接的 debug 参数即可恢复透明画面。</NText>
      </NSpace>
    </NCard>
    <div
      v-if="isReady && microphone && !normalized.error"
      :class="{ 'microphone-panel': debug }"
    >
      <PngtuberMicrophone
        :key="`${userId}:${channel}`"
        :state="state"
        :muted="runtime.muted || runtime.away"
        :controls="debug"
        obs
        auto-start
        @sample="sample"
      />
    </div>
  </div>
</template>
<style scoped>
.diagnostics {
  position: fixed;
  z-index: 10;
  inset: 12px auto auto 12px;
  width: min(440px, calc(100vw - 24px));
  max-height: calc(100vh - 24px);
  overflow: auto;
  color: var(--vtsuru-fg);
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
}
.microphone-panel {
  padding: 12px;
}
</style>
