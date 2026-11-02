<script setup lang="ts">
import { ArrowLeft24Regular, Wrench24Regular } from '@vicons/fluent'
import { useClipboard } from '@vueuse/core'
import { saveAs } from 'file-saver'
import { computed, onActivated, onDeactivated, onScopeDispose, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import { OBS_SYNC_CHANNEL_HINT, parseObsSyncChannel, resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import { exportPngtuberPackage, importPngtuberPackage } from '@/shared/pngtuber/modelPackage'
import { normalizePngtuberState } from '@/shared/pngtuber/normalize'
import PngtuberCollabCard from '@/shared/pngtuber/PngtuberCollabCard.vue'
import { DEFAULT_PNGTUBER_STATE } from '@/shared/pngtuber/types'
import type { PngtuberExpression, PngtuberRuntime, PngtuberState } from '@/shared/pngtuber/types'
import { usePngtuberDebugger } from '@/shared/pngtuber/usePngtuberDebugger'
import { usePngtuberRuntime } from '@/shared/pngtuber/usePngtuberRuntime'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Slider } from '@/shared/ui/slider'

import PngtuberAppearance from './PngtuberAppearance.vue'
import PngtuberDisplay from './PngtuberDisplay.vue'
import PngtuberExpressions from './PngtuberExpressions.vue'
import PngtuberInputSettings from './PngtuberInputSettings.vue'
import PngtuberMicrophone from './PngtuberMicrophone.vue'
import { usePngtuberHotkeys } from './usePngtuberHotkeys'

const account = useAccount()
const route = useRoute()
const router = useRouter()
const standalone = computed(() => route.name !== 'client-pngtuber-model')
const showInlineBack = computed(() => route.name !== 'manage-obsStore')
function goBack() {
  if (window.history.state?.back) {
    router.back()
    return
  }
  void router.push(standalone.value ? { name: 'manage-obsStore' } : { name: 'client-pngtuber' })
}
const { copy, isSupported: isCopySupported } = useClipboard()
const channel = ref(resolveObsSyncChannel(route.query.channel))
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
const active = ref(true)
const busy = ref(false)
const assetError = ref('')
const localVolume = ref(0)
const localSpeaking = ref(false)
const localInput = computed(() => ['microphone', 'controller'].includes(state.value.inputMode))
const {
  isSimulating,
  simulatedSpeaking,
  simulatedVolume,
  simulatedExpressionId,
  simulatedMuted,
  simulatedAway,
  autoSpeakingWave,
  toggleSingleSimulation,
  setSimulatedSpeaking,
  setSimulatedVolume,
  toggleAutoWave,
} = usePngtuberDebugger()
const previewVolume = computed(() => {
  if (isSimulating.value) return simulatedVolume.value
  return localInput.value ? localVolume.value : runtime.value.volume
})
const previewSpeaking = computed(() => {
  if (isSimulating.value) return simulatedSpeaking.value
  return localInput.value ? localSpeaking.value : runtime.value.isSpeaking
})
const previewExpressionId = computed(() => {
  if (isSimulating.value && simulatedExpressionId.value) return simulatedExpressionId.value
  return runtime.value.expressionId
})
const previewMuted = computed(() => (isSimulating.value ? simulatedMuted.value : runtime.value.muted))
const previewAway = computed(() => (isSimulating.value ? simulatedAway.value : runtime.value.away))
const bg = ref('checker')
const packageInput = ref<HTMLInputElement>()
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
  toast.error(error instanceof Error ? error.message : String(error))
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
        ([key, val]) => JSON.stringify(val) !== JSON.stringify(state.value[key as keyof PngtuberState]),
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
  enabled: () => active.value && !controlDisabled.value,
  control: (expressionId, duration) => control({ expressionId }, duration),
})
onActivated(() => {
  active.value = true
})
onDeactivated(() => {
  active.value = false
  hotkeys.release()
  if (state.value.inputMode === 'controller') void live.stopPublishing().catch(() => {})
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
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !writable.value || busy.value) return
  const owner = session.value
  busy.value = true
  try {
    const validated = normalizePngtuberState(await importPngtuberPackage(file))
    if (owner !== session.value) throw new Error('频道或登录用户已变化，请重新导入')
    await setState(validated)
    if (!lastSyncError.value) toast.success('模型包已导入')
  } catch (error) {
    failed(error)
  } finally {
    busy.value = false
  }
}
async function copyUrl() {
  if (!isCopySupported.value) {
    toast.warning('当前环境不支持直接写入剪贴板，请手动复制')
    return
  }
  try {
    await copy(obsUrl.value)
    toast.success('已复制 OBS 链接')
  } catch (error) {
    failed(error)
  }
}
function changeChannel() {
  const next = parseObsSyncChannel(channelDraft.value)
  if (!next) {
    toast.error(OBS_SYNC_CHANNEL_HINT)
    return
  }
  if (next === channel.value) return
  hotkeys.release()
  void live.stopPublishing().catch(failed)
  channel.value = next
}
</script>

<template>
  <div
    class="pngtuber-page"
    :class="{ standalone }"
  >
    <Button
      v-if="showInlineBack"
      variant="ghost"
      class="w-fit gap-1.5"
      @click="goBack"
    >
      <ArrowLeft24Regular class="size-4" />
      返回
    </Button>

    <div class="flex flex-col gap-3">
      <Alert
        v-if="!userId"
        class="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 py-2.5 px-3"
      >
        <AlertDescription class="text-xs text-current m-0"> 请登录后编辑立绘配置。 </AlertDescription>
      </Alert>
      <Alert
        v-else-if="lastSyncError || !isReady || runtimeError || !connected || normalized.error"
        class="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 py-2.5 px-3"
      >
        <div class="flex items-center justify-between gap-2">
          <AlertDescription class="text-xs text-current m-0">
            {{
              normalized.error ||
              errorMessage ||
              runtimeError ||
              (!isReady ? '配置尚未加载完成' : '立绘控制连接尚未就绪')
            }}
          </AlertDescription>
          <Button
            size="xs"
            variant="outline"
            class="h-6 text-[11px] shrink-0"
            @click="retry"
          >
            重试连接
          </Button>
        </div>
      </Alert>

      <div class="workbench">
        <div class="settings flex flex-col gap-4">
          <Card class="p-3">
            <CardHeader class="p-0 pb-2">
              <CardTitle class="text-sm font-semibold">声音输入</CardTitle>
            </CardHeader>
            <CardContent class="p-0 space-y-3">
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
              />
            </CardContent>
          </Card>

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

        <div class="stage flex flex-col gap-4">
          <Card class="p-3">
            <CardHeader class="p-0 pb-2 flex flex-row items-center justify-between">
              <CardTitle class="text-sm font-semibold">实时预览</CardTitle>
              <Button
                variant="ghost"
                size="xs"
                class="gap-1"
                :class="{
                  'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30': isSimulating,
                }"
                @click="toggleSingleSimulation"
              >
                <Wrench24Regular class="size-3" />
                {{ isSimulating ? '退出调试模拟' : '调试模拟' }}
              </Button>
            </CardHeader>
            <CardContent class="p-0 space-y-3">
              <div class="flex items-center gap-2 flex-wrap">
                <Badge
                  :variant="previewSpeaking ? 'default' : 'secondary'"
                  class="text-xs"
                >
                  {{ previewAway ? '暂离' : previewMuted ? '静音' : previewSpeaking ? '说话中' : '待机' }}
                </Badge>
                <Badge
                  v-if="isSimulating"
                  variant="outline"
                  class="border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 text-xs"
                >
                  模拟运行中
                </Badge>
                <Badge
                  v-else
                  variant="outline"
                  class="text-xs"
                >
                  {{ isSyncing ? '保存中' : lastSyncError ? '保存失败' : isReady ? '配置已就绪' : '加载中' }}
                </Badge>
                <span class="text-xs text-muted-foreground">音量 {{ Math.round(previewVolume) }}%</span>
              </div>

              <div
                v-if="isSimulating"
                class="p-2.5 rounded-md border border-amber-500/30 bg-amber-500/5 space-y-2.5 text-xs"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="text-muted-foreground font-medium">模拟说话状态</span>
                  <div class="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="xs"
                      :class="{
                        'bg-primary text-primary-foreground': simulatedSpeaking && !autoSpeakingWave,
                      }"
                      @click="setSimulatedSpeaking(!simulatedSpeaking)"
                    >
                      {{ simulatedSpeaking ? '停止说话' : '模拟持续说话' }}
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      :class="{ 'border-primary text-primary': autoSpeakingWave }"
                      @click="toggleAutoWave"
                    >
                      {{ autoSpeakingWave ? '停止自动波形' : '自动语调波形' }}
                    </Button>
                  </div>
                </div>

                <div class="space-y-1">
                  <div class="flex justify-between items-center text-muted-foreground text-[11px]">
                    <span>模拟音量调节</span>
                    <span class="font-mono text-foreground">{{ Math.round(simulatedVolume) }}%</span>
                  </div>
                  <Slider
                    :min="0"
                    :max="100"
                    :step="1"
                    :model-value="[simulatedVolume]"
                    @update:model-value="setSimulatedVolume($event?.[0] ?? 0)"
                  />
                </div>

                <div class="space-y-1">
                  <span class="text-muted-foreground text-[11px]">快速测试表情：</span>
                  <div class="flex items-center gap-1 flex-wrap">
                    <Button
                      v-for="expr in state.expressions"
                      :key="expr.id"
                      variant="ghost"
                      size="xs"
                      class="px-1.5 border border-border/60"
                      :class="{
                        'bg-primary/10 border-primary text-primary font-medium':
                          previewExpressionId === expr.id ||
                          (!previewExpressionId && expr.id === state.defaultExpressionId),
                      }"
                      @click="simulatedExpressionId = expr.id"
                    >
                      {{ expr.name }}
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      class="px-1.5 text-muted-foreground"
                      @click="simulatedExpressionId = ''"
                    >
                      重置
                    </Button>
                  </div>
                </div>
              </div>

              <Select v-model="bg">
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    value="checker"
                    class="text-xs"
                    >透明棋盘</SelectItem
                  >
                  <SelectItem
                    value="dark"
                    class="text-xs"
                    >暗色</SelectItem
                  >
                  <SelectItem
                    value="green"
                    class="text-xs"
                    >绿幕</SelectItem
                  >
                  <SelectItem
                    value="transparent"
                    class="text-xs"
                    >透明</SelectItem
                  >
                </SelectContent>
              </Select>

              <div
                class="preview"
                :class="`bg-${bg}`"
              >
                <PngtuberDisplay
                  :state="state"
                  :is-speaking="previewSpeaking"
                  :volume="previewVolume"
                  :expression-id="previewExpressionId"
                  :muted="previewMuted"
                  :away="previewAway"
                  inline-mode
                  @asset-error="assetError = $event"
                />
              </div>

              <Alert
                v-if="assetError"
                class="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 py-2 px-2.5"
              >
                <AlertDescription class="text-xs m-0">
                  {{ assetError }}
                </AlertDescription>
              </Alert>

              <div class="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  :disabled="controlDisabled && !isSimulating"
                  @click="isSimulating ? (simulatedMuted = !simulatedMuted) : control({ muted: !runtime.muted })"
                >
                  {{ (isSimulating ? simulatedMuted : runtime.muted) ? '取消静音' : '静音' }}
                </Button>
                <Button
                  variant="outline"
                  :disabled="controlDisabled && !isSimulating"
                  @click="isSimulating ? (simulatedAway = !simulatedAway) : control({ away: !runtime.away })"
                >
                  {{ (isSimulating ? simulatedAway : runtime.away) ? '结束暂离' : '暂离' }}
                </Button>
                <Button
                  variant="outline"
                  :disabled="controlDisabled && !isSimulating"
                  @click="isSimulating ? (simulatedExpressionId = '') : control({ expressionId: '' })"
                >
                  默认表情
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card class="p-3">
            <CardHeader class="p-0 pb-2">
              <CardTitle class="text-sm font-semibold">OBS 浏览器源</CardTitle>
            </CardHeader>
            <CardContent class="p-0 space-y-3">
              <div class="flex items-center gap-1.5">
                <Input
                  v-model="channelDraft"
                  placeholder="频道"
                  maxlength="64"
                  :disabled="busy"
                  class="flex-1"
                  @keyup.enter="changeChannel"
                />
                <Button
                  variant="secondary"
                  :disabled="busy"
                  @click="changeChannel"
                >
                  切换频道
                </Button>
              </div>

              <Input
                :value="obsUrl"
                readonly
                placeholder="登录后生成链接"
              />

              <div class="flex items-center gap-2 flex-wrap">
                <Button
                  :disabled="!obsUrl"
                  @click="copyUrl"
                >
                  复制链接
                </Button>
                <Button
                  variant="outline"
                  as-child
                  :disabled="!obsUrl"
                >
                  <a
                    :href="obsUrl || undefined"
                    target="_blank"
                    rel="noopener"
                  >
                    打开画面
                  </a>
                </Button>
                <Button
                  variant="outline"
                  as-child
                  :disabled="!obsUrl"
                >
                  <a
                    :href="obsUrl ? `${obsUrl}&debug=1` : undefined"
                    target="_blank"
                    rel="noopener"
                  >
                    OBS 诊断
                  </a>
                </Button>
              </div>

              <div class="text-xs text-muted-foreground leading-relaxed">
                浏览器源尺寸：{{ state.canvasWidth }} × {{ state.canvasHeight }}。麦克风模式请在 OBS「交互」窗口访问带
                debug=1 的链接选择设备，完成后移除 debug 参数。
              </div>
            </CardContent>
          </Card>

          <PngtuberCollabCard
            :state="state"
            :channel="channel"
            @patch="patch"
          />

          <Card class="p-3">
            <CardHeader class="p-0 pb-2">
              <CardTitle class="text-sm font-semibold">模型包</CardTitle>
            </CardHeader>
            <CardContent class="p-0 space-y-2">
              <div class="flex items-center gap-2">
                <Button
                  variant="outline"
                  :disabled="!writable || busy"
                  @click="packageInput?.click()"
                >
                  导入模型包
                </Button>
                <Button
                  variant="outline"
                  :disabled="busy || !isReady || !!normalized.error"
                  @click="exportPackage"
                >
                  导出模型包
                </Button>
                <input
                  ref="packageInput"
                  hidden
                  type="file"
                  accept=".zip,application/zip"
                  @change="importPackage"
                />
              </div>
              <div class="text-xs text-muted-foreground">导入会校验模型包并替换当前频道配置。</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pngtuber-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: var(--foreground);
  background: var(--background);
}
.pngtuber-page.standalone {
  box-sizing: border-box;
  min-height: 100dvh;
  padding: 16px 20px 32px;
}
.workbench {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(300px, 1fr);
  gap: 16px;
  color: var(--foreground);
}
@media (max-width: 900px) {
  .workbench {
    grid-template-columns: 1fr;
  }
}
.preview {
  position: relative;
  width: 100%;
  height: 280px;
  border-radius: 8px;
  border: 1px dashed var(--border);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.bg-checker {
  background-color: #1e1e24;
  background-image:
    linear-gradient(45deg, #2b2b36 25%, transparent 25%), linear-gradient(-45deg, #2b2b36 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #2b2b36 75%), linear-gradient(-45deg, transparent 75%, #2b2b36 75%);
  background-size: 16px 16px;
  background-position:
    0 0,
    0 8px,
    8px -8px,
    -8px 0;
}
.bg-dark {
  background: #09090b;
}
.bg-green {
  background: #00ff00;
}
.bg-transparent {
  background: transparent;
}
</style>
