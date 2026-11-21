<script setup lang="ts">
import {
  Check,
  Clock,
  Copy,
  Dices,
  Eye,
  EyeOff,
  Infinity as InfinityIcon,
  Pause,
  RotateCcw,
  Save,
  Trophy,
} from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import {
  type VoteConfigModel,
  type VoteOBSDataModel,
  VoteResultMode,
  type VoteSessionModel,
} from '@/api/vote'
import { createVotePreviewScene, type VotePreviewScene } from '@/apps/manage/pages/votePreview'
import DanmakuVoteCard from '@/shared/components/DanmakuVoteCard.vue'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { FormField } from '@/shared/ui/form-field'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

const THEME_OPTIONS = [
  { value: 'glass', label: '毛玻璃 (Glass)' },
  { value: 'duel', label: '红蓝对决 (Duel)' },
  { value: 'minimal', label: '极简深色 (Minimal)' },
  { value: 'light', label: '浅色通透 (Light)' },
  { value: 'transparent', label: '透明无底 (Transparent)' },
] as const

const POSITION_OPTIONS = [
  { value: 'top-left', label: '左上' },
  { value: 'top-center', label: '顶部居中' },
  { value: 'top-right', label: '右上' },
  { value: 'center-left', label: '左中' },
  { value: 'center', label: '正中' },
  { value: 'center-right', label: '右中' },
  { value: 'bottom-left', label: '左下' },
  { value: 'bottom-center', label: '底部居中' },
  { value: 'bottom-right', label: '右下' },
  { value: 'fill', label: '铺满容器 (OBS 单源)' },
] as const

const props = defineProps<{
  config: VoteConfigModel
  activeSession: VoteSessionModel | null
  nowMs: number
  userId: number
  savingConfig: boolean
}>()

const emit = defineEmits<{
  applyVisualToConfig: [patch: Partial<VoteConfigModel>]
}>()

const stageBg = ref<'grid' | 'dark' | 'light' | 'stream'>('grid')
const dataSource = ref<'mock' | 'live'>('mock')
const previewTheme = ref(props.config.theme || 'glass')
const previewPosition = ref(props.config.displayPosition || 'center')
const previewLayout = ref<'auto' | 'card' | 'banner'>('auto')
const previewMaxDisplay = ref(6)
const activeScene = ref<VotePreviewScene>('standard')
const mockData = ref<VoteOBSDataModel>(createVotePreviewScene('standard', previewPosition.value, props.config))
const copied = ref(false)

watch(
  () => [props.config.theme, props.config.displayPosition] as const,
  ([theme, pos]) => {
    if (theme) previewTheme.value = theme
    if (pos) previewPosition.value = pos
  },
)

function applyConfigPresentation(data: VoteOBSDataModel): VoteOBSDataModel {
  const c = props.config
  return {
    ...data,
    theme: previewTheme.value,
    displayPosition: previewPosition.value,
    roundedCorners: c.roundedCorners,
    borderRadius: c.roundedCorners ? c.borderRadius : 0,
    fontFamily: c.fontFamily,
    fontScale: c.fontScale,
    cardOpacity: c.cardOpacity,
    backdropBlur: c.backdropBlur,
    accentColor: c.accentColor,
    leadingColor: c.leadingColor,
    duelLeftColor: c.duelLeftColor,
    duelRightColor: c.duelRightColor,
    showRecentVoter: c.showRecentVoter,
    resultMode: c.voteResultMode,
  }
}

const liveCardData = computed<VoteOBSDataModel | null>(() => {
  const s = props.activeSession
  if (!s) return null
  const totalVotes = s.totalVotes || 0
  const totalContrib = s.totalContribution || 0
  const useContrib = props.config.voteResultMode === VoteResultMode.ByContribution && totalContrib > 0
  return applyConfigPresentation({
    sessionId: s.id,
    title: s.title,
    isActive: s.isActive,
    isPaused: !!s.isPaused,
    isUnlimited: !!s.isUnlimited,
    isEnding: !s.isActive,
    showResults: props.config.showResults,
    winnerOption: s.winnerOverride ?? null,
    winnerByDraw: !!s.winnerOverride,
    theme: previewTheme.value,
    roundedCorners: props.config.roundedCorners,
    displayPosition: previewPosition.value,
    totalVotes,
    totalContribution: totalContrib,
    startTime: s.startTime,
    endTime: s.endTime,
    options: (s.options ?? []).map((opt, idx) => ({
      index: idx + 1,
      text: opt.text,
      count: opt.count,
      contribution: opt.contribution ?? 0,
      percentage: useContrib
        ? ((opt.contribution ?? 0) / totalContrib) * 100
        : totalVotes > 0
          ? (opt.count / totalVotes) * 100
          : 0,
    })),
  })
})

const renderedData = computed<VoteOBSDataModel | null>(() => {
  if (dataSource.value === 'live' && liveCardData.value) {
    return liveCardData.value
  }
  return applyConfigPresentation(mockData.value)
})

const previewObsUrl = computed(() => {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const url = new URL('/obs/danmaku-vote', origin || 'https://vtsuru.live')
  if (props.userId > 0) url.searchParams.set('id', String(props.userId))
  url.searchParams.set('theme', previewTheme.value)
  url.searchParams.set('position', previewPosition.value)
  url.searchParams.set('max', String(previewMaxDisplay.value))
  if (previewTheme.value === 'duel' && previewLayout.value !== 'auto') {
    url.searchParams.set('layout', previewLayout.value)
  }
  return url.toString()
})

function recalcMockTotals() {
  const d = mockData.value
  const totalVotes = d.options.reduce((sum, o) => sum + o.count, 0)
  const totalContrib = d.options.reduce((sum, o) => sum + (o.contribution ?? 0), 0)
  d.totalVotes = totalVotes
  d.totalContribution = totalContrib
  const useContrib = props.config.voteResultMode === VoteResultMode.ByContribution && totalContrib > 0
  for (const o of d.options) {
    o.percentage = useContrib
      ? ((o.contribution ?? 0) / totalContrib) * 100
      : totalVotes > 0
        ? (o.count / totalVotes) * 100
        : 0
  }
}

function loadScene(scene: VotePreviewScene) {
  activeScene.value = scene
  dataSource.value = 'mock'
  const next = createVotePreviewScene(scene, previewPosition.value, props.config)
  mockData.value = next
  previewTheme.value = next.theme
  if (scene === 'duel-top') {
    previewPosition.value = 'top-center'
    previewLayout.value = 'banner'
  } else if (scene === 'duel') {
    previewPosition.value = 'center'
    previewLayout.value = 'card'
  } else {
    previewLayout.value = 'auto'
  }
}

function addVotes(optionIndex: number, delta: number) {
  dataSource.value = 'mock'
  const opt = mockData.value.options.find((o) => o.index === optionIndex)
  if (!opt) return
  mockData.value.isEnding = false
  mockData.value.winnerOption = null
  mockData.value.winnerByDraw = false
  opt.count += delta
  opt.contribution = (opt.contribution ?? 0) + delta * 5
  mockData.value.recentVoterName = ['星月旅人', '小橘子', '白露未晞', '夜樱'][Math.floor(Math.random() * 4)]
  mockData.value.recentVoterOption = opt.text
  mockData.value.recentVoteTime = Math.floor(Date.now() / 1000)
  recalcMockTotals()
}

function triggerOvertake(optionIndex: number) {
  dataSource.value = 'mock'
  const opt = mockData.value.options.find((o) => o.index === optionIndex)
  if (!opt) return
  const maxCount = Math.max(...mockData.value.options.map((o) => o.count))
  const maxContrib = Math.max(...mockData.value.options.map((o) => o.contribution ?? 0))
  mockData.value.isEnding = false
  mockData.value.winnerOption = null
  mockData.value.winnerByDraw = false
  opt.count = maxCount + 3
  opt.contribution = maxContrib + 15
  mockData.value.recentVoterName = '翻盘推手'
  mockData.value.recentVoterOption = opt.text
  recalcMockTotals()
}

function setSpecialState(kind: 'close' | 'tie' | 'zero' | 'urgent' | 'pause' | 'unlimited' | 'end' | 'draw') {
  dataSource.value = 'mock'
  const d = mockData.value
  if (kind === 'zero') {
    d.isEnding = false
    d.isPaused = false
    d.winnerOption = null
    d.winnerByDraw = false
    for (const o of d.options) {
      o.count = 0
      o.contribution = 0
    }
    recalcMockTotals()
    return
  }
  if (kind === 'tie') {
    d.isEnding = false
    d.winnerOption = null
    d.winnerByDraw = false
    d.options.forEach((o, i) => {
      o.count = i < 2 ? 25 : 8
      o.contribution = i < 2 ? 100 : 20
    })
    recalcMockTotals()
    return
  }
  if (kind === 'close') {
    d.isEnding = false
    d.winnerOption = null
    d.winnerByDraw = false
    d.options.forEach((o, i) => {
      o.count = i === 0 ? 26 : i === 1 ? 25 : 8
      o.contribution = i === 0 ? 105 : i === 1 ? 100 : 20
    })
    recalcMockTotals()
    return
  }
  if (kind === 'urgent') {
    d.isEnding = false
    d.isPaused = false
    d.isUnlimited = false
    d.endTime = Date.now() + 8000
    return
  }
  if (kind === 'pause') {
    d.isEnding = false
    d.isPaused = !d.isPaused
    return
  }
  if (kind === 'unlimited') {
    d.isEnding = false
    d.isPaused = false
    d.isUnlimited = !d.isUnlimited
    d.endTime = d.isUnlimited ? null : Date.now() + 45000
    return
  }
  if (kind === 'end') {
    d.isEnding = true
    d.isPaused = false
    d.winnerByDraw = false
    const top = d.options.toSorted((a, b) => b.count - a.count)[0]
    d.winnerOption = top && top.count > 0 ? top.text : null
    return
  }
  if (kind === 'draw') {
    d.isEnding = true
    d.isPaused = false
    d.winnerByDraw = true
    const picked = d.options[Math.floor(Math.random() * Math.min(2, d.options.length))]
    d.winnerOption = picked?.text ?? null
  }
}

function toggleMockShowResults() {
  dataSource.value = 'mock'
  mockData.value.showResults = !mockData.value.showResults
}

async function copyUrl() {
  await navigator.clipboard.writeText(previewObsUrl.value)
  copied.value = true
  toast.success('已复制带参数的 OBS 浏览器源链接')
  setTimeout(() => {
    copied.value = false
  }, 1800)
}
</script>

<template>
  <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
    <!-- 左：16:9 舞台 -->
    <Card class="border-border bg-card overflow-hidden">
      <CardHeader class="pb-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <CardTitle class="text-sm font-semibold">OBS 画面实时预览</CardTitle>
            <ToggleGroup
              v-if="activeSession"
              type="single"
              :model-value="dataSource"
              @update:model-value="(v) => { if (v) dataSource = v as 'mock' | 'live' }"
            >
              <ToggleGroupItem value="mock">示例调试</ToggleGroupItem>
              <ToggleGroupItem value="live">真实数据</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <ToggleGroup
            type="single"
            :model-value="stageBg"
            @update:model-value="(v) => { if (v) stageBg = v as any }"
          >
            <ToggleGroupItem value="grid">透明网格</ToggleGroupItem>
            <ToggleGroupItem value="dark">深黑</ToggleGroupItem>
            <ToggleGroupItem value="light">浅白</ToggleGroupItem>
            <ToggleGroupItem value="stream">游戏画面</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>

      <CardContent class="space-y-3">
        <div
          class="relative aspect-video w-full overflow-hidden rounded-lg border border-border p-4"
          :class="{
            'vote-stage-grid': stageBg === 'grid',
            'bg-zinc-950': stageBg === 'dark',
            'bg-zinc-100': stageBg === 'light',
            'bg-gradient-to-br from-slate-900 via-indigo-950 to-sky-900': stageBg === 'stream',
          }"
        >
          <DanmakuVoteCard
            :data="renderedData"
            :theme="previewTheme"
            :position="previewPosition"
            :layout="previewLayout"
            :max-display="previewMaxDisplay"
            :current-time-ms="nowMs"
          />
        </div>

        <!-- OBS 链接复制栏 -->
        <div class="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
          <code class="min-w-0 flex-1 truncate text-xs text-muted-foreground">{{ previewObsUrl }}</code>
          <Button
            variant="secondary"
            size="xs"
            @click="copyUrl"
          >
            <Check v-if="copied" class="size-3.5 text-emerald-500" />
            <Copy v-else class="size-3.5" />
            {{ copied ? '已复制' : '复制链接' }}
          </Button>
          <Button
            variant="outline"
            size="xs"
            :disabled="savingConfig"
            @click="emit('applyVisualToConfig', { theme: previewTheme, displayPosition: previewPosition })"
          >
            <Save class="size-3.5" />
            设为默认主题与位置
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- 右：样式参数与仿真台 -->
    <Card class="border-border bg-card">
      <CardHeader class="pb-3">
        <CardTitle class="text-sm font-semibold">画面参数与仿真调试</CardTitle>
      </CardHeader>
      <CardContent class="space-y-3">
        <FormField label="主题风格">
          <Select v-model="previewTheme">
            <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="item in THEME_OPTIONS"
                :key="item.value"
                :value="item.value"
              >
                {{ item.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <div class="grid grid-cols-2 gap-2">
          <FormField label="停靠位置" class="min-w-0">
            <Select v-model="previewPosition">
              <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="item in POSITION_OPTIONS"
                  :key="item.value"
                  :value="item.value"
                >
                  {{ item.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="最多显示项数" class="min-w-0">
            <NumberField
              v-model="previewMaxDisplay"
              :min="2"
              :max="20"
            />
          </FormField>
        </div>

        <FormField
          v-if="previewTheme === 'duel'"
          label="对决布局形态"
        >
          <ToggleGroup
            type="single"
            :model-value="previewLayout"
            class="w-full grid grid-cols-3"
            @update:model-value="(v) => { if (v) previewLayout = v as any }"
          >
            <ToggleGroupItem value="auto">自动</ToggleGroupItem>
            <ToggleGroupItem value="card">卡片</ToggleGroupItem>
            <ToggleGroupItem value="banner">横幅</ToggleGroupItem>
          </ToggleGroup>
        </FormField>

        <Separator />

        <!-- 模拟场景 -->
        <FormField label="快速示例场景">
          <div class="grid grid-cols-2 gap-1.5">
            <Button
              v-for="item in [
                { id: 'standard', label: '常规四选一' },
                { id: 'duel-top', label: '对决顶栏' },
                { id: 'duel', label: '对决卡片' },
                { id: 'leaderboard', label: '多选项榜单' },
              ] as const"
              :key="item.id"
              :variant="activeScene === item.id && dataSource === 'mock' ? 'secondary' : 'outline'"
              size="xs"
              @click="loadScene(item.id)"
            >
              {{ item.label }}
            </Button>
          </div>
        </FormField>

        <FormField label="状态与动效测试">
          <div class="flex flex-wrap gap-1.5">
            <Button variant="outline" size="xs" @click="setSpecialState('close')">差 1 票</Button>
            <Button variant="outline" size="xs" @click="setSpecialState('tie')">平票</Button>
            <Button variant="outline" size="xs" @click="setSpecialState('zero')">归零</Button>
            <Button variant="outline" size="xs" @click="setSpecialState('urgent')">
              <Clock class="size-3" />剩 8s
            </Button>
            <Button variant="outline" size="xs" @click="setSpecialState('pause')">
              <Pause class="size-3" />暂停
            </Button>
            <Button variant="outline" size="xs" @click="setSpecialState('unlimited')">
              <InfinityIcon class="size-3" />不限时
            </Button>
            <Button variant="outline" size="xs" @click="toggleMockShowResults">
              <EyeOff v-if="mockData.showResults" class="size-3" />
              <Eye v-else class="size-3" />
              {{ mockData.showResults ? '隐藏票数' : '公开票数' }}
            </Button>
            <Button variant="secondary" size="xs" @click="setSpecialState('end')">
              <Trophy class="size-3" />结算
            </Button>
            <Button variant="secondary" size="xs" @click="setSpecialState('draw')">
              <Dices class="size-3" />抽签胜出
            </Button>
            <Button variant="ghost" size="xs" @click="loadScene(activeScene)">
              <RotateCcw class="size-3" />重置
            </Button>
          </div>
        </FormField>

        <FormField label="模拟单选项加票 / 反超">
          <div class="space-y-1 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
            <div
              v-for="opt in mockData.options.slice(0, 6)"
              :key="opt.index"
              class="flex-between gap-1.5 rounded border border-border px-2 py-1 text-xs"
            >
              <span class="truncate">{{ opt.index }}. {{ opt.text }}</span>
              <div class="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="xs" @click="addVotes(opt.index, 1)">+1</Button>
                <Button variant="ghost" size="xs" @click="addVotes(opt.index, 10)">+10</Button>
                <Button variant="outline" size="xs" @click="triggerOvertake(opt.index)">反超</Button>
              </div>
            </div>
          </div>
        </FormField>
      </CardContent>
    </Card>
  </div>
</template>

<style scoped>
.vote-stage-grid {
  background-color: #18181b;
  background-image:
    linear-gradient(45deg, #27272a 25%, transparent 25%),
    linear-gradient(-45deg, #27272a 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #27272a 75%),
    linear-gradient(-45deg, transparent 75%, #27272a 75%);
  background-size: 20px 20px;
  background-position:
    0 0,
    0 10px,
    10px -10px,
    -10px 0;
}
</style>
