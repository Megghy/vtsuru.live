<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { saveAs } from 'file-saver'
import { ArrowLeft24Regular } from '@vicons/fluent'
import { computed, onActivated, onDeactivated, onScopeDispose, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import { OBS_SYNC_CHANNEL_HINT, parseObsSyncChannel, resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import { exportPngtuberPackage, importPngtuberPackage } from '@/shared/pngtuber/modelPackage'
import { normalizePngtuberState } from '@/shared/pngtuber/normalize'
import { DEFAULT_PNGTUBER_STATE } from '@/shared/pngtuber/types'
import type { PngtuberExpression, PngtuberRuntime, PngtuberState } from '@/shared/pngtuber/types'
import { usePngtuberRuntime } from '@/shared/pngtuber/usePngtuberRuntime'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'

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
const previewVolume = computed(() => (localInput.value ? localVolume.value : runtime.value.volume))
const previewSpeaking = computed(() => (localInput.value ? localSpeaking.value : runtime.value.isSpeaking))
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
      variant="ghost"
      size="sm"
      class="w-fit gap-1.5 h-8 text-xs"
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
        <AlertDescription class="text-xs text-current m-0">
          请登录后编辑立绘配置。
        </AlertDescription>
      </Alert>
      <Alert
        v-else-if="lastSyncError || !isReady || runtimeError || !connected || normalized.error"
        class="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 py-2.5 px-3"
      >
        <div class="flex items-center justify-between gap-2">
          <AlertDescription class="text-xs text-current m-0">
            {{ normalized.error || errorMessage || runtimeError || (!isReady ? '配置尚未加载完成' : '立绘控制连接尚未就绪') }}
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
            <CardHeader class="p-0 pb-2">
              <CardTitle class="text-sm font-semibold">实时预览</CardTitle>
            </CardHeader>
            <CardContent class="p-0 space-y-3">
              <div class="flex items-center gap-2 flex-wrap">
                <Badge
                  :variant="previewSpeaking ? 'default' : 'secondary'"
                  class="text-xs"
                >
                  {{ runtime.away ? '暂离' : runtime.muted ? '静音' : previewSpeaking ? '说话中' : '待机' }}
                </Badge>
                <Badge variant="outline" class="text-xs">
                  {{ isSyncing ? '保存中' : lastSyncError ? '保存失败' : isReady ? '配置已就绪' : '加载中' }}
                </Badge>
                <span class="text-xs text-muted-foreground">音量 {{ Math.round(previewVolume) }}%</span>
              </div>

              <Select v-model="bg">
                <SelectTrigger class="h-8 text-xs w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checker" class="text-xs">透明棋盘</SelectItem>
                  <SelectItem value="dark" class="text-xs">暗色</SelectItem>
                  <SelectItem value="green" class="text-xs">绿幕</SelectItem>
                  <SelectItem value="transparent" class="text-xs">透明</SelectItem>
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
                  :expression-id="runtime.expressionId"
                  :muted="runtime.muted"
                  :away="runtime.away"
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
                  size="sm"
                  variant="outline"
                  class="h-8 text-xs"
                  :disabled="controlDisabled"
                  @click="control({ muted: !runtime.muted })"
                >
                  {{ runtime.muted ? '取消静音' : '静音' }}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  class="h-8 text-xs"
                  :disabled="controlDisabled"
                  @click="control({ away: !runtime.away })"
                >
                  {{ runtime.away ? '结束暂离' : '暂离' }}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  class="h-8 text-xs"
                  :disabled="controlDisabled"
                  @click="control({ expressionId: '' })"
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
                  class="h-8 text-xs flex-1"
                  @keyup.enter="changeChannel"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  class="h-8 text-xs"
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
                class="h-8 text-xs"
              />

              <div class="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  class="h-8 text-xs"
                  :disabled="!obsUrl"
                  @click="copyUrl"
                >
                  复制链接
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  class="h-8 text-xs"
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
                  size="sm"
                  variant="outline"
                  class="h-8 text-xs"
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

          <Card class="p-3">
            <CardHeader class="p-0 pb-2">
              <CardTitle class="text-sm font-semibold">模型包</CardTitle>
            </CardHeader>
            <CardContent class="p-0 space-y-2">
              <div class="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  class="h-8 text-xs"
                  :disabled="!writable || busy"
                  @click="packageInput?.click()"
                >
                  导入模型包
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  class="h-8 text-xs"
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
              <div class="text-xs text-muted-foreground">
                导入会校验模型包并替换当前频道配置。
              </div>
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
    linear-gradient(45deg, #2b2b36 25%, transparent 25%),
    linear-gradient(-45deg, #2b2b36 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #2b2b36 75%),
    linear-gradient(-45deg, transparent 75%, #2b2b36 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
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
