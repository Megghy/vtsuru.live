<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { RotateCcw, Save, Trash2 } from 'lucide-vue-next'
import { computed, ref, shallowRef, watch } from 'vue'
import { toast } from 'vue-sonner'

import { DownloadConfig, UploadConfig } from '@/api/account'
import type { EventModel } from '@/api/client-types'
import { EventDataTypes } from '@/api/generated/model'
import DanmujiRulesEditor from '@/apps/manage/components/danmuji/DanmujiRulesEditor.vue'
import DanmujiStyleEditor from '@/apps/manage/components/danmuji/DanmujiStyleEditor.vue'
import DanmujiOBS from '@/apps/obs/pages/DanmujiOBS.vue'
import { defaultDanmujiConfig, normalizeDanmujiConfig, type DanmujiConfig } from '@/shared/danmujiConfig'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { FormField } from '@/shared/ui/form-field'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Spin } from '@/shared/ui/spin'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Textarea } from '@/shared/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

import { useObsSceneEditorStore } from '../store/useObsSceneEditorStore'
import type { ObsModuleLayer } from '../types'

const props = defineProps<{
  open: boolean
  layer: ObsModuleLayer | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const store = useObsSceneEditorStore()

const stageRef = ref<HTMLElement | null>(null)
const { width: stageWidth, height: stageHeight } = useElementSize(stageRef)
const previewRef = shallowRef<InstanceType<typeof DanmujiOBS> | null>(null)

const loading = ref(false)
const saving = ref(false)
const previewReady = ref(false)
const activeTab = ref('style')
type BackdropMode = 'checker' | 'dark' | 'light'
const backdropMode = ref<BackdropMode>('checker')

const configDraft = ref<DanmujiConfig>(normalizeDanmujiConfig())
const initialSnapshotJson = ref('')

const previewWidth = computed(() => Math.max(240, props.layer?.width ?? 420))
const previewHeight = computed(() => Math.max(220, props.layer?.height ?? 680))

const autoFitScale = computed(() => {
  const availW = Math.max(120, stageWidth.value - 36)
  const availH = Math.max(120, stageHeight.value - 36)
  return Math.max(0.2, Math.min(1, availW / previewWidth.value, availH / previewHeight.value))
})

const previewShellStyle = computed(() => ({
  width: `${Math.round(previewWidth.value * autoFitScale.value)}px`,
  height: `${Math.round(previewHeight.value * autoFitScale.value)}px`,
}))

const previewFrameStyle = computed(() => ({
  width: `${previewWidth.value}px`,
  height: `${previewHeight.value}px`,
  transform: `scale(${autoFitScale.value})`,
  transformOrigin: 'top left',
}))

const hasUnsavedChanges = computed(
  () => Boolean(initialSnapshotJson.value) && JSON.stringify(configDraft.value) !== initialSnapshotJson.value,
)

const testButtons = [
  { label: '发弹幕', type: EventDataTypes.Message },
  { label: '发礼物', type: EventDataTypes.Gift },
  { label: '发 SC', type: EventDataTypes.SC },
  { label: '发舰长', type: EventDataTypes.Guard },
] as const

const sampleTexts = [
  '晚上好呀！今天直播间的排版和配色好好看！',
  '前排打卡，今天唱什么歌呀~',
  '666666 这段操作太丝滑了！',
  '这是一条较长的测试弹幕，用来检查换行、行距和气泡宽度表现。',
]
let sampleSeq = 0

async function sendTest(type: EventDataTypes) {
  if (!previewRef.value) return
  const idx = sampleSeq++
  const event: Partial<EventModel> & { type: EventDataTypes } = {
    type,
    uid: 10000 + (idx % 90000),
    open_id: 'preview',
    uname: type === EventDataTypes.SC ? '云端守望者' : type === EventDataTypes.Guard ? '星月旅人' : `测试观众${(idx % 9) + 1}`,
    uface: 'https://i0.hdslb.com/bfs/face/member/noface.jpg',
    msg: type === EventDataTypes.Gift ? '小花花' : sampleTexts[idx % sampleTexts.length],
    price: type === EventDataTypes.Gift ? 5200 : type === EventDataTypes.SC ? 50 : 0,
    num: type === EventDataTypes.Gift ? 3 : 1,
    guard_level: type === EventDataTypes.Guard ? 3 : 0,
    fans_medal_level: 21,
    fans_medal_name: '测试牌',
    time: Date.now() / 1000,
  }
  await previewRef.value.pushTestEvent(event)
}

async function onPreviewReady() {
  previewReady.value = true
  await sendTest(EventDataTypes.Message)
  await sendTest(EventDataTypes.Gift)
  await sendTest(EventDataTypes.SC)
  await sendTest(EventDataTypes.Guard)
}

function clearPreviewMessages() {
  previewRef.value?.clearMessages()
}

function resetRules() {
  const currentStyle = structuredClone(configDraft.value.style)
  configDraft.value = {
    ...normalizeDanmujiConfig(defaultDanmujiConfig),
    style: currentStyle,
  }
}

async function loadCloudConfig() {
  loading.value = true
  previewReady.value = false
  try {
    const result = await DownloadConfig<unknown>('danmuji-config')
    const base =
      result.status === 'success' && result.data
        ? normalizeDanmujiConfig(result.data)
        : normalizeDanmujiConfig()

    // 若当前图层上已有快捷样式覆盖，同步显示为初始草稿便于统一保存
    if (props.layer) {
      const mod = props.layer.module
      if (mod.danmujiPreset) base.style.preset = mod.danmujiPreset
      if (typeof mod.danmujiFontSize === 'number') base.style.fontSize = mod.danmujiFontSize
      if (typeof mod.danmujiFontFamily === 'string') base.style.fontFamily = mod.danmujiFontFamily
      if (typeof mod.danmujiOpacity === 'number') base.style.opacity = mod.danmujiOpacity
      if (typeof mod.danmujiReverse === 'boolean') base.style.reverse = mod.danmujiReverse
      if (typeof mod.danmujiPinned === 'boolean') base.style.pinned = mod.danmujiPinned
      if (typeof mod.danmujiAutoHide === 'number') base.style.autoHide = mod.danmujiAutoHide
      if (typeof mod.danmujiPinnedMinPrice === 'number') base.style.pinnedMinPrice = mod.danmujiPinnedMinPrice
    }

    configDraft.value = base
    initialSnapshotJson.value = JSON.stringify(base)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '加载弹幕机配置失败')
  } finally {
    loading.value = false
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      void loadCloudConfig()
    } else {
      previewReady.value = false
    }
  },
)

async function handleSave() {
  const snapshot = JSON.stringify(configDraft.value)
  if (new TextEncoder().encode(snapshot).byteLength > 512 * 1024) {
    toast.error('配置超过 512 KiB（UTF-8），请精简自定义 CSS 后重试')
    return
  }

  saving.value = true
  try {
    const ok = await UploadConfig('danmuji-config', JSON.parse(snapshot))
    if (!ok) {
      throw new Error('保存弹幕机配置失败')
    }
    initialSnapshotJson.value = snapshot
    // 同步图层上的快捷外观参数，让画布预览与播出链接与云端配置一致
    if (props.layer) {
      const st = configDraft.value.style
      props.layer.module.danmujiPreset = st.preset
      props.layer.module.danmujiFontSize = st.fontSize
      props.layer.module.danmujiFontFamily = st.fontFamily || undefined
      props.layer.module.danmujiOpacity = st.opacity
      props.layer.module.danmujiReverse = st.reverse
      props.layer.module.danmujiPinned = st.pinned
      props.layer.module.danmujiAutoHide = st.autoHide
      props.layer.module.danmujiPinnedMinPrice = st.pinnedMinPrice
      store.pushHistory()
    }
    toast.success('弹幕机样式与规则已保存，OBS 将在 5 秒内同步')
    emit('update:open', false)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <DialogContent class="w-[calc(100%-2rem)] max-w-5xl h-[84dvh] max-h-[780px] p-0 flex flex-col overflow-hidden gap-0">
      <DialogHeader class="px-5 py-3 border-b border-border shrink-0 pr-12">
        <DialogTitle class="flex items-center gap-2 text-sm">
          <span>弹幕机样式与规则设置</span>
          <Badge
            variant="outline"
            class="tabular-nums font-normal"
          >
            {{ previewWidth }} × {{ previewHeight }}
          </Badge>
        </DialogTitle>
        <DialogDescription class="text-xs">
          左侧与 OBS 播出使用同一套实时渲染引擎，可发送测试弹幕 / 礼物 / SC 即时检验外观与自定义 CSS。
        </DialogDescription>
      </DialogHeader>

      <div class="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        <!-- 左侧：真实 DanmujiOBS 实时预览 -->
        <div class="flex-1 min-w-0 min-h-[260px] flex flex-col border-b md:border-b-0 md:border-r border-border overflow-hidden">
          <div class="flex-between gap-2 px-3 py-2 border-b border-border/70 bg-card/70 shrink-0 flex-wrap">
            <ToggleGroup
              :model-value="backdropMode"
              type="single"
              size="xs"
              @update:model-value="(v) => { if (v) backdropMode = v as BackdropMode }"
            >
              <ToggleGroupItem value="checker">透明底</ToggleGroupItem>
              <ToggleGroupItem value="dark">深色</ToggleGroupItem>
              <ToggleGroupItem value="light">浅色</ToggleGroupItem>
            </ToggleGroup>

            <span class="text-[11px] text-muted-foreground tabular-nums">
              缩放 {{ Math.round(autoFitScale * 100) }}%
            </span>
          </div>

          <div
            ref="stageRef"
            class="flex-1 min-h-0 p-4 flex-center overflow-hidden"
            :class="{
              'dm-preview-checker': backdropMode === 'checker',
              'bg-slate-950': backdropMode === 'dark',
              'bg-slate-100': backdropMode === 'light',
            }"
          >
            <div
              class="relative shrink-0 outline-1 outline-dashed outline-slate-400/40"
              :style="previewShellStyle"
            >
              <div
                class="absolute inset-0 overflow-hidden"
                :class="{ 'dm-preview-no-shadow': layer?.disableShadow }"
                :style="previewFrameStyle"
              >
                <DanmujiOBS
                  v-if="open && !loading"
                  ref="previewRef"
                  preview
                  :config="configDraft"
                  @ready="onPreviewReady"
                />
              </div>
            </div>
          </div>

          <!-- 底部测试事件条 -->
          <div class="flex-between gap-2 px-3 py-2 border-t border-border/70 bg-card/70 shrink-0 flex-wrap">
            <div class="flex items-center gap-1.5 flex-wrap">
              <Button
                v-for="item in testButtons"
                :key="item.type"
                size="xs"
                variant="outline"
                :disabled="!previewReady"
                @click="sendTest(item.type)"
              >
                {{ item.label }}
              </Button>
            </div>
            <Button
              size="xs"
              variant="ghost"
              :disabled="!previewReady"
              @click="clearPreviewMessages"
            >
              <Trash2 class="size-3.5" />
              <span>清空</span>
            </Button>
          </div>
        </div>

        <!-- 右侧：外观 / 规则 / 自定义 CSS -->
        <div class="w-full md:w-[390px] shrink-0 h-[48%] md:h-full min-h-0 flex flex-col bg-card overflow-hidden">
          <div
            v-if="loading"
            class="flex-1 flex-center"
          >
            <Spin />
          </div>
          <Tabs
            v-else
            v-model="activeTab"
            class="flex-1 min-h-0 flex flex-col overflow-hidden"
          >
            <div class="px-4 pt-3 shrink-0">
              <TabsList class="w-full grid grid-cols-3">
                <TabsTrigger value="style">外观样式</TabsTrigger>
                <TabsTrigger value="rules">过滤规则</TabsTrigger>
                <TabsTrigger value="css">自定义 CSS</TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea class="flex-1 min-w-0 [&_[data-reka-scroll-area-viewport]>div]:!block">
              <div class="p-4">
                <TabsContent
                  value="style"
                  class="mt-0"
                >
                  <DanmujiStyleEditor v-model="configDraft.style" />
                </TabsContent>

                <TabsContent
                  value="rules"
                  class="mt-0"
                >
                  <DanmujiRulesEditor
                    v-model="configDraft"
                    @reset="resetRules"
                  />
                </TabsContent>

                <TabsContent
                  value="css"
                  class="mt-0 space-y-3"
                >
                  <FormField
                    label="附加自定义 CSS"
                    description="将在预设样式之后注入，用于覆盖字体、气泡圆角或动画。"
                  >
                    <Textarea
                      v-model="configDraft.style.customCss"
                      rows="14"
                      class="font-mono text-xs"
                      placeholder="/* 例如：yt-live-chat-text-message-renderer { ... } */"
                    />
                  </FormField>
                  <Button
                    variant="outline"
                    size="xs"
                    :disabled="!configDraft.style.customCss"
                    @click="configDraft.style.customCss = ''"
                  >
                    <RotateCcw class="size-3.5" />
                    <span>清空自定义 CSS</span>
                  </Button>
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        </div>
      </div>

      <footer class="flex-between gap-2 px-5 py-3 border-t border-border bg-card shrink-0">
        <span class="text-xs text-muted-foreground">
          {{ hasUnsavedChanges ? '存在未保存的修改' : '当前配置与云端一致' }}
        </span>
        <div class="flex items-center gap-2">
          <Button
            variant="ghost"
            :disabled="saving"
            @click="emit('update:open', false)"
          >
            取消
          </Button>
          <Button
            :disabled="loading || saving"
            @click="handleSave"
          >
            <Save class="size-3.5" />
            <span>{{ saving ? '保存中...' : '保存并同步' }}</span>
          </Button>
        </div>
      </footer>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.dm-preview-checker {
  background-color: #0f172a;
  background-image:
    linear-gradient(45deg, rgba(255, 255, 255, 0.05) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(255, 255, 255, 0.05) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.05) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.05) 75%);
  background-size: 20px 20px;
  background-position:
    0 0,
    0 10px,
    10px -10px,
    -10px 0;
}

.dm-preview-no-shadow :deep(*) {
  box-shadow: none !important;
  text-shadow: none !important;
}
</style>
