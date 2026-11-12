<script setup lang="ts">
import ArrowReset24Regular from '@vicons/fluent/es/ArrowReset24Regular'
import ArrowSync24Filled from '@vicons/fluent/es/ArrowSync24Filled'
import Color24Filled from '@vicons/fluent/es/Color24Filled'
import Copy24Regular from '@vicons/fluent/es/Copy24Regular'
import Delete24Regular from '@vicons/fluent/es/Delete24Regular'
import Desktop24Filled from '@vicons/fluent/es/Desktop24Filled'
import Filter24Filled from '@vicons/fluent/es/Filter24Filled'
import History24Filled from '@vicons/fluent/es/History24Filled'
import Megaphone24Filled from '@vicons/fluent/es/Megaphone24Filled'
import Send24Filled from '@vicons/fluent/es/Send24Filled'
import Trophy20Regular from '@vicons/fluent/es/Trophy20Regular'
import VehicleShip20Regular from '@vicons/fluent/es/VehicleShip20Regular'
import WindowShield20Regular from '@vicons/fluent/es/WindowShield20Regular'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { getApiLiveGetAll, getApiLiveRanking } from '@/api/generated/live/live'
import type { ResponseLiveInfoModel, ResponseLiveRankingEntryModel } from '@/api/generated/model'
import { GuardLevel } from '@/api/generated/model'
import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import LabelItem from '@/apps/client/components/LabelItem.vue'
import { useGiftWindow } from '@/apps/client/store/useGiftWindow'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { ColorPicker } from '@/shared/ui/color-picker'
import { Empty } from '@/shared/ui/empty'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { Slider } from '@/shared/ui/slider'
import { Spin } from '@/shared/ui/spin'
import { Switch } from '@/shared/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

const giftWindow = useGiftWindow()

const filterOptions = [
  { label: '普通礼物', value: 'Gift' },
  { label: '醒目留言 (SC)', value: 'SC' },
  { label: '大航海 (舰长/提督/总督)', value: 'Guard' },
]

const sortOptions = [
  { label: '送礼时间', value: 'time' },
  { label: '礼物金额', value: 'price' },
  { label: '礼物数量', value: 'num' },
]

const rankViewOptions = [
  { label: '下播感谢合集', value: 'thank_summary' },
  { label: '打赏贡献榜', value: 'rank' },
  { label: '在场大航海', value: 'online_guard' },
  { label: '在线观众', value: 'online_viewers' },
]

const presets = {
  dark: {
    backgroundColor: 'rgba(20,20,30,0.85)',
    windowBackgroundColor: 'rgba(0,0,0,0)',
    textColor: '#ffffff',
    highlightColor: '#fbbf24',
  },
  warm: {
    backgroundColor: 'rgba(40,20,10,0.85)',
    windowBackgroundColor: 'rgba(20,10,5,0.3)',
    textColor: '#fff5e6',
    highlightColor: '#ff9f43',
  },
  purple: {
    backgroundColor: 'rgba(25,15,40,0.85)',
    windowBackgroundColor: 'rgba(15,5,30,0.3)',
    textColor: '#f0e6ff',
    highlightColor: '#c084fc',
  },
}

function applyPreset(preset: keyof typeof presets) {
  Object.assign(giftWindow.settings, presets[preset])
  const names = { dark: '暗黑星空', warm: '暖色流金', purple: '梦幻浅紫' } as const
  toast.success(`已应用${names[preset]}预设`)
}

function resetWindowPosition() {
  giftWindow.setPosition(0, 0)
  toast.success('窗口位置已重置至默认坐标')
}

// 实时感谢数据
const realtimeRankList = computed(() => giftWindow.getRankedList())
const realtimeGuardList = computed(() => giftWindow.getOnlineGuardList())
const realtimeViewerList = computed(() => giftWindow.getOnlineViewerList())

function getGuardTitle(level: GuardLevel): string {
  switch (level) {
    case GuardLevel.Zongdu:
      return '总督'
    case GuardLevel.Tidu:
      return '提督'
    case GuardLevel.Jianzhang:
      return '舰长'
    default:
      return ''
  }
}

function formatPaid(totalPaid: number) {
  return `¥${totalPaid.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function copyThankText() {
  const ranked = realtimeRankList.value
  const guards = realtimeGuardList.value

  const lines: string[] = []
  lines.push(`【本场打赏贡献榜 Top ${ranked.length}】`)
  if (ranked.length === 0) {
    lines.push('(暂无打赏记录)')
  } else {
    ranked.forEach((r, idx) => {
      const guardStr = r.guardLevel > 0 ? ` [${getGuardTitle(r.guardLevel)}]` : ''
      const onlineStr = r.isOnline ? ' (在场)' : ''
      lines.push(`${idx + 1}. ${r.uname} - ¥${r.score}${guardStr}${onlineStr}`)
    })
  }

  lines.push('')
  lines.push(`【在场大航海名单 (共 ${guards.length} 人)】`)
  if (guards.length === 0) {
    lines.push('(暂无在场大航海记录)')
  } else {
    guards.forEach((g) => {
      lines.push(`- ${g.uname} [${getGuardTitle(g.guardLevel)}] (${g.lastAction})`)
    })
  }

  const viewers = realtimeViewerList.value
  lines.push('')
  lines.push(`【在场陪伴与在线观众 (共 ${viewers.length} 人)】`)
  if (viewers.length === 0) {
    lines.push('(暂无在线观众数据)')
  } else {
    viewers.forEach((v) => {
      const formerStr = v.isFormerGuard ? ' [老舰长]' : ''
      const medalStr = v.medalLevel ? ` [${v.medalName || '粉丝'} Lv.${v.medalLevel}]` : ''
      lines.push(`- ${v.uname}${formerStr}${medalStr} (${v.lastAction})`)
    })
  }

  const text = lines.join('\n')
  navigator.clipboard
    .writeText(text)
    .then(() => {
      toast.success('已复制下播感谢文案至剪贴板')
    })
    .catch(() => {
      toast.error('复制到剪贴板失败')
    })
}

// 历史榜单查询
const historyLives = ref<ResponseLiveInfoModel[]>([])
const historyRanking = ref<ResponseLiveRankingEntryModel[]>([])
const selectedHistoryLiveId = ref<string | null>(null)
const isHistoryLoading = ref(false)
const isHistoryLoaded = ref(false)

const historyLiveOptions = computed(() =>
  historyLives.value.map((live) => ({
    label: `${new Date(live.startAt).toLocaleString()} · ${live.title || '未命名直播'}`,
    value: live.liveId,
  })),
)

async function loadHistoryRanking() {
  if (!selectedHistoryLiveId.value) {
    historyRanking.value = []
    return
  }

  const response = (await getApiLiveRanking({
    liveId: selectedHistoryLiveId.value,
    limit: 100,
  })) as unknown as {
    code: number
    message?: string
    data: ResponseLiveRankingEntryModel[]
  }
  if (response.code !== 200) throw new Error(response.message)
  historyRanking.value = response.data
}

async function loadHistory() {
  if (isHistoryLoading.value) return
  isHistoryLoading.value = true
  try {
    const response = (await getApiLiveGetAll()) as unknown as {
      code: number
      message?: string
      data: ResponseLiveInfoModel[]
    }
    if (response.code !== 200) throw new Error(response.message)

    historyLives.value = response.data.filter((live) => live.isFinish)
    if (!historyLives.value.some((live) => live.liveId === selectedHistoryLiveId.value)) {
      selectedHistoryLiveId.value = historyLives.value[0]?.liveId ?? null
    }
    await loadHistoryRanking()
    isHistoryLoaded.value = true
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '加载历史榜单失败')
  } finally {
    isHistoryLoading.value = false
  }
}

async function onHistoryLiveChange(val: string) {
  selectedHistoryLiveId.value = val
  try {
    await loadHistoryRanking()
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '加载历史榜单失败')
  }
}

function onTabChange(tab: string) {
  if (tab === 'history' && !isHistoryLoaded.value) void loadHistory()
}

function toggleFilterType(val: string, checked: boolean) {
  const current = giftWindow.settings.filterTypes || []
  if (checked) {
    if (!current.includes(val as any)) current.push(val as any)
  } else {
    const idx = current.indexOf(val as any)
    if (idx !== -1) current.splice(idx, 1)
  }
}
</script>

<template>
  <div class="w-full flex flex-col gap-3.5">
    <!-- 标准管理页标头 -->
    <ClientPageHeader
      title="礼物与高能榜浮窗管理"
      description="桌面半透明置顶礼物浮窗与高能排行榜，同窗口分屏或独立展示，支持实时打赏动画、在场舰长名单与下播感谢"
    >
      <template #actions>
        <Badge
          variant="success"
          class="h-6 px-2.5"
          :class="giftWindow.isGiftWindowOpen ? ' ' : 'text-muted-foreground'"
        >
          {{ giftWindow.isGiftWindowOpen ? '● 浮窗运行中' : '○ 浮窗已关闭' }}
        </Badge>

        <Button
          variant="secondary"
          :class="
            giftWindow.isGiftWindowOpen ? 'text-destructive hover:text-destructive' : 'text-primary hover:text-primary'
          "
          @click="giftWindow.isGiftWindowOpen ? giftWindow.closeWindow() : giftWindow.openWindow()"
        >
          {{ giftWindow.isGiftWindowOpen ? '关闭浮窗' : '打开浮窗' }}
        </Button>

        <div class="inline-flex rounded-md shadow-sm">
          <Button
            variant="secondary"
            class="gap-1 rounded-r-none border-r border-border"
            :disabled="!giftWindow.isGiftWindowOpen"
            @click="giftWindow.sendTestGift()"
          >
            <Send24Filled class="size-3.5 text-sky-500" />
            测试礼物
          </Button>
          <Button
            variant="secondary"
            class="gap-1 rounded-l-none"
            :disabled="!giftWindow.isGiftWindowOpen"
            @click="giftWindow.clearGifts()"
          >
            <Delete24Regular class="size-3.5 text-amber-500" />
            清空
          </Button>
        </div>
      </template>
    </ClientPageHeader>

    <!-- 统一 Segmented Tabs 导航 -->
    <Tabs
      default-value="thank"
      class="w-full gift-tabs"
      @update:model-value="onTabChange"
    >
      <TabsList class="grid w-full max-w-xl grid-cols-5">
        <TabsTrigger
          value="thank"
          class="gap-1.5"
        >
          <Megaphone24Filled class="size-3.5" />
          下播感谢
        </TabsTrigger>
        <TabsTrigger
          value="appearance"
          class="gap-1.5"
        >
          <Color24Filled class="size-3.5" />
          外观与主题
        </TabsTrigger>
        <TabsTrigger
          value="window"
          class="gap-1.5"
        >
          <Desktop24Filled class="size-3.5" />
          窗口与布局
        </TabsTrigger>
        <TabsTrigger
          value="filter"
          class="gap-1.5"
        >
          <Filter24Filled class="size-3.5" />
          筛选与规则
        </TabsTrigger>
        <TabsTrigger
          value="history"
          class="gap-1.5"
        >
          <History24Filled class="size-3.5" />
          往期榜单
        </TabsTrigger>
      </TabsList>

      <!-- 下播感谢与实时榜单 -->
      <TabsContent
        value="thank"
        class="pt-3 space-y-3 client-readable"
      >
        <Card>
          <CardHeader class="p-3 border-b flex flex-row items-center justify-between">
            <CardTitle>本场打赏前 50 ➕ 在场舰长名单</CardTitle>
            <Button
              variant="secondary"
              class="gap-1 text-primary"
              @click="copyThankText"
            >
              <Copy24Regular class="size-3.5" />
              一键复制感谢文案
            </Button>
          </CardHeader>

          <CardContent class="p-3">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- 左列: 本场打赏榜 Top 50 -->
              <div>
                <div class="flex-between mb-2">
                  <span class="font-semibold text-[13px] text-foreground flex items-center gap-1.5">
                    <Trophy20Regular class="size-4 text-amber-500" />
                    本场打赏贡献榜 (前 {{ realtimeRankList.length }} 名)
                  </span>
                  <Badge
                    variant="secondary"
                    size="xs"
                    class="text-amber-600 bg-amber-500/10"
                  >
                    上限 {{ giftWindow.settings.rankDisplayCount }} 人
                  </Badge>
                </div>

                <div class="max-h-[460px] overflow-y-auto pr-1">
                  <Empty
                    v-if="realtimeRankList.length === 0"
                    description="本场暂无打赏记录"
                    class="py-8"
                  />
                  <div
                    v-else
                    class="flex flex-col gap-1.5"
                  >
                    <div
                      v-for="(r, idx) in realtimeRankList"
                      :key="r.id"
                      class="p-2 px-3 rounded-md bg-popover border border-border transition-all duration-150 hover:border-primary"
                      :class="{ 'border-amber-500/35 bg-amber-500/5': idx < 3 }"
                    >
                      <div class="flex-between w-full">
                        <div class="flex items-center gap-2">
                          <span
                            class="w-5 font-bold text-xs text-center text-muted-foreground"
                            :class="{
                              'text-amber-500': idx === 0,
                              'text-slate-400': idx === 1,
                              'text-amber-700 dark:text-amber-600': idx === 2,
                            }"
                          >
                            {{ idx + 1 }}
                          </span>
                          <div class="relative flex-center">
                            <img
                              :src="r.uface || 'https://i0.hdslb.com/bfs/face/member/noface.jpg'"
                              referrerpolicy="no-referrer"
                              class="size-6 rounded-full object-cover"
                              alt="avatar"
                            />
                            <span
                              class="absolute -right-0.5 -bottom-0.5 size-1.75 rounded-full bg-slate-400 border-[1.5px] border-popover"
                              :class="{ 'bg-emerald-500 shadow-[0_0_4px_#22c55e]': r.isOnline }"
                              :title="r.isOnline ? '在场活跃' : '离线'"
                            />
                          </div>
                          <span class="text-xs font-semibold text-foreground">{{ r.uname }}</span>
                          <Badge
                            v-if="r.guardLevel > 0"
                            variant="outline"
                            class="text-[9px] h-4 px-1"
                            :class="
                              r.guardLevel === GuardLevel.Zongdu
                                ? 'text-destructive border-destructive/40 bg-destructive/10'
                                : r.guardLevel === GuardLevel.Tidu
                                  ? 'text-amber-600 border-amber-500/40 bg-amber-500/10'
                                  : 'text-sky-600 border-sky-500/40 bg-sky-500/10'
                            "
                          >
                            {{ getGuardTitle(r.guardLevel) }}
                          </Badge>
                        </div>

                        <div class="flex items-center gap-1.5">
                          <Badge
                            v-if="r.isOnline"
                            variant="success"
                            size="xs"
                            class="text-[9px]"
                          >
                            在场
                          </Badge>
                          <span class="text-xs font-bold text-amber-500"> ¥{{ r.score.toLocaleString() }} </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 右列: 还在直播间的在场舰长 -->
              <div>
                <div class="flex-between mb-2">
                  <span class="font-semibold text-[13px] text-foreground flex items-center gap-1.5">
                    <VehicleShip20Regular class="size-4 text-sky-500" />
                    还在直播间的舰长 ({{ realtimeGuardList.length }} 人)
                  </span>
                  <span class="text-[11px] text-muted-foreground">
                    {{ giftWindow.settings.onlineThresholdMinutes }} 分钟内有互动
                  </span>
                </div>

                <div class="max-h-[460px] overflow-y-auto pr-1">
                  <Empty
                    v-if="realtimeGuardList.length === 0"
                    description="当前暂无在场大航海观众活跃"
                    class="py-8"
                  />
                  <div
                    v-else
                    class="flex flex-col gap-1.5"
                  >
                    <div
                      v-for="g in realtimeGuardList"
                      :key="g.id"
                      class="p-2 px-3 rounded-md bg-popover border border-sky-500/30 bg-sky-500/5"
                    >
                      <div class="flex-between w-full">
                        <div class="flex items-center gap-2">
                          <Badge
                            variant="warning"
                            size="xs"
                            class="text-[9px]"
                            :class="
                              g.guardLevel === GuardLevel.Zongdu
                                ? 'text-destructive border-destructive/40 bg-destructive/10'
                                : g.guardLevel === GuardLevel.Tidu
                                  ? ' '
                                  : 'text-sky-600 border-sky-500/40 bg-sky-500/10'
                            "
                          >
                            {{ getGuardTitle(g.guardLevel) }}
                          </Badge>
                          <div class="relative flex-center">
                            <img
                              :src="g.uface || 'https://i0.hdslb.com/bfs/face/member/noface.jpg'"
                              referrerpolicy="no-referrer"
                              class="size-6 rounded-full object-cover"
                              alt="avatar"
                            />
                            <span
                              class="absolute -right-0.5 -bottom-0.5 size-1.75 rounded-full border-[1.5px] border-popover bg-emerald-500 shadow-[0_0_4px_#22c55e]"
                            />
                          </div>
                          <span class="text-xs font-semibold text-foreground">{{ g.uname }}</span>
                        </div>

                        <div class="flex items-center gap-1.5">
                          <span class="text-[11px] text-muted-foreground">
                            {{ g.lastAction }}
                          </span>
                          <Badge
                            v-if="g.rankIndex"
                            variant="warning"
                            size="xs"
                            class="text-[9px]"
                          >
                            榜 #{{ g.rankIndex }}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- 外观与主题 -->
      <TabsContent
        value="appearance"
        class="pt-3 space-y-3 client-readable"
      >
        <!-- 主题预设 -->
        <Card>
          <CardHeader class="p-3 border-b">
            <CardTitle>配色预设</CardTitle>
          </CardHeader>
          <CardContent class="p-3">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div
                class="p-3.5 rounded-md cursor-pointer border border-border flex flex-col gap-1 h-full box-border transition-all duration-200 hover:border-primary hover:-translate-y-0.5 hover:shadow-sm bg-[#14141e] text-[#fbbf24]"
                @click="applyPreset('dark')"
              >
                <div class="text-[13px] font-semibold">暗黑星空</div>
                <div class="text-[11px] opacity-75 leading-relaxed">深色沉浸背景搭配琥珀金高亮</div>
              </div>
              <div
                class="p-3.5 rounded-md cursor-pointer border border-border flex flex-col gap-1 h-full box-border transition-all duration-200 hover:border-primary hover:-translate-y-0.5 hover:shadow-sm bg-[#28140a] text-[#ff9f43]"
                @click="applyPreset('warm')"
              >
                <div class="text-[13px] font-semibold">暖色流金</div>
                <div class="text-[11px] opacity-75 leading-relaxed">暖咖质感底色搭配蜜橙重点色</div>
              </div>
              <div
                class="p-3.5 rounded-md cursor-pointer border border-border flex flex-col gap-1 h-full box-border transition-all duration-200 hover:border-primary hover:-translate-y-0.5 hover:shadow-sm bg-[#190f28] text-[#c084fc]"
                @click="applyPreset('purple')"
              >
                <div class="text-[13px] font-semibold">梦幻浅紫</div>
                <div class="text-[11px] opacity-75 leading-relaxed">神秘浅紫渐变搭配霓虹高光</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- 颜色自定义 -->
        <Card>
          <CardHeader class="p-3 border-b">
            <CardTitle>色彩调节</CardTitle>
          </CardHeader>
          <CardContent class="p-3">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div class="flex-between text-xs">
                <span class="text-muted-foreground">卡片背景色</span>
                <ColorPicker
                  v-model:value="giftWindow.settings.backgroundColor"
                  :show-alpha="true"
                />
              </div>
              <div class="flex-between text-xs">
                <span class="text-muted-foreground">窗口背景色</span>
                <ColorPicker
                  v-model:value="giftWindow.settings.windowBackgroundColor"
                  :show-alpha="true"
                />
              </div>
              <div class="flex-between text-xs">
                <span class="text-muted-foreground">文字主色</span>
                <ColorPicker
                  v-model:value="giftWindow.settings.textColor"
                  :show-alpha="true"
                />
              </div>
              <div class="flex-between text-xs">
                <span class="text-muted-foreground">金额高亮色</span>
                <ColorPicker
                  v-model:value="giftWindow.settings.highlightColor"
                  :show-alpha="true"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- 样式细节 -->
        <Card>
          <CardHeader class="p-3 border-b">
            <CardTitle>排版与细节</CardTitle>
          </CardHeader>
          <CardContent class="p-3 space-y-3">
            <div class="flex-between gap-4 text-xs">
              <span class="text-muted-foreground w-28 shrink-0">整体不透明度</span>
              <div class="flex-1 max-w-xs flex items-center gap-3">
                <Slider
                  :model-value="[giftWindow.settings.opacity]"
                  :min="0.1"
                  :max="1"
                  :step="0.05"
                  @update:model-value="giftWindow.settings.opacity = $event?.[0] ?? 1"
                />
                <span class="text-[11px] text-muted-foreground w-8 text-right tabular-nums">
                  {{ Math.round(giftWindow.settings.opacity * 100) }}%
                </span>
              </div>
            </div>

            <div class="flex-between gap-4 text-xs">
              <span class="text-muted-foreground w-28 shrink-0">字号大小 (px)</span>
              <div class="flex-1 max-w-xs flex items-center gap-3">
                <Slider
                  :model-value="[giftWindow.settings.fontSize]"
                  :min="10"
                  :max="24"
                  :step="1"
                  @update:model-value="giftWindow.settings.fontSize = $event?.[0] ?? 14"
                />
                <span class="text-[11px] text-muted-foreground w-8 text-right tabular-nums">
                  {{ giftWindow.settings.fontSize }}
                </span>
              </div>
            </div>

            <div class="flex-between gap-4 text-xs">
              <span class="text-muted-foreground w-28 shrink-0">卡片圆角 (px)</span>
              <div class="flex-1 max-w-xs flex items-center gap-3">
                <Slider
                  :model-value="[giftWindow.settings.borderRadius]"
                  :min="0"
                  :max="20"
                  :step="1"
                  @update:model-value="giftWindow.settings.borderRadius = $event?.[0] ?? 6"
                />
                <span class="text-[11px] text-muted-foreground w-8 text-right tabular-nums">
                  {{ giftWindow.settings.borderRadius }}
                </span>
              </div>
            </div>

            <div class="flex-between gap-4 text-xs">
              <span class="text-muted-foreground w-28 shrink-0">条目间距 (px)</span>
              <div class="flex-1 max-w-xs flex items-center gap-3">
                <Slider
                  :model-value="[giftWindow.settings.itemSpacing]"
                  :min="0"
                  :max="20"
                  :step="1"
                  @update:model-value="giftWindow.settings.itemSpacing = $event?.[0] ?? 6"
                />
                <span class="text-[11px] text-muted-foreground w-8 text-right tabular-nums">
                  {{ giftWindow.settings.itemSpacing }}
                </span>
              </div>
            </div>

            <Separator class="my-2" />

            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <LabelItem label="显示头像">
                <Switch v-model:checked="giftWindow.settings.showAvatar" />
              </LabelItem>
              <LabelItem label="显示金额">
                <Switch v-model:checked="giftWindow.settings.showPrice" />
              </LabelItem>
              <LabelItem label="显示时间">
                <Switch v-model:checked="giftWindow.settings.showTime" />
              </LabelItem>
              <LabelItem label="紧凑模式">
                <Switch v-model:checked="giftWindow.settings.compactMode" />
              </LabelItem>
              <LabelItem
                label="浮窗滚动条"
                description="显示极简半透明细滚动条"
              >
                <Switch v-model:checked="giftWindow.settings.showScrollbar" />
              </LabelItem>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- 窗口与布局 -->
      <TabsContent
        value="window"
        class="pt-3 space-y-3 client-readable"
      >
        <!-- 尺寸与坐标 -->
        <Card>
          <CardHeader class="p-3 border-b">
            <CardTitle>尺寸与屏幕坐标</CardTitle>
          </CardHeader>
          <CardContent class="p-3 space-y-3">
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="space-y-1">
                <span class="text-xs text-muted-foreground">宽度 (px)</span>
                <NumberField
                  :model-value="giftWindow.settings.width"
                  :min="200"
                  :max="3840"
                  class="w-full"
                  @update:model-value="giftWindow.setSize($event || 300, giftWindow.settings.height)"
                />
              </div>
              <div class="space-y-1">
                <span class="text-xs text-muted-foreground">高度 (px)</span>
                <NumberField
                  :model-value="giftWindow.settings.height"
                  :min="200"
                  :max="2160"
                  class="w-full"
                  @update:model-value="giftWindow.setSize(giftWindow.settings.width, $event || 400)"
                />
              </div>
              <div class="space-y-1">
                <span class="text-xs text-muted-foreground">X 坐标</span>
                <NumberField
                  :model-value="giftWindow.settings.x"
                  :min="0"
                  class="w-full"
                  @update:model-value="((giftWindow.settings.x = $event || 0), giftWindow.updateWindowPosition())"
                />
              </div>
              <div class="space-y-1">
                <span class="text-xs text-muted-foreground">Y 坐标</span>
                <NumberField
                  :model-value="giftWindow.settings.y"
                  :min="0"
                  class="w-full"
                  @update:model-value="((giftWindow.settings.y = $event || 0), giftWindow.updateWindowPosition())"
                />
              </div>
            </div>

            <div class="flex justify-end pt-1">
              <Button
                variant="secondary"
                class="gap-1.5"
                @click="resetWindowPosition"
              >
                <ArrowReset24Regular class="size-3.5" />
                重置至默认坐标
              </Button>
            </div>
          </CardContent>
        </Card>

        <!-- 模块展示开关 -->
        <Card>
          <CardHeader class="p-3 border-b">
            <CardTitle>同窗口展示模块</CardTitle>
          </CardHeader>
          <CardContent class="p-3 space-y-2.5">
            <LabelItem
              label="启用礼物列表"
              description="实时滚动显示观众送出的礼物、SC 与大航海"
            >
              <Switch v-model:checked="giftWindow.settings.showGiftList" />
            </LabelItem>
            <LabelItem
              label="启用高能排行榜"
              description="在同窗口内展示本场直播打赏榜与在场舰长名单"
            >
              <Switch v-model:checked="giftWindow.settings.showRanking" />
            </LabelItem>

            <div
              v-if="giftWindow.settings.showRanking"
              class="flex-between text-xs py-1 border-t pt-2"
            >
              <div class="flex flex-col gap-0.5">
                <span class="font-medium text-foreground">浮窗默认排行视图</span>
                <span class="text-[11px] text-muted-foreground">打开浮窗时默认聚焦的排行板块</span>
              </div>
              <ToggleGroup
                type="single"
                :model-value="giftWindow.settings.rankViewMode"
                @update:model-value="
                  (val) => {
                    if (val) giftWindow.settings.rankViewMode = val as any
                  }
                "
              >
                <ToggleGroupItem
                  v-for="opt in rankViewOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </CardContent>
        </Card>

        <!-- 窗口行为 -->
        <Card>
          <CardHeader class="p-3 border-b">
            <CardTitle>浮窗行为属性</CardTitle>
          </CardHeader>
          <CardContent class="p-3 space-y-2.5">
            <LabelItem
              label="总是置顶"
              description="让礼物窗口始终保持在游戏等应用程序上层"
            >
              <Switch v-model:checked="giftWindow.settings.alwaysOnTop" />
            </LabelItem>
            <LabelItem
              label="鼠标穿透 (点击忽略)"
              description="点击事件穿透到下层游戏界面，不影响直播操作"
            >
              <Switch v-model:checked="giftWindow.settings.interactive" />
            </LabelItem>
            <LabelItem
              label="防 OBS / 屏幕共享捕捉 (防抓取)"
              description="开启后 OBS 抓屏、全屏捕获与截屏工具将无法捕捉到此浮窗，防止遮挡游戏画面与隐私泄露"
            >
              <template #icon>
                <WindowShield20Regular class="size-4 text-muted-foreground" />
              </template>
              <Switch v-model:checked="giftWindow.settings.contentProtected" />
            </LabelItem>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- 筛选与规则 -->
      <TabsContent
        value="filter"
        class="pt-3 space-y-3 client-readable"
      >
        <!-- 显示类型过滤 -->
        <Card>
          <CardHeader class="p-3 border-b">
            <CardTitle>礼物类型过滤</CardTitle>
          </CardHeader>
          <CardContent class="p-3">
            <div class="flex flex-wrap gap-4 text-xs">
              <label
                v-for="opt in filterOptions"
                :key="opt.value"
                class="flex items-center gap-2 cursor-pointer"
              >
                <Checkbox
                  :checked="giftWindow.settings.filterTypes?.includes(opt.value as any)"
                  @update:checked="toggleFilterType(opt.value, $event)"
                />
                <span>{{ opt.label }}</span>
              </label>
            </div>
          </CardContent>
        </Card>

        <!-- 排序方式 -->
        <Card>
          <CardHeader class="p-3 border-b">
            <CardTitle>礼物排序方式</CardTitle>
          </CardHeader>
          <CardContent class="p-3 space-y-2.5">
            <ToggleGroup
              type="single"
              :model-value="giftWindow.settings.sortBy"
              @update:model-value="
                (val) => {
                  if (val) giftWindow.settings.sortBy = val as any
                }
              "
            >
              <ToggleGroupItem
                v-for="opt in sortOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </ToggleGroupItem>
            </ToggleGroup>
            <LabelItem label="倒序呈现 (新消息排在前面)">
              <Switch v-model:checked="giftWindow.settings.reverseOrder" />
            </LabelItem>
          </CardContent>
        </Card>

        <!-- 过滤与合并规则 -->
        <Card>
          <CardHeader class="p-3 border-b">
            <CardTitle>合并与过滤阈值</CardTitle>
          </CardHeader>
          <CardContent class="p-3 space-y-3">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div class="space-y-1">
                <span class="text-xs text-muted-foreground">最低展示金额 (金瓜子)</span>
                <NumberField
                  :model-value="giftWindow.settings.minPrice"
                  :min="0"
                  :step="100"
                  class="w-full"
                  @update:model-value="giftWindow.settings.minPrice = $event || 0"
                />
                <span class="text-[11px] text-muted-foreground block">
                  1000 金瓜子 = ¥1。设为 0 则不过滤免费或微额礼物。
                </span>
              </div>
              <div class="space-y-1">
                <span class="text-xs text-muted-foreground">合并时间窗口 (秒)</span>
                <NumberField
                  :model-value="giftWindow.settings.mergeWindowSeconds"
                  :min="0"
                  :max="60"
                  :step="5"
                  class="w-full"
                  @update:model-value="giftWindow.settings.mergeWindowSeconds = $event || 0"
                />
                <span class="text-[11px] text-muted-foreground block">
                  同一用户在此时间内送出的相同礼物自动合并为一条连击。
                </span>
              </div>
              <div class="space-y-1">
                <span class="text-xs text-muted-foreground">列表最大保留条数</span>
                <NumberField
                  :model-value="giftWindow.settings.maxItemCount"
                  :min="5"
                  :max="100"
                  class="w-full"
                  @update:model-value="giftWindow.settings.maxItemCount = $event || 50"
                />
              </div>
              <div class="space-y-1">
                <span class="text-xs text-muted-foreground">礼物自动淡出消失 (秒)</span>
                <NumberField
                  :model-value="giftWindow.settings.autoDisappearTime"
                  :min="0"
                  :max="600"
                  :step="5"
                  class="w-full"
                  @update:model-value="giftWindow.settings.autoDisappearTime = $event || 0"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- 排行榜与在场规则 -->
        <Card>
          <CardHeader class="p-3 border-b">
            <CardTitle>排行榜与在场规则</CardTitle>
          </CardHeader>
          <CardContent class="p-3 space-y-3">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div class="space-y-1">
                <span class="text-xs text-muted-foreground">排行榜显示人数上限</span>
                <NumberField
                  :model-value="giftWindow.settings.rankDisplayCount"
                  :min="5"
                  :max="200"
                  :step="10"
                  class="w-full"
                  @update:model-value="giftWindow.settings.rankDisplayCount = $event || 50"
                />
                <span class="text-[11px] text-muted-foreground block">
                  依据本场直播累计送出的付费礼物与大航海总价值计算，建议设为 50。
                </span>
              </div>
              <div class="space-y-1">
                <span class="text-xs text-muted-foreground">在场活跃判定时间 (分钟)</span>
                <NumberField
                  :model-value="giftWindow.settings.onlineThresholdMinutes"
                  :min="5"
                  :max="120"
                  :step="5"
                  class="w-full"
                  @update:model-value="giftWindow.settings.onlineThresholdMinutes = $event || 10"
                />
                <span class="text-[11px] text-muted-foreground block">
                  观众在该时间内有发言、送礼、进入或点赞即视为「还在直播间」。
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- 历史打赏榜 -->
      <TabsContent
        value="history"
        class="pt-3 space-y-3 client-readable"
      >
        <Card>
          <CardHeader class="p-3 border-b">
            <CardTitle>查询历史直播场次榜单</CardTitle>
          </CardHeader>
          <CardContent class="p-3 space-y-3">
            <div class="flex items-center gap-3">
              <div class="flex-1 min-w-[280px]">
                <Select
                  :model-value="selectedHistoryLiveId || undefined"
                  @update:model-value="onHistoryLiveChange"
                >
                  <SelectTrigger class="w-full">
                    <SelectValue placeholder="选择已结束的直播场次" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="opt in historyLiveOptions"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="secondary"
                class="gap-1.5"
                :disabled="isHistoryLoading"
                @click="loadHistory"
              >
                <ArrowSync24Filled
                  class="size-3.5"
                  :class="{ 'animate-spin': isHistoryLoading }"
                />
                刷新场次
              </Button>
            </div>

            <div
              v-if="isHistoryLoading"
              class="py-12 flex-center"
            >
              <Spin size="medium" />
            </div>

            <Empty
              v-else-if="historyRanking.length === 0"
              description="该场次暂无打赏记录"
              class="py-8"
            />

            <div
              v-else
              class="flex flex-col gap-2"
            >
              <div
                v-for="(item, index) in historyRanking"
                :key="item.ouId"
                class="p-2 px-3 rounded-md bg-popover border border-border"
              >
                <div class="flex-between">
                  <div class="flex items-center gap-2.5">
                    <span
                      class="w-5.5 font-bold text-[13px] text-center text-muted-foreground"
                      :class="{
                        'text-amber-500': index === 0,
                        'text-slate-400': index === 1,
                        'text-amber-700 dark:text-amber-600': index === 2,
                      }"
                    >
                      {{ index + 1 }}
                    </span>
                    <img
                      :src="item.uFace || 'https://i0.hdslb.com/bfs/face/member/noface.jpg'"
                      referrerpolicy="no-referrer"
                      class="size-6 rounded-full object-cover"
                      alt="avatar"
                    />
                    <span class="text-xs font-semibold text-foreground">{{ item.uName }}</span>
                  </div>
                  <Badge
                    variant="secondary"
                    class="font-bold text-amber-500"
                  >
                    {{ formatPaid(item.totalPaid) }}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  </div>
</template>
