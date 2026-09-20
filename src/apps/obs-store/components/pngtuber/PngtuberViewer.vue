<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { saveAs } from 'file-saver'
import { NAlert, NButton, NCard, NInput, NInputGroup, NSelect, NSpace, NTag, NText, useMessage } from 'naive-ui'
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useAccount } from '@/api/account'
import { useObsBridge } from '@/apps/obs-store/sync'
import { buildObsSourceUrl, firstQueryValue } from '@/shared/obs/obsUrl'
import { exportPngtuberPackage, importPngtuberPackage } from '@/shared/pngtuber/modelPackage'
import { normalizePngtuberState } from '@/shared/pngtuber/normalize'
import { DEFAULT_PNGTUBER_STATE } from '@/shared/pngtuber/types'
import type { PngtuberExpression, PngtuberRuntime, PngtuberState } from '@/shared/pngtuber/types'
import { usePngtuberRuntime } from '@/shared/pngtuber/usePngtuberRuntime'

import PngtuberAppearance from './PngtuberAppearance.vue'
import PngtuberDisplay from './PngtuberDisplay.vue'
import PngtuberExpressions from './PngtuberExpressions.vue'
import PngtuberInputSettings from './PngtuberInputSettings.vue'
import PngtuberMicrophone from './PngtuberMicrophone.vue'
import { usePngtuberHotkeys } from './usePngtuberHotkeys'
const message = useMessage(),
  account = useAccount(),
  route = useRoute()
const { copy } = useClipboard()
const channel = ref(firstQueryValue(route.query.channel) || 'default')
const channelDraft = ref(channel.value)
// An empty bridge default preserves the distinction between legacy snapshots and expressions.
const bridge = useObsBridge<PngtuberState>({
  componentId: 'pngtuber',
  channelId: channel,
  defaultState: {} as PngtuberState,
  role: 'controller',
})
const { userId, isReady, isSyncing, lastSyncError, errorMessage } = bridge
const normalized = computed(() => {
  try {
    return { state: normalizePngtuberState(bridge.state.value), error: '' }
  } catch (error) {
    return { state: structuredClone(DEFAULT_PNGTUBER_STATE), error: String(error) }
  }
})
const state = computed(() => normalized.value.state)
const writable = computed(
  () => !!userId.value && userId.value === account.value.id && isReady.value && !normalized.value.error,
)
const session = computed(() => `${userId.value}:${channel.value}`)
const live = usePngtuberRuntime(userId, channel, true)
const { runtime, connected, error: runtimeError } = live
const controlDisabled = computed(() => !writable.value || !connected.value)
const busy = ref(false),
  assetError = ref(''),
  localVolume = ref(0),
  localSpeaking = ref(false)
const localInput = computed(() => ['microphone', 'controller'].includes(state.value.inputMode))
const previewVolume = computed(() => (localInput.value ? localVolume.value : runtime.value.volume))
const previewSpeaking = computed(() => (localInput.value ? localSpeaking.value : runtime.value.isSpeaking))
const bg = ref('checker'),
  packageInput = ref<HTMLInputElement>()
const obsUrl = computed(() =>
  buildObsSourceUrl({
    path: '/obs-store/pngtuber',
    host: window.location.origin,
    credential: 'public-id',
    userId: userId.value,
    params: { channel: channel.value },
  }),
)
function failed(error: unknown) {
  message.error(error instanceof Error ? error.message : String(error))
}
async function setState(next: PngtuberState) {
  if (!writable.value) throw new Error('请登录并等待配置加载完成')
  const clean = normalizePngtuberState(next)
  // Replace local snapshot first: bridge updates merge, so legacy keys must be removed explicitly.
  bridge.state.value = clean
  await bridge.setState(clean)
}
async function patch(value: Partial<PngtuberState>) {
  try {
    const next = { ...state.value, ...value }
    if (value.blinkMin !== undefined) next.blinkMax = Math.max(next.blinkMax, value.blinkMin)
    if (value.blinkMax !== undefined) next.blinkMin = Math.min(next.blinkMin, value.blinkMax)
    const clean = normalizePngtuberState(next)
    const changed = Object.fromEntries(
      Object.entries(clean).filter(
        ([key, value]) => JSON.stringify(value) !== JSON.stringify(state.value[key as keyof PngtuberState]),
      ),
    )
    if (!writable.value) throw new Error('请登录并等待配置加载完成')
    await bridge.updateState(changed)
  } catch (error) {
    failed(error)
  }
}
const migrated = new Set<string>()
watch(
  [isReady, session, bridge.state],
  () => {
    if (!writable.value || migrated.has(session.value)) return
    migrated.add(session.value)
    const raw = bridge.state.value as unknown as Record<string, unknown>
    if (!Array.isArray(raw.expressions) || 'deviceId' in raw || 'idleImage' in raw || 'speakingImage' in raw)
      void setState(state.value).catch(failed)
  },
  { immediate: true },
)
async function control(value: Partial<Pick<PngtuberRuntime, 'expressionId' | 'muted' | 'away'>>, duration = 0) {
  if (controlDisabled.value) return
  try {
    await live.control(value, duration)
  } catch (error) {
    failed(error)
  }
}
function activate(expression: PngtuberExpression) {
  void control({ expressionId: expression.id }, expression.hotkeyMode === 'timed' ? expression.durationMs : 0)
}
const hotkeys = usePngtuberHotkeys({
  expressions: () => state.value.expressions,
  runtime: () => runtime.value,
  enabled: () => !controlDisabled.value,
  control: (expressionId, duration) => control({ expressionId }, duration),
})
onScopeDispose(() => {
  if (state.value.inputMode === 'controller') void live.stopPublishing().catch(() => {})
})
function sample(volume: number, speaking: boolean) {
  localVolume.value = volume
  localSpeaking.value = speaking
  if (state.value.inputMode === 'controller' && writable.value) void live.publish(volume, speaking, 'controller')
}
watch(
  () => state.value.inputMode,
  (_next, previous) => {
    localVolume.value = 0
    localSpeaking.value = false
    if (previous === 'controller') void live.stopPublishing().catch(failed)
  },
)
watch(session, () => {
  hotkeys.release()
  assetError.value = ''
  localVolume.value = 0
  localSpeaking.value = false
})
async function retry() {
  await bridge.retry()
  await live.reconnect()
}
async function exportPackage() {
  busy.value = true
  try {
    saveAs(await exportPngtuberPackage(state.value), 'pngtuber.zip')
  } catch (error) {
    failed(error)
  } finally {
    busy.value = false
  }
}
async function importPackage(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0]
  input.value = ''
  if (!file || !writable.value || busy.value) return
  const owner = session.value
  busy.value = true
  try {
    const validated = normalizePngtuberState(await importPngtuberPackage(file))
    if (owner !== session.value) throw new Error('频道或登录用户已变化，请重新导入')
    await setState(validated)
    if (!lastSyncError.value) message.success('模型包已导入')
  } catch (error) {
    failed(error)
  } finally {
    busy.value = false
  }
}
async function copyUrl() {
  try {
    await copy(obsUrl.value)
    message.success('已复制 OBS 链接')
  } catch (error) {
    failed(error)
  }
}
function changeChannel() {
  const next = channelDraft.value.trim() || 'default'
  if (next === channel.value) return
  hotkeys.release()
  void live.stopPublishing().catch(failed)
  channel.value = next
}
</script>
<template>
  <NSpace
    vertical
    :size="12"
  >
    <NAlert
      v-if="!userId"
      type="warning"
      >请登录后编辑立绘配置。</NAlert
    >
    <NAlert
      v-else-if="lastSyncError || !isReady || runtimeError || !connected || normalized.error"
      type="warning"
    >
      {{ normalized.error || errorMessage || runtimeError || (!isReady ? '配置尚未加载完成' : '立绘控制连接尚未就绪') }}
      <NButton
        size="tiny"
        secondary
        @click="retry"
        >重试连接</NButton
      >
    </NAlert>
    <div class="workbench">
      <div class="settings">
        <NCard
          title="声音输入"
          size="small"
          ><NSpace
            vertical
            :size="12"
          >
            <PngtuberInputSettings
              :state="state"
              :disabled="!writable || busy"
              @change="patch"
            />
            <PngtuberMicrophone
              v-if="localInput"
              :key="session"
              :state="state"
              :muted="runtime.muted || runtime.away"
              :disabled="!writable || busy"
              @sample="sample"
              @change="patch"
              @error="failed"
            /> </NSpace
        ></NCard>
        <PngtuberExpressions
          :key="session"
          :state="state"
          :disabled="!writable || busy"
          :control-disabled="controlDisabled"
          @change="patch"
          @activate="activate"
        />
        <PngtuberAppearance
          :state="state"
          :disabled="!writable || busy"
          @change="patch"
        />
      </div>
      <div class="stage">
        <NCard
          title="实时预览"
          size="small"
          ><NSpace
            vertical
            :size="12"
          >
            <NSpace align="center"
              ><NTag
                size="small"
                :type="previewSpeaking ? 'success' : 'default'"
                >{{ runtime.away ? '暂离' : runtime.muted ? '静音' : previewSpeaking ? '说话中' : '待机' }}</NTag
              ><NTag size="small">{{
                isSyncing ? '保存中' : lastSyncError ? '保存失败' : isReady ? '配置已就绪' : '加载中'
              }}</NTag
              ><NText depth="3">音量 {{ Math.round(previewVolume) }}%</NText></NSpace
            >
            <NSelect
              v-model:value="bg"
              size="small"
              :options="[
                { label: '透明棋盘', value: 'checker' },
                { label: '暗色', value: 'dark' },
                { label: '绿幕', value: 'green' },
                { label: '透明', value: 'transparent' },
              ]"
            />
            <div
              class="preview"
              :class="`bg-${bg}`"
            >
              <PngtuberDisplay
                :state="state"
                :is-speaking="previewSpeaking"
                :volume="previewVolume"
                :expression-id="runtime.expressionId"
                :muted="runtime.muted"
                :away="runtime.away"
                inline-mode
                @asset-error="assetError = $event"
              />
            </div>
            <NAlert
              v-if="assetError"
              type="warning"
              >{{ assetError }}</NAlert
            >
            <NSpace
              ><NButton
                size="small"
                :disabled="controlDisabled"
                @click="control({ muted: !runtime.muted })"
                >{{ runtime.muted ? '取消静音' : '静音' }}</NButton
              ><NButton
                size="small"
                :disabled="controlDisabled"
                @click="control({ away: !runtime.away })"
                >{{ runtime.away ? '结束暂离' : '暂离' }}</NButton
              ><NButton
                size="small"
                :disabled="controlDisabled"
                @click="control({ expressionId: '' })"
                >默认表情</NButton
              ></NSpace
            >
          </NSpace></NCard
        >
        <NCard
          title="OBS 浏览器源"
          size="small"
          ><NSpace
            vertical
            :size="12"
          >
            <NInputGroup
              ><NInput
                v-model:value="channelDraft"
                placeholder="频道"
                :disabled="busy"
                @keyup.enter="changeChannel"
              /><NButton
                :disabled="busy"
                @click="changeChannel"
                >切换频道</NButton
              ></NInputGroup
            >
            <NInput
              :value="obsUrl"
              readonly
              placeholder="登录后生成链接"
            />
            <NSpace
              ><NButton
                size="small"
                :disabled="!obsUrl"
                @click="copyUrl"
                >复制链接</NButton
              ><NButton
                tag="a"
                :href="obsUrl || undefined"
                target="_blank"
                rel="noopener"
                size="small"
                :disabled="!obsUrl"
                >打开画面</NButton
              ><NButton
                tag="a"
                :href="obsUrl ? `${obsUrl}&debug=1` : undefined"
                target="_blank"
                rel="noopener"
                size="small"
                :disabled="!obsUrl"
                >OBS 诊断</NButton
              ></NSpace
            >
            <NText depth="3"
              >浏览器源尺寸：{{ state.canvasWidth }} × {{ state.canvasHeight }}。麦克风模式请在 OBS「交互」窗口访问带
              debug=1 的链接选择设备，完成后移除 debug 参数。</NText
            >
          </NSpace></NCard
        >
        <NCard
          title="模型包"
          size="small"
          ><NSpace
            ><NButton
              size="small"
              :loading="busy"
              :disabled="!writable || busy"
              @click="packageInput?.click()"
              >导入模型包</NButton
            ><NButton
              size="small"
              :loading="busy"
              :disabled="busy || !isReady || !!normalized.error"
              @click="exportPackage"
              >导出模型包</NButton
            ><input
              ref="packageInput"
              hidden
              type="file"
              accept=".zip,application/zip"
              @change="importPackage" /></NSpace
          ><NText depth="3">导入会校验模型包并替换当前频道配置。</NText></NCard
        >
      </div>
    </div>
  </NSpace>
</template>
<style scoped>
.workbench {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(300px, 1fr);
  gap: 16px;
  color: var(--vtsuru-fg);
}
.settings,
.stage {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.stage {
  position: sticky;
  top: 16px;
  align-self: start;
}
.preview {
  position: relative;
  height: 340px;
  overflow: hidden;
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
}
.bg-checker {
  background-color: var(--vtsuru-bg);
  background-image: conic-gradient(
    var(--vtsuru-bg-muted) 25%,
    transparent 0 50%,
    var(--vtsuru-bg-muted) 0 75%,
    transparent 0
  );
  background-size: 20px 20px;
}
.bg-dark {
  background: #18181b;
}
.bg-green {
  background: #00b140;
}
@media (max-width: 900px) {
  .workbench {
    grid-template-columns: 1fr;
  }
  .stage {
    position: static;
    grid-row: 1;
  }
  .preview {
    height: 280px;
  }
}
</style>
