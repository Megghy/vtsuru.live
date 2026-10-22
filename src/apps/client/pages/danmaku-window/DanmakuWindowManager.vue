<script setup lang="ts">
import {
  ArrowReset24Regular,
  Color24Filled,
  Delete24Regular,
  Desktop24Filled,
  Eye20Regular,
  EyeOff20Regular,
  Filter24Filled,
  Payment20Regular,
  PeopleCommunity20Regular,
  Send24Filled,
  ThumbLike20Regular,
  WindowShield20Regular,
} from '@vicons/fluent'
import { ref } from 'vue'
import { toast } from 'vue-sonner'

import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import LabelItem from '@/apps/client/components/LabelItem.vue'
import { useDanmakuWindow } from '@/apps/client/store/useDanmakuWindow'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { ColorPicker } from '@/shared/ui/color-picker'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Slider } from '@/shared/ui/slider'
import { Switch } from '@/shared/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { useLiveEmoji } from '@/store/useLiveEmoji'

const danmakuWindow = useDanmakuWindow()
const liveEmoji = useLiveEmoji()
const emojiLoading = ref(false)

async function reloadEmoji() {
  emojiLoading.value = true
  try {
    await liveEmoji.refresh()
    toast.success('表情数据已重新加载')
  } finally {
    emojiLoading.value = false
  }
}

const filterTypeOptions = [
  { label: '弹幕消息', value: 'Message' },
  { label: '礼物通知', value: 'Gift' },
  { label: '醒目留言 (SC)', value: 'SC' },
  { label: '大航海 (舰长)', value: 'Guard' },
  { label: '进场欢迎', value: 'Enter' },
  { label: '点赞互动', value: 'Like' },
]

const displayStyleOptions = [
  { label: '卡片风格', value: 'card' },
  { label: '纯文本风格', value: 'text' },
]

const separatorOptions = [
  { label: ': (冒号+空格)', value: ': ' },
  { label: '：(中文冒号)', value: '：' },
  { label: '> ', value: '> ' },
  { label: '| ', value: '| ' },
  { label: '- ', value: '- ' },
  { label: '→ ', value: '→ ' },
]

const presets = {
  dark: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    windowBackgroundColor: 'rgba(0,0,0,0)',
    textColor: '#ffffff',
    shadowColor: 'rgba(0,0,0,0.7)',
    enableShadow: true,
    borderRadius: 8,
    opacity: 0.95,
  },
  light: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    windowBackgroundColor: 'rgba(0,0,0,0)',
    textColor: '#333333',
    shadowColor: 'rgba(0,0,0,0.2)',
    enableShadow: true,
    borderRadius: 8,
    opacity: 0.95,
  },
  transparent: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    windowBackgroundColor: 'rgba(0,0,0,0)',
    textColor: '#ffffff',
    shadowColor: 'rgba(0,0,0,0.0)',
    enableShadow: false,
    borderRadius: 8,
    opacity: 0.9,
  },
}

function applyPreset(preset: keyof typeof presets) {
  const data = presets[preset]
  Object.assign(danmakuWindow.danmakuWindowSetting, data)
  const names = { dark: '暗黑', light: '明亮', transparent: '透明' } as const
  toast.success(`已应用${names[preset]}主题预设`)
}

function resetWindowPosition() {
  danmakuWindow.setDanmakuWindowPosition(0, 0)
  toast.success('窗口位置已重置至默认坐标')
}

function toggleFilterType(val: string, checked: boolean) {
  const current = danmakuWindow.danmakuWindowSetting.filterTypes || []
  if (checked) {
    if (!current.includes(val)) current.push(val)
  } else {
    const idx = current.indexOf(val)
    if (idx !== -1) current.splice(idx, 1)
  }
}
</script>

<template>
  <div class="danmaku-manage-view flex flex-col gap-3.5">
    <!-- 标准管理页标头 -->
    <ClientPageHeader
      title="弹幕机浮窗管理"
      description="桌面半透明置顶弹幕机，支持高自由度外观、穿透、卡片/纯文本样式与智能过滤"
    >
      <template #actions>
        <Badge
          variant="outline"
          class="text-xs h-6 px-2.5"
          :class="
            danmakuWindow.isDanmakuWindowOpen
              ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10'
              : 'text-muted-foreground'
          "
        >
          {{ danmakuWindow.isDanmakuWindowOpen ? '● 浮窗运行中' : '○ 浮窗已关闭' }}
        </Badge>

        <Button
          variant="secondary"
          :class="
            danmakuWindow.isDanmakuWindowOpen
              ? 'text-destructive hover:text-destructive'
              : 'text-primary hover:text-primary'
          "
          @click="danmakuWindow.isDanmakuWindowOpen ? danmakuWindow.closeWindow() : danmakuWindow.openWindow()"
        >
          {{ danmakuWindow.isDanmakuWindowOpen ? '关闭浮窗' : '打开浮窗' }}
        </Button>

        <div class="inline-flex rounded-md shadow-sm">
          <Button
            variant="secondary"
            class="gap-1 rounded-r-none border-r border-border"
            :disabled="!danmakuWindow.isDanmakuWindowOpen"
            @click="danmakuWindow.sendTestDanmaku()"
          >
            <Send24Filled class="size-3.5 text-sky-500" />
            测试弹幕
          </Button>
          <Button
            variant="secondary"
            class="gap-1 rounded-l-none"
            :disabled="!danmakuWindow.isDanmakuWindowOpen"
            @click="danmakuWindow.clearAllDanmaku()"
          >
            <Delete24Regular class="size-3.5 text-amber-500" />
            清空
          </Button>
        </div>
      </template>
    </ClientPageHeader>

    <!-- 统一 Segmented Tabs 导航 -->
    <Tabs
      default-value="appearance"
      class="w-full danmaku-tabs"
    >
      <TabsList class="grid w-full max-w-sm grid-cols-3">
        <TabsTrigger
          value="appearance"
          class="text-xs gap-1.5"
        >
          <Color24Filled class="size-3.5" />
          外观与预设
        </TabsTrigger>
        <TabsTrigger
          value="window"
          class="text-xs gap-1.5"
        >
          <Desktop24Filled class="size-3.5" />
          窗口与行为
        </TabsTrigger>
        <TabsTrigger
          value="filter"
          class="text-xs gap-1.5"
        >
          <Filter24Filled class="size-3.5" />
          过滤与元素
        </TabsTrigger>
      </TabsList>

      <!-- 外观与预设 -->
      <TabsContent
        value="appearance"
        class="pt-3 space-y-3 client-readable"
      >
        <!-- 快速主题预设 -->
        <Card class="border bg-card">
          <CardHeader class="p-3 pb-2 border-b">
            <CardTitle class="text-sm font-semibold">主题预设</CardTitle>
          </CardHeader>
          <CardContent class="p-3">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div
                class="preset-card preset-card--dark"
                @click="applyPreset('dark')"
              >
                <div class="preset-name">暗黑</div>
                <div class="preset-desc">高对比暗色气泡，适合各类游戏背景</div>
              </div>
              <div
                class="preset-card preset-card--light"
                @click="applyPreset('light')"
              >
                <div class="preset-name">明亮</div>
                <div class="preset-desc">温润浅底灰字，高清晰度可读性</div>
              </div>
              <div
                class="preset-card preset-card--transparent"
                @click="applyPreset('transparent')"
              >
                <div class="preset-name">透明</div>
                <div class="preset-desc">超低透明背景，零视觉遮挡</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- 呈现风格 -->
        <Card class="border bg-card">
          <CardHeader class="p-3 pb-2 border-b">
            <CardTitle class="text-sm font-semibold">呈现模式</CardTitle>
          </CardHeader>
          <CardContent class="p-3 space-y-3">
            <div class="inline-flex rounded-md border border-input p-0.5 bg-background text-muted-foreground">
              <button
                v-for="opt in displayStyleOptions"
                :key="opt.value"
                type="button"
                class="px-3 py-1 text-xs font-medium rounded-sm transition-all"
                :class="
                  danmakuWindow.danmakuWindowSetting.displayStyle === opt.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'hover:text-foreground'
                "
                @click="danmakuWindow.danmakuWindowSetting.displayStyle = opt.value as any"
              >
                {{ opt.label }}
              </button>
            </div>

            <template v-if="danmakuWindow.danmakuWindowSetting.displayStyle === 'text'">
              <div class="flex flex-col gap-2 pt-2 border-t">
                <LabelItem label="紧凑文本排版">
                  <Switch v-model:checked="danmakuWindow.danmakuWindowSetting.textStyleCompact" />
                </LabelItem>
                <LabelItem label="显示消息类型角标">
                  <Switch v-model:checked="danmakuWindow.danmakuWindowSetting.textStyleShowType" />
                </LabelItem>
                <div class="flex items-center justify-between text-xs py-1">
                  <span class="text-muted-foreground">用户名分隔符</span>
                  <div class="w-44">
                    <Select v-model="danmakuWindow.danmakuWindowSetting.textStyleNameSeparator">
                      <SelectTrigger class="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="opt in separatorOptions"
                          :key="opt.value"
                          :value="opt.value"
                          class="text-xs"
                        >
                          {{ opt.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </template>
          </CardContent>
        </Card>

        <!-- 顶部实时数据状态栏 -->
        <Card class="border bg-card">
          <CardHeader class="p-3 pb-2 border-b flex flex-row items-center justify-between">
            <CardTitle class="text-sm font-semibold">顶部实时数据状态栏</CardTitle>
            <Switch v-model:checked="danmakuWindow.danmakuWindowSetting.showStatusBar" />
          </CardHeader>
          <CardContent class="p-3">
            <template v-if="danmakuWindow.danmakuWindowSetting.showStatusBar !== false">
              <div class="flex flex-col gap-2.5">
                <LabelItem
                  label="显示观看人数"
                  description="直播间累计观看人次"
                >
                  <template #icon>
                    <Eye20Regular class="size-4 text-muted-foreground" />
                  </template>
                  <Switch v-model:checked="danmakuWindow.danmakuWindowSetting.showWatchedCount" />
                </LabelItem>

                <LabelItem
                  label="显示点赞互动数"
                  description="本场直播累计点赞次数"
                >
                  <template #icon>
                    <ThumbLike20Regular class="size-4 text-muted-foreground" />
                  </template>
                  <Switch v-model:checked="danmakuWindow.danmakuWindowSetting.showLikeCount" />
                </LabelItem>

                <LabelItem
                  label="显示本场收益金额"
                  description="付费礼物、SC 与大航海汇总金额"
                >
                  <template #icon>
                    <Payment20Regular class="size-4 text-muted-foreground" />
                  </template>
                  <Switch v-model:checked="danmakuWindow.danmakuWindowSetting.showIncome" />
                </LabelItem>

                <LabelItem
                  v-if="danmakuWindow.danmakuWindowSetting.showIncome !== false"
                  label="脱敏隐藏金额"
                  description="金额显示为 ¥ ***，防止直播投屏或录屏时泄露收益"
                >
                  <template #icon>
                    <EyeOff20Regular class="size-4 text-muted-foreground" />
                  </template>
                  <Switch v-model:checked="danmakuWindow.danmakuWindowSetting.hideIncomeAmount" />
                </LabelItem>

                <LabelItem
                  label="显示在线人数"
                  description="在线观众人数（未获取时为活跃互动人数）"
                >
                  <template #icon>
                    <PeopleCommunity20Regular class="size-4 text-muted-foreground" />
                  </template>
                  <Switch v-model:checked="danmakuWindow.danmakuWindowSetting.showOnlineCount" />
                </LabelItem>

                <div class="flex items-center justify-between gap-3 pt-2 mt-1 border-t border-dashed text-xs">
                  <span class="text-muted-foreground">
                    当前统计：观看 {{ danmakuWindow.liveStats.watchedText || danmakuWindow.liveStats.watchedCount }} ｜
                    点赞 {{ danmakuWindow.liveStats.likeCount }} ｜ 收益 ¥{{ danmakuWindow.liveStats.totalIncome }} ｜
                    在线 {{ danmakuWindow.liveStats.onlineCount }} 人
                  </span>
                  <Button
                    size="xs"
                    variant="secondary"
                    class="h-6 text-[11px] gap-1 shrink-0"
                    @click="
                      danmakuWindow.resetLiveStats()
                      toast.success('实时统计数据已重置')
                    "
                  >
                    <ArrowReset24Regular class="size-3" />
                    重置统计
                  </Button>
                </div>
              </div>
            </template>
            <template v-else>
              <span class="text-xs text-muted-foreground">
                开启后将在弹幕窗口顶部展示观看人数、点赞数、收益和在线人数状态栏（支持一键隐藏金额）
              </span>
            </template>
          </CardContent>
        </Card>

        <!-- 色彩调节 -->
        <Card class="border bg-card">
          <CardHeader class="p-3 pb-2 border-b">
            <CardTitle class="text-sm font-semibold">色彩与透明度</CardTitle>
          </CardHeader>
          <CardContent class="p-3">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div class="flex items-center justify-between text-xs">
                <span class="text-muted-foreground">气泡背景色</span>
                <ColorPicker
                  v-model:value="danmakuWindow.danmakuWindowSetting.backgroundColor"
                  :show-alpha="true"
                />
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="text-muted-foreground">窗口底色</span>
                <ColorPicker
                  v-model:value="danmakuWindow.danmakuWindowSetting.windowBackgroundColor"
                  :show-alpha="true"
                />
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="text-muted-foreground">弹幕文字色</span>
                <ColorPicker
                  v-model:value="danmakuWindow.danmakuWindowSetting.textColor"
                  :show-alpha="true"
                />
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="text-muted-foreground">文字阴影色</span>
                <ColorPicker
                  v-model:value="danmakuWindow.danmakuWindowSetting.shadowColor"
                  :show-alpha="true"
                  :disabled="!danmakuWindow.danmakuWindowSetting.enableShadow"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- 字体与排版细项 -->
        <Card class="border bg-card">
          <CardHeader class="p-3 pb-2 border-b">
            <CardTitle class="text-sm font-semibold">排版细项</CardTitle>
          </CardHeader>
          <CardContent class="p-3 space-y-3">
            <div class="flex items-center justify-between gap-4 text-xs">
              <span class="text-muted-foreground w-28 shrink-0">整体不透明度</span>
              <div class="flex-1 max-w-xs flex items-center gap-3">
                <Slider
                  :model-value="[danmakuWindow.danmakuWindowSetting.opacity]"
                  :min="0.1"
                  :max="1"
                  :step="0.05"
                  @update:model-value="danmakuWindow.danmakuWindowSetting.opacity = $event?.[0] ?? 1"
                />
                <span class="text-[11px] text-muted-foreground w-8 text-right tabular-nums">
                  {{ Math.round(danmakuWindow.danmakuWindowSetting.opacity * 100) }}%
                </span>
              </div>
            </div>

            <div class="flex items-center justify-between gap-4 text-xs">
              <span class="text-muted-foreground w-28 shrink-0">字体大小 (px)</span>
              <div class="flex-1 max-w-xs flex items-center gap-3">
                <Slider
                  :model-value="[danmakuWindow.danmakuWindowSetting.fontSize]"
                  :min="10"
                  :max="24"
                  :step="1"
                  @update:model-value="danmakuWindow.danmakuWindowSetting.fontSize = $event?.[0] ?? 14"
                />
                <span class="text-[11px] text-muted-foreground w-8 text-right tabular-nums">
                  {{ danmakuWindow.danmakuWindowSetting.fontSize }}
                </span>
              </div>
            </div>

            <div class="flex items-center justify-between gap-4 text-xs">
              <span class="text-muted-foreground w-28 shrink-0">气泡圆角 (px)</span>
              <div class="flex-1 max-w-xs flex items-center gap-3">
                <Slider
                  :model-value="[danmakuWindow.danmakuWindowSetting.borderRadius]"
                  :min="0"
                  :max="20"
                  :step="1"
                  @update:model-value="danmakuWindow.danmakuWindowSetting.borderRadius = $event?.[0] ?? 8"
                />
                <span class="text-[11px] text-muted-foreground w-8 text-right tabular-nums">
                  {{ danmakuWindow.danmakuWindowSetting.borderRadius }}
                </span>
              </div>
            </div>

            <div class="flex items-center justify-between gap-4 text-xs">
              <span class="text-muted-foreground w-28 shrink-0">条目间距 (px)</span>
              <div class="flex-1 max-w-xs flex items-center gap-3">
                <Slider
                  :model-value="[danmakuWindow.danmakuWindowSetting.itemSpacing]"
                  :min="0"
                  :max="24"
                  :step="1"
                  @update:model-value="danmakuWindow.danmakuWindowSetting.itemSpacing = $event?.[0] ?? 6"
                />
                <span class="text-[11px] text-muted-foreground w-8 text-right tabular-nums">
                  {{ danmakuWindow.danmakuWindowSetting.itemSpacing }}
                </span>
              </div>
            </div>

            <div class="pt-1">
              <LabelItem label="启用文字阴影">
                <Switch v-model:checked="danmakuWindow.danmakuWindowSetting.enableShadow" />
              </LabelItem>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- 窗口与行为 -->
      <TabsContent
        value="window"
        class="pt-3 space-y-3 client-readable"
      >
        <!-- 尺寸与坐标 -->
        <Card class="border bg-card">
          <CardHeader class="p-3 pb-2 border-b">
            <CardTitle class="text-sm font-semibold">尺寸与屏幕坐标</CardTitle>
          </CardHeader>
          <CardContent class="p-3 space-y-3">
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="space-y-1">
                <span class="text-xs text-muted-foreground">宽度 (px)</span>
                <NInputNumber
                  :value="danmakuWindow.danmakuWindowSetting.width"
                  :min="200"
                  :max="3840"
                  size="small"
                  class="w-full"
                  @update:value="
                    danmakuWindow.setDanmakuWindowSize($event || 300, danmakuWindow.danmakuWindowSetting.height)
                  "
                />
              </div>
              <div class="space-y-1">
                <span class="text-xs text-muted-foreground">高度 (px)</span>
                <NInputNumber
                  :value="danmakuWindow.danmakuWindowSetting.height"
                  :min="200"
                  :max="2160"
                  size="small"
                  class="w-full"
                  @update:value="
                    danmakuWindow.setDanmakuWindowSize(danmakuWindow.danmakuWindowSetting.width, $event || 400)
                  "
                />
              </div>
              <div class="space-y-1">
                <span class="text-xs text-muted-foreground">X 坐标</span>
                <NInputNumber
                  :value="danmakuWindow.danmakuWindowSetting.x"
                  :min="0"
                  size="small"
                  class="w-full"
                  @update:value="
                    danmakuWindow.danmakuWindowSetting.x = $event || 0
                    danmakuWindow.updateWindowPosition()
                  "
                />
              </div>
              <div class="space-y-1">
                <span class="text-xs text-muted-foreground">Y 坐标</span>
                <NInputNumber
                  :value="danmakuWindow.danmakuWindowSetting.y"
                  :min="0"
                  size="small"
                  class="w-full"
                  @update:value="
                    danmakuWindow.danmakuWindowSetting.y = $event || 0
                    danmakuWindow.updateWindowPosition()
                  "
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

        <!-- 窗口行为 -->
        <Card class="border bg-card">
          <CardHeader class="p-3 pb-2 border-b">
            <CardTitle class="text-sm font-semibold">浮窗行为属性</CardTitle>
          </CardHeader>
          <CardContent class="p-3 space-y-2.5">
            <LabelItem
              label="总是置顶"
              description="让弹幕窗口始终悬浮在游戏和其他全屏窗口上方"
            >
              <Switch v-model:checked="danmakuWindow.danmakuWindowSetting.alwaysOnTop" />
            </LabelItem>
            <LabelItem
              label="鼠标穿透 (点击忽略)"
              description="开启后鼠标点击可直接穿透弹幕窗口操作底下的游戏"
            >
              <Switch v-model:checked="danmakuWindow.danmakuWindowSetting.interactive" />
            </LabelItem>
            <LabelItem
              label="防 OBS / 屏幕共享捕捉 (防抓取)"
              description="开启后 OBS 抓屏、全屏捕获与截屏工具将无法捕捉到此浮窗，防止遮挡游戏画面与隐私泄露"
            >
              <template #icon>
                <WindowShield20Regular class="size-4 text-muted-foreground" />
              </template>
              <Switch v-model:checked="danmakuWindow.danmakuWindowSetting.contentProtected" />
            </LabelItem>
          </CardContent>
        </Card>

        <!-- 滚动与动画 -->
        <Card class="border bg-card">
          <CardHeader class="p-3 pb-2 border-b">
            <CardTitle class="text-sm font-semibold">滚动方向与动效</CardTitle>
          </CardHeader>
          <CardContent class="p-3 space-y-2.5">
            <LabelItem
              label="滚动方向"
              description="控制弹幕流是由下往上涌现还是由上往下推进"
            >
              <div class="flex items-center gap-2 text-xs text-muted-foreground">
                <span>从上往下</span>
                <Switch v-model:checked="danmakuWindow.danmakuWindowSetting.reverseOrder" />
                <span>从下往上</span>
              </div>
            </LabelItem>
            <LabelItem label="入场淡入动画">
              <Switch v-model:checked="danmakuWindow.danmakuWindowSetting.enableAnimation" />
            </LabelItem>
            <div
              v-if="danmakuWindow.danmakuWindowSetting.enableAnimation"
              class="flex items-center justify-between text-xs py-1"
            >
              <span class="text-muted-foreground">动画持续时间 (ms)</span>
              <NInputNumber
                :value="danmakuWindow.danmakuWindowSetting.animationDuration"
                :min="0"
                :max="1000"
                :step="50"
                size="small"
                class="w-32"
                @update:value="danmakuWindow.danmakuWindowSetting.animationDuration = $event || 300"
              />
            </div>
          </CardContent>
        </Card>

        <!-- 留存与清理 -->
        <Card class="border bg-card">
          <CardHeader class="p-3 pb-2 border-b">
            <CardTitle class="text-sm font-semibold">留存与自动清理</CardTitle>
          </CardHeader>
          <CardContent class="p-3 space-y-2.5">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div class="flex items-center justify-between text-xs">
                <span class="text-muted-foreground">最大保留弹幕数</span>
                <NInputNumber
                  :value="danmakuWindow.danmakuWindowSetting.maxDanmakuCount"
                  :min="10"
                  :max="200"
                  size="small"
                  class="w-32"
                  @update:value="danmakuWindow.danmakuWindowSetting.maxDanmakuCount = $event || 50"
                />
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="text-muted-foreground">自动消失时间 (秒)</span>
                <NInputNumber
                  :value="danmakuWindow.danmakuWindowSetting.autoDisappearTime"
                  :min="0"
                  :max="600"
                  :step="5"
                  size="small"
                  class="w-32"
                  @update:value="danmakuWindow.danmakuWindowSetting.autoDisappearTime = $event || 0"
                />
              </div>
            </div>
            <span class="text-[11px] text-muted-foreground block">
              {{
                danmakuWindow.danmakuWindowSetting.autoDisappearTime > 0
                  ? `弹幕将在 ${danmakuWindow.danmakuWindowSetting.autoDisappearTime} 秒后自动淡出消失`
                  : '设置为 0 则弹幕不会超时消失，直至达到最大数量后顶替'
              }}
            </span>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- 过滤与高级 -->
      <TabsContent
        value="filter"
        class="pt-3 space-y-3 client-readable"
      >
        <!-- 事件类型过滤 -->
        <Card class="border bg-card">
          <CardHeader class="p-3 pb-2 border-b">
            <CardTitle class="text-sm font-semibold">事件类型接收过滤</CardTitle>
          </CardHeader>
          <CardContent class="p-3">
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <label
                v-for="opt in filterTypeOptions"
                :key="opt.value"
                class="flex items-center gap-2 cursor-pointer text-xs"
              >
                <Checkbox
                  :checked="danmakuWindow.danmakuWindowSetting.filterTypes?.includes(opt.value)"
                  @update:checked="toggleFilterType(opt.value, $event)"
                />
                <span>{{ opt.label }}</span>
              </label>
            </div>
          </CardContent>
        </Card>

        <!-- 渲染元素显隐 -->
        <Card class="border bg-card">
          <CardHeader class="p-3 pb-2 border-b">
            <CardTitle class="text-sm font-semibold">展示元素显隐</CardTitle>
          </CardHeader>
          <CardContent class="p-3">
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <LabelItem label="用户头像">
                <Switch v-model:checked="danmakuWindow.danmakuWindowSetting.showAvatar" />
              </LabelItem>
              <LabelItem label="用户昵称">
                <Switch v-model:checked="danmakuWindow.danmakuWindowSetting.showUsername" />
              </LabelItem>
              <LabelItem label="粉丝勋章">
                <Switch v-model:checked="danmakuWindow.danmakuWindowSetting.showFansMedal" />
              </LabelItem>
              <LabelItem label="大航海标">
                <Switch v-model:checked="danmakuWindow.danmakuWindowSetting.showGuardIcon" />
              </LabelItem>
            </div>
          </CardContent>
        </Card>

        <!-- 表情与资源 -->
        <Card class="border bg-card">
          <CardHeader class="p-3 pb-2 border-b flex flex-row items-center justify-between">
            <CardTitle class="text-sm font-semibold">Bilibili 官方表情包数据</CardTitle>
            <Button
              variant="secondary"
              :disabled="emojiLoading"
              @click="reloadEmoji"
            >
              {{ emojiLoading ? '同步中...' : '重新同步表情' }}
            </Button>
          </CardHeader>
          <CardContent class="p-3">
            <div class="text-xs">
              <span class="font-medium text-foreground block">本地表情缓存状态</span>
              <span class="text-muted-foreground block mt-1">
                内联表情: {{ Object.keys(liveEmoji.emojiData.data.inline || {}).length }} 个 · 纯文本表情:
                {{ Object.keys(liveEmoji.emojiData.data.plain || {}).length }} 个
              </span>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  </div>
</template>

<style scoped>
.danmaku-manage-view {
  width: 100%;
}

/* 预设卡片 */
.preset-card {
  padding: 14px;
  border-radius: var(--radius, 6px);
  cursor: pointer;
  border: 1px solid var(--border);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  gap: 4px;
  height: 100%;
  box-sizing: border-box;
}

.preset-card:hover {
  border-color: var(--brand);
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

.preset-card--dark {
  background-color: #18181b;
  color: #fafafa;
}

.preset-card--light {
  background-color: #ffffff;
  color: #18181b;
}

.preset-card--transparent {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%);
  backdrop-filter: blur(4px);
  color: var(--foreground);
}

.preset-name {
  font-size: 13px;
  font-weight: 600;
}

.preset-desc {
  font-size: 11px;
  opacity: 0.75;
  line-height: 1.4;
}
</style>
