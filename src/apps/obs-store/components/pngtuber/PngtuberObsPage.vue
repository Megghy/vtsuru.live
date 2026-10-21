<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
import { firstQueryValue } from '@/shared/obs/obsUrl'
import { normalizePngtuberState } from '@/shared/pngtuber/normalize'
import { DEFAULT_PNGTUBER_STATE } from '@/shared/pngtuber/types'
import type { PngtuberState } from '@/shared/pngtuber/types'
import { usePngtuberRuntime } from '@/shared/pngtuber/usePngtuberRuntime'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'

import PngtuberDisplay from './PngtuberDisplay.vue'
import PngtuberMicrophone from './PngtuberMicrophone.vue'

const route = useRoute()
const channel = computed(() => resolveObsSyncChannel(route.query.channel))
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
const localVolume = ref(0)
const localSpeaking = ref(false)
const assetError = ref('')
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
    <Card
      v-if="debug"
      class="p-3"
    >
      <CardHeader class="p-0 pb-2">
        <CardTitle class="text-sm font-semibold">PNGTuber · OBS 诊断</CardTitle>
      </CardHeader>
      <CardContent class="p-0 space-y-2 text-xs">
        <div>用户 {{ userId || '未指定' }} · 频道 {{ channel }} · 输入 {{ state.inputMode }}</div>
        <div>
          配置 {{ isReady ? '就绪' : '加载中' }} · 运行时 {{ connected ? '已连接' : '未连接' }} · 来源
          {{ runtime.source || '无' }}
        </div>
        <div>
          表情 {{ runtime.expressionId || state.defaultExpressionId }} · 音量
          {{ Math.round(microphone ? localVolume : runtime.volume) }} ·
          {{ runtime.muted ? '静音' : runtime.away ? '暂离' : '正常' }}
        </div>
        <Alert
          v-if="normalized.error || errorMessage || runtimeError || assetError"
          class="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 py-1.5 px-2"
        >
          <AlertDescription class="text-xs m-0">
            {{ normalized.error || errorMessage || runtimeError || assetError }}
          </AlertDescription>
        </Alert>
        <Alert
          v-if="!userId"
          class="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 py-1.5 px-2"
        >
          <AlertDescription class="text-xs m-0">
            链接缺少用户 ID，请从管理页重新复制浏览器源链接。
          </AlertDescription>
        </Alert>
        <Alert
          v-if="state.inputMode === 'client' || state.inputMode === 'obs'"
          class="border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400 py-1.5 px-2"
        >
          <AlertDescription class="text-xs m-0">
            需要启动 VTsuru 客户端并启用同频道输入。OBS 模式还需客户端连接 OBS。
          </AlertDescription>
        </Alert>
        <Alert
          v-if="state.inputMode === 'controller'"
          class="border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400 py-1.5 px-2"
        >
          <AlertDescription class="text-xs m-0">
            请保持同频道管理页打开并启动麦克风。
          </AlertDescription>
        </Alert>
        <Button
          size="sm"
          variant="outline"
          class="h-7 text-xs"
          @click="retry"
        >
          重新加载 / 重试连接
        </Button>
        <div class="text-[11px] text-muted-foreground">
          通过 OBS 浏览器源「交互」选择设备；完成后移除链接的 debug 参数即可恢复透明画面。
        </div>
      </CardContent>
    </Card>
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
