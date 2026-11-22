<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import {
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  Layers,
  Link2,
  Rocket,
  Send,
  Sparkles,
} from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Separator } from '@/shared/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'

import type { ObsSceneDocument } from '../types'
import { buildObsScenePlayerUrl } from '../types'
import {
  buildSceneCompositionPlan,
  buildSlotBrowserSourceName,
} from '../utils/sceneSlices'

const props = withDefaults(
  defineProps<{
    open: boolean
    defaultTab?: 'obs-layout' | 'model-capture'
    doc: ObsSceneDocument
    projectName: string
    shareKey: string
    authToken?: string
    hasPublished: boolean
    hasUnpublishedChanges: boolean
    obsConnected: boolean
    vtsConnected: boolean
    publishing?: boolean
  }>(),
  {
    defaultTab: 'obs-layout',
    publishing: false,
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  openObsLink: []
  publishNow: []
  syncLayoutToObs: []
}>()

const { copy } = useClipboard()
const activeTab = ref<'obs-layout' | 'model-capture'>(props.defaultTab)
const copiedKey = ref<string | null>(null)

watch(
  () => [props.open, props.defaultTab] as const,
  ([isOpen, tab]) => {
    if (isOpen) activeTab.value = tab
  },
)

const plan = computed(() => buildSceneCompositionPlan(props.doc, props.doc.activeSceneId))
const baseSourceName = computed(() => `VTsuru - ${props.projectName || 'OBS 场景'}`)
const stackTopToBottom = computed(() => plan.value.activeStack.toReversed())

const slotMap = computed(() => {
  const map = new Map<string, { label: string; sourceName: string; url: string }>()
  if (!props.shareKey) return map
  for (const slot of plan.value.slots) {
    map.set(slot.key, {
      label: slot.label,
      sourceName: buildSlotBrowserSourceName(baseSourceName.value, slot, plan.value.mode),
      url: buildObsScenePlayerUrl(props.shareKey, undefined, props.authToken, slot.slotParam),
    })
  }
  return map
})

const unusedSlotDetails = computed(() => {
  return plan.value.unusedSlotKeys
    .map((key) => ({ key, detail: slotMap.value.get(key) }))
    .filter((x): x is { key: string; detail: { label: string; sourceName: string; url: string } } => Boolean(x.detail))
})

async function handleCopyUrl(key: string, url: string, label: string) {
  await copy(url)
  copiedKey.value = key
  toast.success(`已复制「${label}」浏览器源链接`)
  setTimeout(() => {
    if (copiedKey.value === key) copiedKey.value = null
  }, 1800)
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-2xl max-h-[86dvh] flex flex-col overflow-hidden gap-3">
      <DialogHeader class="shrink-0">
        <DialogTitle class="flex items-center gap-2">
          <BookOpen class="size-4 text-primary" />
          <span>本地模型 / OBS 分层接入指引</span>
          <Badge v-if="plan.mode === 'sliced'" variant="secondary">
            {{ plan.slots.length }} 浏览器源 + {{ plan.activeObsSources.length }} 本地源
          </Badge>
        </DialogTitle>
        <DialogDescription>
          按以下顺序即可把 VTube Studio 或任意 VTuber 模型夹在前景与背景图层之间，支持自动一键同步与纯手动配置。
        </DialogDescription>
      </DialogHeader>

      <Tabs v-model="activeTab" class="flex-1 min-h-0 flex flex-col">
        <TabsList class="w-full grid grid-cols-2 shrink-0">
          <TabsTrigger value="obs-layout">写入 OBS 分层步骤</TabsTrigger>
          <TabsTrigger value="model-capture">模型软件如何接入 OBS</TabsTrigger>
        </TabsList>

        <!-- Tab 1: 分层写入 OBS（自动 + 手动） -->
        <TabsContent value="obs-layout" class="flex-1 min-h-0 mt-3 overflow-hidden flex flex-col">
          <ScrollArea class="flex-1 min-w-0 pr-2 [&_[data-reka-scroll-area-viewport]>div]:!block">
            <div class="space-y-4 pb-1">
              <!-- 发布状态提醒 -->
              <Alert v-if="!hasPublished || hasUnpublishedChanges">
                <Rocket class="size-4" />
                <AlertDescription class="flex-between gap-2 flex-wrap">
                  <span class="text-xs">
                    {{
                      !hasPublished
                        ? '当前场景尚未发布，请先发布生效再导入 OBS。'
                        : '你有尚未发布的画布修改，发布后 OBS 浏览器源才会更新。'
                    }}
                  </span>
                  <Button size="xs" :disabled="publishing" @click="emit('publishNow')">
                    <Rocket class="size-3.5" />
                    <span>{{ publishing ? '发布中...' : '立即发布生效' }}</span>
                  </Button>
                </AlertDescription>
              </Alert>

              <!-- 方式一：自动同步 -->
              <div class="rounded-lg border border-border bg-muted/25 p-3 space-y-2.5">
                <div class="flex-between gap-2 flex-wrap">
                  <div class="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Sparkles class="size-3.5 text-primary" />
                    <span>方式一：自动一键编排（推荐）</span>
                  </div>
                  <Badge :variant="obsConnected ? 'default' : 'secondary'">
                    {{ obsConnected ? 'OBS 已连接' : 'OBS 未连接' }}
                  </Badge>
                </div>
                <p class="text-xs text-muted-foreground leading-relaxed">
                  连接本地 OBS（或运行 VTsuru 桌面客户端）后，可自动创建所需浏览器源槽位、同步模型源的位置与裁切，并排好前后遮挡顺序。
                </p>
                <div class="flex items-center gap-2 flex-wrap">
                  <Button
                    v-if="obsConnected"
                    size="xs"
                    :disabled="!hasPublished"
                    @click="emit('syncLayoutToObs')"
                  >
                    <Send class="size-3.5" />
                    <span>一键同步分层布局到 OBS</span>
                  </Button>
                  <Button
                    v-else
                    variant="secondary"
                    size="xs"
                    @click="emit('openObsLink')"
                  >
                    <Link2 class="size-3.5" />
                    <span>连接本地 OBS / 桌面客户端</span>
                  </Button>
                </div>
              </div>

              <!-- 方式二：手动添加（免 OBS WebSocket） -->
              <div class="rounded-lg border border-border bg-card p-3 space-y-3">
                <div class="flex-between gap-2 flex-wrap">
                  <div class="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Layers class="size-3.5 text-violet-500" />
                    <span>方式二：手动配置 OBS（无需 WebSocket）</span>
                  </div>
                  <span class="text-[11px] text-muted-foreground tabular-nums">
                    建议浏览器源尺寸：{{ doc.canvas.width }}×{{ doc.canvas.height }}
                  </span>
                </div>

                <p class="text-xs text-muted-foreground leading-relaxed">
                  在 OBS 的「来源」列表中，严格按照下方
                  <strong class="text-foreground font-medium">从上到下</strong>
                  的顺序摆放即可（列表中越靠上显示在越前面）：
                </p>

                <div class="space-y-1.5">
                  <div
                    v-for="(entry, idx) in stackTopToBottom"
                    :key="entry.kind === 'obs-source' ? `obs-${entry.layerId}` : `slot-${entry.slotKey}-${idx}`"
                    class="flex-between gap-2 rounded-md border px-2.5 py-2"
                    :class="
                      entry.kind === 'obs-source'
                        ? 'border-violet-500/40 bg-violet-500/10'
                        : 'border-border bg-muted/20'
                    "
                  >
                    <div class="flex items-center gap-2 min-w-0">
                      <span
                        class="w-5 h-5 rounded-full flex-center text-[11px] font-semibold shrink-0 tabular-nums"
                        :class="
                          entry.kind === 'obs-source'
                            ? 'bg-violet-500 text-white'
                            : 'bg-secondary text-secondary-foreground'
                        "
                      >
                        {{ idx + 1 }}
                      </span>
                      <div class="min-w-0">
                        <div class="text-xs font-medium text-foreground truncate">
                          {{
                            entry.kind === 'obs-source'
                              ? `你的本地源：${entry.layer.obsSource.sourceName || entry.layer.name}`
                              : `浏览器源：${slotMap.get(entry.slotKey)?.sourceName ?? entry.label}`
                          }}
                        </div>
                        <div class="text-[11px] text-muted-foreground truncate">
                          {{
                            entry.kind === 'obs-source'
                              ? '由 OBS 本地捕获（Spout2 / 游戏捕获 / 摄像头等），夹在上下浏览器源之间'
                              : `包含 ${entry.layerIds.length} 个网页图层 · 宽 ${doc.canvas.width} × 高 ${doc.canvas.height}`
                          }}
                        </div>
                      </div>
                    </div>

                    <Button
                      v-if="entry.kind === 'browser-slot' && slotMap.get(entry.slotKey)"
                      variant="outline"
                      size="xs"
                      class="shrink-0"
                      :disabled="!shareKey"
                      @click="
                        () => {
                          const target = slotMap.get(entry.slotKey)
                          if (target) void handleCopyUrl(entry.slotKey, target.url, target.label)
                        }
                      "
                    >
                      <Check v-if="copiedKey === entry.slotKey" class="size-3.5 text-emerald-500" />
                      <Copy v-else class="size-3.5" />
                      <span>{{ copiedKey === entry.slotKey ? '已复制' : '复制链接' }}</span>
                    </Button>
                    <Badge v-else-if="entry.kind === 'obs-source'" variant="secondary" class="shrink-0">
                      OBS 原生源
                    </Badge>
                  </div>
                </div>

                <!-- 跨子场景其他槽位补充 -->
                <div
                  v-if="unusedSlotDetails.length > 0"
                  class="rounded-md bg-muted/30 px-2.5 py-2 space-y-1.5"
                >
                  <div class="text-[11px] text-muted-foreground">
                    其他子场景还会用到以下浏览器源槽位（当前子场景为空透明，可一并加入 OBS 以便切场秒切）：
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    <Button
                      v-for="item in unusedSlotDetails"
                      :key="item.key"
                      variant="outline"
                      size="xs"
                      @click="handleCopyUrl(item.key, item.detail.url, item.detail.label)"
                    >
                      <Check v-if="copiedKey === item.key" class="size-3 text-emerald-500" />
                      <Copy v-else class="size-3" />
                      <span>复制「{{ item.detail.label }}」</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <!-- Tab 2: 各类 VTuber 模型软件接入 OBS 速查 -->
        <TabsContent value="model-capture" class="flex-1 min-h-0 mt-3 overflow-hidden flex flex-col">
          <ScrollArea class="flex-1 min-w-0 pr-2 [&_[data-reka-scroll-area-viewport]>div]:!block">
            <div class="space-y-3 pb-1 text-xs">
              <!-- VTube Studio -->
              <div class="rounded-lg border border-violet-500/35 bg-violet-500/5 p-3 space-y-2">
                <div class="flex-between gap-2">
                  <span class="font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles class="size-3.5 text-violet-500" />
                    <span>VTube Studio（Live2D，支持切场动作联动）</span>
                  </span>
                  <Badge :variant="vtsConnected ? 'default' : 'secondary'">
                    <CheckCircle2 v-if="vtsConnected" class="size-3 mr-1" />
                    {{ vtsConnected ? '客户端 VTS 已连' : '可选客户端联动' }}
                  </Badge>
                </div>
                <ol class="list-decimal pl-4 space-y-1 text-muted-foreground leading-relaxed">
                  <li>
                    <strong class="text-foreground font-medium">推荐 Spout2（零延迟自带透明）</strong>：在 VTS「设置 → 摄像头/输出」开启
                    <code class="px-1 py-0.5 rounded bg-muted text-foreground">Spout2</code>；OBS 安装
                    <code class="px-1 py-0.5 rounded bg-muted text-foreground">obs-spout2</code> 插件后添加「Spout2 捕获」源。
                  </li>
                  <li>
                    <strong class="text-foreground font-medium">免插件备选（游戏捕获）</strong>：VTS 背景选「色彩选取器」并勾选「OBS 透明捕获」；OBS 添加「游戏捕获 → 采集特定窗口（VTube Studio）」并勾选「允许透明度」。
                  </li>
                  <li>
                    <strong class="text-foreground font-medium">切场换机位 / 表情 / 热键</strong>：打开 VTsuru 桌面客户端在「VTube Studio」页连上 VTS，回到右侧属性面板即可直接选预设、表情或热键。
                  </li>
                </ol>
              </div>

              <!-- 3D / 其他 Live2D -->
              <div class="rounded-lg border border-border bg-card p-3 space-y-1.5">
                <div class="font-semibold text-foreground">Warudo / VSeeFace / VNyan / PrprLive / Animaze</div>
                <p class="text-muted-foreground leading-relaxed">
                  在软件内开启 Spout2 输出并在 OBS 中添加「Spout2 捕获」，或使用 OBS「游戏捕获（勾选允许透明度）」。随后在本编辑器添加「其他 VTuber 模型」图层并绑定该 OBS 源名称，即可同样实现夹心排版、裁切与透明快照预览。
                </p>
              </div>

              <!-- 桌面 PNGTuber / 绿幕 -->
              <div class="rounded-lg border border-border bg-card p-3 space-y-1.5">
                <div class="font-semibold text-foreground">Veadotube / PNGTuber Plus / 绿幕窗口捕获</div>
                <p class="text-muted-foreground leading-relaxed">
                  在 OBS 添加对应窗口/游戏捕获，若为绿幕背景请给该 OBS 源添加「色度键」滤镜（编辑器抓取的快照会自动应用 OBS 滤镜效果并呈透明）。如使用 VTsuru 站内 PNGTuber，直接在「添加元素 → OBS 组件库」添加即可，无需占用本地源。
                </p>
              </div>

              <!-- 双机 NDI / 联动嘉宾 -->
              <div class="rounded-lg border border-border bg-card p-3 space-y-1.5">
                <div class="font-semibold text-foreground">双机推流 / 联动嘉宾皮套（NDI / VDO.Ninja / 采集卡）</div>
                <p class="text-muted-foreground leading-relaxed">
                  在推流机 OBS 中先添加对应的 NDI 源、浏览器源或视频采集设备，再在本编辑器添加一个「OBS 本地源」图层并绑定该源名称，即可将其精确夹在底图和前景弹幕之间。
                </p>
              </div>

              <Separator />

              <p class="text-[11px] text-muted-foreground">
                提示：场景中允许同时放置多个本地源（例如「背景图 → 游戏画面 → 桌板遮罩 → VTS 皮套 → 前景弹幕」），系统会自动按连续区间生成最少数量的浏览器源槽位。
              </p>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>
</template>
