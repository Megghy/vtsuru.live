<script setup lang="ts">
import {
  Add24Filled,
  ArrowTrending24Filled,
  Clock24Regular,
  Color24Regular,
  Copy24Regular,
  Delete24Regular,
  Desktop24Regular,
  Eye24Regular,
  Flash24Regular,
  Pause24Regular,
  Play24Regular,
  Settings24Regular,
  Sparkle24Regular,
  Timer24Regular,
  Trophy24Regular,
} from '@vicons/fluent'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { clearInterval, setInterval } from 'worker-timers'

import { useAccount } from '@/api/account'
import type { RequestCreateBulletVote, ResponseVoteSession, VoteConfig, VoteOBSData } from '@/api/api-models'
import {
  getApiVoteGetActive,
  getApiVoteGetConfig,
  getApiVoteHistory,
  postApiVoteCreate,
  postApiVoteDelete,
  postApiVoteEnd,
  postApiVoteExtend,
  postApiVoteSaveConfig,
} from '@/api/generated/bullet-vote/bullet-vote'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import DanmakuVoteCard from '@/shared/components/DanmakuVoteCard.vue'
import { CURRENT_HOST } from '@/shared/config'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { Switch } from '@/shared/ui/switch'
import { Textarea } from '@/shared/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { useMessage } from '@/shared/utils'
import { copyToClipboard } from '@/shared/utils'
import { formatCountdown, remainingMs } from '@/shared/utils/countdown'
import { type VotePreset, VOTE_QUICK_PRESETS, useVoteTemplates } from '@/shared/utils/votePresets'
import { getVoteStandings, voteOutcomeLabel } from '@/shared/utils/voteStandings'

import { createVotePreviewScene, type VotePreviewScene } from './votePreview'

// 账号与消息
const message = useMessage()
const accountInfo = useAccount()

// 视图切换
const activeTab = ref<'console' | 'preview'>('console')

// 状态
const isLoading = ref(false)
const showSettingsModal = ref(false)
const currentVote = ref<ResponseVoteSession | null>(null)
const voteHistory = ref<ResponseVoteSession[]>([])

// 投票配置
const voteConfig = ref<VoteConfig>({
  isEnabled: true,
  showResults: true,
  voteDurationSeconds: 60,
  voteCommand: '投票',
  voteEndCommand: '结束投票',
  voteTitle: '观众投票',
  allowMultipleVotes: false,
  allowCustomOptions: false,
  defaultOptions: ['选项1', '选项2'],
  theme: 'glass',
  roundedCorners: true,
  displayPosition: 'center',
  allowGiftVoting: false,
  minGiftPrice: 1,
  voteResultMode: 0,
})

// 创建表单数据
interface FormOption {
  id: string
  text: string
}

function createFormOption(text = ''): FormOption {
  return {
    id: crypto.randomUUID(),
    text,
  }
}

const formTitle = ref('')
const formOptions = ref<FormOption[]>([createFormOption('选项1'), createFormOption('选项2')])
const formDuration = ref(60)
const formAllowMultiple = ref(false)

// 倒计时与领先者
const nowMs = ref(Date.now())
let clockTimer: number | undefined
let pollTimer: number | undefined

const timeLeftMs = computed(() => remainingMs(currentVote.value?.endTime, nowMs.value))

function formatTime(ms: number | null): string {
  return ms == null ? '进行中' : formatCountdown(ms)
}

const leadingOptionIndex = computed(() => {
  const options = currentVote.value?.options
  if (!options?.length || !currentVote.value?.totalVotes) return -1
  let max = -1
  let leader = -1
  let tie = false
  options.forEach((opt, idx) => {
    if (opt.count > max) {
      max = opt.count
      leader = idx
      tie = false
    } else if (opt.count === max) {
      tie = true
    }
  })
  return tie || max <= 0 ? -1 : leader
})

function applyPreset(preset: VotePreset) {
  formTitle.value = preset.title
  formOptions.value = preset.options.map((opt) => createFormOption(opt))
}

function addOption() {
  if (formOptions.value.length >= 50) {
    message.warning('最多添加 50 个选项')
    return
  }
  formOptions.value.push(createFormOption(`选项 ${formOptions.value.length + 1}`))
}

const showBatchModal = ref(false)
const batchInputText = ref('')

function openBatchModal() {
  batchInputText.value = formOptions.value.map((o) => o.text).join('\n')
  showBatchModal.value = true
}

function applyBatchOptions() {
  const lines = batchInputText.value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length < 2) {
    message.warning('至少需要输入 2 行有效选项')
    return
  }
  if (lines.length > 50) {
    message.warning('最多支持 50 个选项，已截取前 50 行')
    lines.length = 50
  }

  formOptions.value = lines.map((line) => createFormOption(line))
  showBatchModal.value = false
  message.success(`已成功导入 ${lines.length} 个选项`)
}

function removeOption(idx: number) {
  if (formOptions.value.length <= 2) {
    message.warning('至少保留 2 个选项')
    return
  }
  formOptions.value.splice(idx, 1)
}

// 模板管理 (存储在持久化)
const savedTemplates = useVoteTemplates()
const newTemplateName = ref('')

function saveCustomTemplate() {
  const name = newTemplateName.value.trim()
  if (!name) {
    message.warning('请输入模板名称')
    return
  }
  const cleanOptions = formOptions.value.map((o) => o.text.trim()).filter(Boolean)
  if (cleanOptions.length < 2) {
    message.warning('至少需要 2 个有效选项')
    return
  }
  savedTemplates.value.push({
    name,
    title: formTitle.value.trim() || name,
    options: cleanOptions,
  })
  newTemplateName.value = ''
  message.success('已保存至模板库')
}

function deleteCustomTemplate(idx: number) {
  savedTemplates.value.splice(idx, 1)
  message.success('模板已删除')
}

// =================== OBS 预览与仿真调试状态 ===================
const previewBg = ref<'checker' | 'dark' | 'light' | 'game'>('checker')
const previewTheme = ref<'glass' | 'duel' | 'minimal' | 'transparent'>('glass')
const previewPosition = ref('center')
const previewMaxDisplay = ref(6)
const previewMode = ref<'live' | 'mock'>('mock')

function mockTime(offsetSeconds: number): number {
  return Date.now() + offsetSeconds * 1000
}

const mockData = ref<VoteOBSData>({
  sessionId: 9999,
  title: '本局英雄出装选择',
  isActive: true,
  isEnding: false,
  showResults: true,
  theme: 'glass',
  roundedCorners: true,
  displayPosition: 'center',
  totalVotes: 35,
  startTime: mockTime(-15),
  endTime: mockTime(45),
  winnerOption: undefined,
  options: [
    { index: 1, text: '疾跑攻速流', count: 18, percentage: 51 },
    { index: 2, text: '纯肉反伤流', count: 12, percentage: 34 },
    { index: 3, text: '暴击秒杀流', count: 5, percentage: 15 },
  ],
})

function recalculateMockPercentages() {
  const total = mockData.value.options.reduce((sum, opt) => sum + opt.count, 0)
  mockData.value.totalVotes = total
  mockData.value.options.forEach((opt) => {
    opt.percentage = total > 0 ? Math.round((opt.count / total) * 1000) / 10 : 0
  })
}

function mockAddVote(optionIndex: number, delta = 1) {
  const target = mockData.value.options.find((o) => o.index === optionIndex)
  if (target) {
    target.count += delta
    recalculateMockPercentages()
    message.info(`已给「${target.text}」增加 ${delta} 票`)
  }
}

function mockOvertake(targetIdx: number) {
  const leader = [...mockData.value.options].toSorted((a, b) => b.count - a.count)[0]
  const target = mockData.value.options.find((o) => o.index === targetIdx)
  if (target && leader) {
    target.count = leader.count + 3
    recalculateMockPercentages()
    message.success(`「${target.text}」已反超成为第 1 名！`)
  }
}

function loadMockScene(scene: VotePreviewScene) {
  mockData.value = createVotePreviewScene(scene, previewPosition.value)
  previewTheme.value = scene === 'duel' || scene === 'duel-top' ? 'duel' : 'glass'
  previewPosition.value = mockData.value.displayPosition
  previewMode.value = 'mock'
  if (scene === 'leaderboard') previewMaxDisplay.value = 6
}

function setMockBalance(mode: 'close' | 'tie' | 'empty') {
  previewMode.value = 'mock'
  mockData.value.isActive = true
  mockData.value.isEnding = false
  mockData.value.winnerOption = null
  mockData.value.options.forEach((option, index) => {
    option.count = mode === 'empty' ? 0 : mode === 'tie' ? 100 : index < 2 ? 100 + index : 20
  })
  recalculateMockPercentages()
}

function toggleMockUrgent() {
  mockData.value.isActive = true
  mockData.value.isEnding = false
  mockData.value.winnerOption = undefined
  mockData.value.endTime = mockTime(8)
  message.info('已切换至最后 8s 紧急倒计时状态')
}

function toggleMockWinner() {
  const standings = getVoteStandings(mockData.value.options)
  mockData.value.isActive = false
  mockData.value.isEnding = true
  mockData.value.winnerOption = standings.leader?.text ?? null
  mockData.value.endTime = undefined
  message.success(voteOutcomeLabel(standings, true))
}

const activePreviewCardData = computed<VoteOBSData | null>(() => {
  if (previewMode.value === 'live') {
    if (!currentVote.value) return null
    return {
      sessionId: currentVote.value.id,
      title: currentVote.value.title,
      isActive: currentVote.value.isActive,
      isEnding: false,
      showResults: voteConfig.value.showResults,
      theme: voteConfig.value.theme,
      roundedCorners: voteConfig.value.roundedCorners,
      displayPosition: voteConfig.value.displayPosition,
      totalVotes: currentVote.value.totalVotes,
      startTime: Date.now(),
      endTime: currentVote.value.endTime,
      options: (currentVote.value.options ?? []).map((opt, idx) => ({
        index: idx + 1,
        text: opt.text,
        count: opt.count,
        percentage: calcPercentage(opt.count, currentVote.value?.totalVotes || 0),
      })),
    }
  }
  return mockData.value
})

async function fetchVoteConfig() {
  try {
    const res = (await getApiVoteGetConfig()) as unknown as {
      code: number
      data?: VoteConfig
    }
    if (res.code === 200 && res.data) {
      voteConfig.value = { ...voteConfig.value, ...res.data }
      previewTheme.value = (res.data.theme as any) || 'glass'
      previewPosition.value = res.data.displayPosition || 'center'
    }
  } catch (err) {
    console.error('获取配置失败:', err)
  }
}

async function saveVoteConfig() {
  try {
    isLoading.value = true
    const res = await postApiVoteSaveConfig(voteConfig.value as any)
    if (res.code === 200) {
      message.success('设置已保存')
      showSettingsModal.value = false
    } else {
      message.error(res.message || '保存设置失败')
    }
  } catch (err) {
    message.error('保存设置异常')
  } finally {
    isLoading.value = false
  }
}

async function fetchActiveVote() {
  try {
    const res = (await getApiVoteGetActive()) as unknown as {
      code: number
      data?: ResponseVoteSession
    }
    if (res.code === 200) {
      currentVote.value = res.data
    }
  } catch (err) {
    // 静默
  }
}

async function fetchHistory() {
  try {
    const res = (await getApiVoteHistory({ limit: 15 })) as unknown as {
      code: number
      data?: ResponseVoteSession[]
    }
    if (res.code === 200 && res.data) {
      voteHistory.value = res.data
    }
  } catch (err) {
    console.error('获取历史记录失败:', err)
  }
}

async function createVote() {
  const title = formTitle.value.trim()
  if (!title) {
    message.warning('请输入投票标题')
    return
  }
  const cleanOptions = formOptions.value.map((o) => o.text.trim()).filter(Boolean)
  if (cleanOptions.length < 2) {
    message.warning('至少需要 2 个有效选项')
    return
  }

  const payload: RequestCreateBulletVote = {
    title,
    options: cleanOptions,
    allowMultipleVotes: formAllowMultiple.value,
    durationSeconds: formDuration.value > 0 ? formDuration.value : undefined,
  }

  try {
    isLoading.value = true
    const res = (await postApiVoteCreate(payload as any)) as unknown as {
      code: number
      data?: ResponseVoteSession
      message?: string
    }
    if (res.code === 200 && res.data) {
      message.success('投票已发起！')
      currentVote.value = res.data
      await fetchHistory()
    } else {
      message.error(res.message || '发起投票失败')
    }
  } catch (err) {
    message.error('发起投票异常')
  } finally {
    isLoading.value = false
  }
}

async function extendDuration(seconds: number) {
  if (!currentVote.value) return
  try {
    isLoading.value = true
    const res = (await postApiVoteExtend({ seconds })) as unknown as {
      code: number
      data?: ResponseVoteSession
      message?: string
    }
    if (res.code === 200 && res.data) {
      message.success(`已延长 ${seconds} 秒`)
      currentVote.value = res.data
    }
  } catch (err) {
    message.error('延长失败')
  } finally {
    isLoading.value = false
  }
}

async function endVote() {
  if (!currentVote.value) return
  try {
    isLoading.value = true
    const res = await postApiVoteEnd({ id: currentVote.value.id })
    if (res.code === 200) {
      message.success('投票已结束并生成结算快照')
      currentVote.value = null
      await fetchHistory()
    } else {
      message.error(res.message || '结束失败')
    }
  } catch (err) {
    message.error('结束投票异常')
  } finally {
    isLoading.value = false
  }
}

async function deleteHistoryVote(id: number) {
  try {
    const res = await postApiVoteDelete({ id })
    if (res.code === 200) {
      message.success('已删除该记录')
      await fetchHistory()
      if (currentVote.value?.id === id) {
        currentVote.value = null
      }
    } else {
      message.error('删除失败')
    }
  } catch (err) {
    message.error('删除异常')
  }
}

function reuseHistory(item: ResponseVoteSession) {
  formTitle.value = item.title
  formOptions.value = (item.options ?? []).map((opt) => createFormOption(opt.text))
  activeTab.value = 'console'
  message.info('已复制到发起表单')
}

function copyObsLink(customTheme?: string, customPosition?: string, customMax?: number) {
  const params: Record<string, string> = {}
  if (customTheme) params.theme = customTheme
  if (customPosition) params.position = customPosition
  if (customMax && customMax > 0) params.max = String(customMax)

  const obsUrl = buildObsSourceUrl({
    path: 'obs/danmaku-vote',
    host: CURRENT_HOST,
    credential: 'public-id',
    userId: accountInfo.value?.id,
    params,
  })
  if (!obsUrl) {
    message.error('请先登录后再复制 OBS 链接')
    return
  }
  copyToClipboard(obsUrl)
  message.success('OBS 浏览器源链接已复制到剪贴板')
}

function calcPercentage(count: number, total: number) {
  if (total <= 0) return 0
  return Math.round((count / total) * 100)
}

onMounted(async () => {
  await fetchVoteConfig()
  await fetchActiveVote()
  await fetchHistory()

  clockTimer = setInterval(() => {
    nowMs.value = Date.now()
  }, 1000)

  pollTimer = setInterval(async () => {
    await fetchActiveVote()
  }, 2000)
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<template>
  <div class="space-y-4 w-full">
    <ManagePageHeader
      title="弹幕投票系统"
      subtitle="观众可通过直播间弹幕发送选项序号或文字参与投票，实时统计并投屏到 OBS 画面"
    >
      <template #action>
        <div class="flex items-center gap-2">
          <ToggleGroup
            v-model="activeTab"
            type="single"
          >
            <ToggleGroupItem value="console">
              <component
                :is="Clock24Regular"
                class="size-3.5 mr-1"
              />
              工作台
            </ToggleGroupItem>
            <ToggleGroupItem value="preview">
              <component
                :is="Desktop24Regular"
                class="size-3.5 mr-1"
              />
              OBS 预览与调试
            </ToggleGroupItem>
          </ToggleGroup>

          <Button
            variant="outline"
            @click="showSettingsModal = true"
          >
            <component
              :is="Settings24Regular"
              class="size-3.5 mr-1"
            />
            全局设置
          </Button>

          <Button
            variant="default"
            @click="copyObsLink(voteConfig.theme, voteConfig.displayPosition)"
          >
            <component
              :is="Copy24Regular"
              class="size-3.5 mr-1"
            />
            复制 OBS 链接
          </Button>
        </div>
      </template>
    </ManagePageHeader>

    <!-- 视图 1：工作台 (发起与监控) -->
    <div
      v-show="activeTab === 'console'"
      class="grid grid-cols-1 lg:grid-cols-12 gap-4"
    >
      <!-- 左侧：实时控制看板 + 发起投票 (8 列) -->
      <div class="lg:col-span-8 space-y-4">
        <!-- 1. 进行中的投票监控卡片 -->
        <Card
          v-if="currentVote && currentVote.isActive"
          class="border-l-4 border-l-amber-500 bg-amber-500/5 shadow-sm"
        >
          <CardHeader class="p-3.5 pb-2">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500 animate-pulse" />
                <CardTitle class="text-sm font-semibold">
                  {{ currentVote.title }}
                </CardTitle>
                <Badge
                  variant="warning"
                  class="text-xs"
                >
                  剩余：{{ formatTime(timeLeftMs) }}
                </Badge>
              </div>

              <span class="text-xs text-muted-foreground">
                总票数：<strong class="text-foreground text-sm font-bold">{{ currentVote.totalVotes }}</strong> 票
              </span>
            </div>
          </CardHeader>

          <CardContent class="p-3.5 space-y-3">
            <!-- 动态选项统计条 -->
            <div class="space-y-2.5">
              <div
                v-for="(opt, idx) in currentVote.options ?? []"
                :key="idx"
                class="p-2.5 rounded-md border border-border bg-card/60 transition-colors"
                :class="{ 'border-amber-500/40 bg-amber-500/10': idx === leadingOptionIndex }"
              >
                <div class="flex justify-between items-center text-xs mb-1.5">
                  <div class="flex items-center gap-1.5 font-medium">
                    <span class="font-mono text-muted-foreground">#{{ idx + 1 }}</span>
                    <span>{{ opt.text }}</span>
                    <Badge
                      v-if="idx === leadingOptionIndex"
                      variant="warning"
                      class="text-[10px] px-1 py-0 h-4"
                    >
                      领先
                    </Badge>
                  </div>
                  <div class="flex items-center gap-2 font-mono">
                    <span class="text-muted-foreground">{{ opt.count }} 票</span>
                    <span class="font-bold text-amber-500"
                      >{{ calcPercentage(opt.count, currentVote.totalVotes) }}%</span
                    >
                  </div>
                </div>

                <!-- 进度条 -->
                <div class="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-300"
                    :class="idx === leadingOptionIndex ? 'bg-amber-500' : 'bg-primary'"
                    :style="{ width: `${calcPercentage(opt.count, currentVote.totalVotes)}%` }"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div class="flex items-center gap-1.5">
                <span class="text-xs text-muted-foreground">加时:</span>
                <Button
                  size="xs"
                  variant="outline"
                  @click="extendDuration(30)"
                >
                  +30s
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  @click="extendDuration(60)"
                >
                  +60s
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  @click="extendDuration(120)"
                >
                  +2m
                </Button>
              </div>

              <AlertDialog>
                <AlertDialogTrigger as-child>
                  <Button
                    size="xs"
                    variant="outline"
                    class="border-amber-500 text-amber-500 hover:bg-amber-500/10"
                  >
                    <component
                      :is="Pause24Regular"
                      class="h-3.5 w-3.5 mr-1"
                    />
                    提前结束
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent class="sm:max-w-md">
                  <AlertDialogHeader>
                    <AlertDialogTitle>提前结束当前投票？</AlertDialogTitle>
                    <AlertDialogDescription class="text-xs">
                      提前结束后将锁定投票结果并进入结算展示状态。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      class="bg-amber-500 text-white hover:bg-amber-600"
                      @click="endVote"
                    >
                      确认结束
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        <!-- 2. 发起新投票卡片 -->
        <Card>
          <CardHeader class="p-3.5 pb-2">
            <CardTitle class="text-xs font-semibold uppercase tracking-wide"> 发起投票 </CardTitle>
          </CardHeader>

          <CardContent class="p-3.5 space-y-3.5">
            <!-- 快捷预设芯片 -->
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-xs text-muted-foreground">快捷预设:</span>
              <Button
                v-for="p in VOTE_QUICK_PRESETS"
                :key="p.name"
                size="xs"
                variant="outline"
                class="h-6 gap-1"
                @click="applyPreset(p)"
              >
                <component
                  :is="Sparkle24Regular"
                  class="h-3 w-3 text-brand"
                />
                {{ p.name }}
              </Button>
            </div>

            <!-- 投票主题 -->
            <Input
              v-model="formTitle"
              placeholder="输入投票主题 (例如: 本局出装选择 / 下一把玩什么)"
              maxlength="50"
            />

            <!-- 选项编辑列表 -->
            <div class="space-y-2">
              <div
                v-for="(opt, idx) in formOptions"
                :key="opt.id"
                class="flex items-center gap-2"
              >
                <span class="font-mono text-xs text-muted-foreground w-5 text-right shrink-0">{{ idx + 1 }}.</span>
                <Input
                  v-model="opt.text"
                  placeholder="选项文字"
                  class="flex-1"
                  maxlength="30"
                />
                <Button
                  v-if="formOptions.length > 2"
                  size="icon-xs"
                  variant="ghost"
                  class="text-muted-foreground hover:text-destructive"
                  @click="removeOption(idx)"
                >
                  <component
                    :is="Delete24Regular"
                    class="h-3.5 w-3.5"
                  />
                </Button>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <Button
                size="xs"
                variant="outline"
                @click="addOption"
              >
                <component
                  :is="Add24Filled"
                  class="h-3.5 w-3.5 mr-1"
                />
                添加选项
              </Button>
              <Button
                size="xs"
                variant="outline"
                @click="openBatchModal"
              >
                批量粘贴/导入
              </Button>
              <Button
                v-if="formOptions.length > 2"
                size="xs"
                variant="ghost"
                class="text-muted-foreground"
                @click="formOptions = [createFormOption('选项1'), createFormOption('选项2')]"
              >
                重置为 2 项
              </Button>
            </div>

            <Separator />

            <!-- 时长与规则 -->
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div class="flex items-center gap-4 flex-wrap">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs text-muted-foreground">时长:</span>
                  <Input
                    v-model.number="formDuration"
                    type="number"
                    min="0"
                    max="3600"
                    step="30"
                    class="w-20 font-mono"
                  />
                  <span class="text-xs text-muted-foreground">秒</span>
                </div>

                <label class="flex items-center gap-1.5 cursor-pointer text-xs select-none">
                  <Checkbox v-model="formAllowMultiple" />
                  <span>每人允许多次投票</span>
                </label>
              </div>

              <Button
                variant="brand"
                :loading="isLoading"
                @click="createVote"
              >
                <component
                  :is="Play24Regular"
                  class="h-3.5 w-3.5 mr-1"
                />
                {{ currentVote?.isActive ? '覆盖并重新发起' : '立即发起投票' }}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- 右侧：模板库与历史记录 (4 列) -->
      <div class="lg:col-span-4 space-y-4">
        <!-- 模板库卡片 -->
        <Card>
          <CardHeader class="p-3.5 pb-2">
            <CardTitle class="text-xs font-semibold uppercase tracking-wide"> 我的模板库 </CardTitle>
          </CardHeader>
          <CardContent class="p-3.5 space-y-2.5">
            <div class="flex gap-1.5">
              <Input
                v-model="newTemplateName"
                placeholder="存为新模板..."
                class="flex-1"
              />
              <Button
                size="xs"
                variant="outline"
                @click="saveCustomTemplate"
              >
                保存
              </Button>
            </div>

            <div
              v-if="savedTemplates.length === 0"
              class="text-xs text-muted-foreground py-4 text-center border border-dashed rounded-md"
            >
              暂无保存的模板
            </div>
            <div
              v-else
              class="space-y-1.5 max-h-48 overflow-y-auto"
            >
              <div
                v-for="(tpl, idx) in savedTemplates"
                :key="idx"
                class="flex items-center justify-between p-2 rounded border border-border bg-muted/20 hover:bg-muted/40 transition-colors text-xs cursor-pointer"
                @click="applyPreset(tpl)"
              >
                <div class="min-w-0 pr-2">
                  <div class="font-medium truncate text-foreground">
                    {{ tpl.name }}
                  </div>
                  <div class="text-[11px] text-muted-foreground truncate">
                    {{ tpl.options.join(' / ') }}
                  </div>
                </div>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  class="text-muted-foreground hover:text-destructive shrink-0"
                  @click.stop="deleteCustomTemplate(idx)"
                >
                  <component
                    :is="Delete24Regular"
                    class="h-3.5 w-3.5"
                  />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- 历史记录卡片 -->
        <Card>
          <CardHeader class="p-3.5 pb-2">
            <CardTitle class="text-xs font-semibold uppercase tracking-wide"> 历史投票记录 </CardTitle>
          </CardHeader>
          <CardContent class="p-3.5">
            <div
              v-if="voteHistory.length === 0"
              class="text-xs text-muted-foreground py-4 text-center border border-dashed rounded-md"
            >
              暂无历史记录
            </div>
            <div
              v-else
              class="space-y-1.5 max-h-64 overflow-y-auto"
            >
              <div
                v-for="item in voteHistory"
                :key="item.id"
                class="flex items-center justify-between p-2 rounded border border-border bg-muted/20 text-xs"
              >
                <div class="min-w-0 pr-2">
                  <div class="font-medium truncate text-foreground">
                    {{ item.title }}
                  </div>
                  <div class="text-[11px] text-muted-foreground flex items-center gap-2">
                    <span>总票数：{{ item.totalVotes }}</span>
                    <span>{{ item.options.length }} 个选项</span>
                  </div>
                </div>

                <div class="flex items-center gap-1 shrink-0">
                  <Button
                    size="xs"
                    variant="outline"
                    @click="reuseHistory(item)"
                  >
                    复刻
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger as-child>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        class="text-muted-foreground hover:text-destructive"
                      >
                        <component
                          :is="Delete24Regular"
                          class="h-3.5 w-3.5"
                        />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent class="sm:max-w-md">
                      <AlertDialogHeader>
                        <AlertDialogTitle>删除此记录？</AlertDialogTitle>
                        <AlertDialogDescription class="text-xs"> 删除后将从历史记录中移除。 </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                          class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          @click="deleteHistoryVote(item.id)"
                        >
                          确认删除
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

    <!-- 视图 2：OBS 实时预览舞台与仿真调试控制台 -->
    <div
      v-show="activeTab === 'preview'"
      class="grid grid-cols-1 lg:grid-cols-12 gap-4"
    >
      <!-- 左侧：OBS 预览舞台 (8 列) -->
      <Card class="lg:col-span-8 flex flex-col">
        <CardHeader class="p-3.5 pb-2">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div class="flex items-center gap-2">
              <component
                :is="Eye24Regular"
                class="h-4 w-4 text-muted-foreground"
              />
              <CardTitle class="text-xs font-semibold"> OBS 画布实时预览 (1080P 比例视口) </CardTitle>
              <Badge
                :variant="previewMode === 'live' ? 'success' : 'outline'"
                class="text-[10px] px-1.5 py-0 h-4"
              >
                {{ previewMode === 'live' ? '真实数据源' : '模拟仿真模式' }}
              </Badge>
            </div>

            <div class="flex items-center gap-1 bg-muted p-0.5 rounded-md">
              <Button
                v-for="bg in [
                  { key: 'checker', label: '网格' },
                  { key: 'dark', label: '纯黑' },
                  { key: 'light', label: '浅色' },
                  { key: 'game', label: '直播场景' },
                ]"
                :key="bg.key"
                size="xs"
                :variant="previewBg === bg.key ? 'default' : 'ghost'"
                class="h-6 px-2"
                @click="previewBg = bg.key as any"
              >
                {{ bg.label }}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent class="p-4 flex-1 flex flex-col justify-between space-y-4">
          <div
            class="rounded-lg border border-border p-6 flex items-center justify-center min-h-[460px] transition-colors"
            :class="{
              'bg-[#121214]': previewBg === 'dark',
              'bg-[#f4f4f5]': previewBg === 'light',
              'bg-[#0b132b]': previewBg === 'game',
              'bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]':
                previewBg === 'checker',
            }"
          >
            <div class="w-[380px] max-w-full">
              <DanmakuVoteCard
                :data="activePreviewCardData"
                :theme="previewTheme"
                :position="previewPosition"
                :max-display="previewMaxDisplay"
                :current-time-ms="nowMs"
              />
            </div>
          </div>

          <div class="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-border/60">
            <span class="text-xs text-muted-foreground font-mono">
              参数: ?theme={{ previewTheme }}&position={{ previewPosition }}&max={{ previewMaxDisplay }}
            </span>
            <Button
              size="xs"
              variant="brand"
              @click="copyObsLink(previewTheme, previewPosition, previewMaxDisplay)"
            >
              <component
                :is="Copy24Regular"
                class="h-3.5 w-3.5 mr-1"
              />
              复制当前调试参数 OBS 链接
            </Button>
          </div>
        </CardContent>
      </Card>

      <!-- 右侧：仿真调试控制台 (4 列) -->
      <div class="lg:col-span-4 space-y-4">
        <!-- 视觉与场景调试 -->
        <Card>
          <CardHeader class="p-3.5 pb-2">
            <div class="flex items-center gap-2">
              <component
                :is="Color24Regular"
                class="h-4 w-4 text-muted-foreground"
              />
              <CardTitle class="text-xs font-semibold uppercase tracking-wide"> 视觉与场景调试 </CardTitle>
            </div>
          </CardHeader>

          <CardContent class="p-3.5 space-y-3.5">
            <div>
              <span class="text-xs text-muted-foreground block mb-2">一键载入场景:</span>
              <div class="flex flex-wrap gap-1.5">
                <Button
                  size="xs"
                  variant="outline"
                  @click="loadMockScene('duel-top')"
                >
                  红蓝顶栏
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  @click="loadMockScene('duel')"
                >
                  红蓝卡片
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  @click="loadMockScene('standard')"
                >
                  四选一
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  @click="loadMockScene('leaderboard')"
                >
                  10人排行榜
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  @click="setMockBalance('close')"
                >
                  差1票
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  @click="setMockBalance('tie')"
                >
                  平票
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  @click="setMockBalance('empty')"
                >
                  零票
                </Button>
              </div>
            </div>

            <Separator />

            <div>
              <span class="text-xs text-muted-foreground block mb-1.5">预设主题:</span>
              <div class="grid grid-cols-2 gap-1.5">
                <Button
                  v-for="th in [
                    { key: 'glass', label: '毛玻璃 Glass' },
                    { key: 'duel', label: '对决 Duel' },
                    { key: 'minimal', label: '极简 Minimal' },
                    { key: 'transparent', label: '无背景/纯透明' },
                  ]"
                  :key="th.key"
                  size="xs"
                  :variant="previewTheme === th.key ? 'default' : 'outline'"
                  class="justify-start"
                  @click="previewTheme = th.key as any"
                >
                  {{ th.label }}
                </Button>
              </div>
            </div>

            <div class="space-y-1.5">
              <span class="text-xs text-muted-foreground block">屏幕对齐位置:</span>
              <Select v-model="previewPosition">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="center"> 正中心 (默认) </SelectItem>
                  <SelectItem value="top-center"> 顶部居中 (推荐长条对决) </SelectItem>
                  <SelectItem value="bottom-right"> 右下角 </SelectItem>
                  <SelectItem value="bottom-left"> 左下角 </SelectItem>
                  <SelectItem value="top-right"> 右上角 </SelectItem>
                  <SelectItem value="top-left"> 左上角 </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="flex items-center justify-between">
              <span class="text-xs text-muted-foreground">排行榜最大显示行数:</span>
              <Input
                v-model.number="previewMaxDisplay"
                type="number"
                min="2"
                max="20"
                class="w-20 font-mono"
              />
            </div>
          </CardContent>
        </Card>

        <!-- 实时互动模拟 -->
        <Card>
          <CardHeader class="p-3.5 pb-2">
            <div class="flex items-center gap-2">
              <component
                :is="Flash24Regular"
                class="h-4 w-4 text-muted-foreground"
              />
              <CardTitle class="text-xs font-semibold uppercase tracking-wide"> 实时互动模拟 </CardTitle>
            </div>
          </CardHeader>
          <CardContent class="p-3.5 space-y-3">
            <span class="text-xs text-muted-foreground block"> 点击模拟观众弹幕投票，观察顺位赛跑换位： </span>

            <div class="space-y-1.5">
              <div
                v-for="opt in mockData.options.slice(0, 6)"
                :key="opt.index"
                class="flex items-center justify-between p-1.5 rounded bg-muted/30 text-xs"
              >
                <span class="font-medium truncate max-w-[140px]">{{ opt.index }}. {{ opt.text }}</span>
                <div class="flex items-center gap-1">
                  <Button
                    size="xs"
                    variant="outline"
                    class="h-6 px-1.5"
                    @click="mockAddVote(opt.index, 1)"
                  >
                    +1
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    class="h-6 px-1.5"
                    @click="mockAddVote(opt.index, 10)"
                  >
                    +10
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    class="h-6 px-1.5 text-amber-500 hover:bg-amber-500/10"
                    @click="mockOvertake(opt.index)"
                  >
                    <component
                      :is="ArrowTrending24Filled"
                      class="h-3 w-3 mr-0.5"
                    />
                    反超
                  </Button>
                </div>
              </div>
            </div>

            <Separator />

            <div class="flex gap-2">
              <Button
                size="xs"
                variant="outline"
                class="flex-1 text-amber-500 border-amber-500/30"
                @click="toggleMockUrgent"
              >
                <component
                  :is="Timer24Regular"
                  class="h-3.5 w-3.5 mr-1"
                />
                剩余 8s (呼吸警告)
              </Button>
              <Button
                size="xs"
                variant="brand"
                class="flex-1"
                @click="toggleMockWinner"
              >
                <component
                  :is="Trophy24Regular"
                  class="h-3.5 w-3.5 mr-1"
                />
                胜出结算 (Reveal)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

    <!-- 批量导入选项弹窗 -->
    <Dialog v-model:open="showBatchModal">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-base"> 批量导入选项 (一行一个) </DialogTitle>
          <DialogDescription class="text-xs">
            粘贴或输入候选选项，每行一个（适合 5~30 项的大规模投票，如歌单点播、全英雄选择等）：
          </DialogDescription>
        </DialogHeader>

        <div class="py-2">
          <Textarea
            v-model="batchInputText"
            :rows="8"
            placeholder="选项A&#10;选项B&#10;选项C&#10;选项D..."
            class="text-xs font-mono"
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            @click="showBatchModal = false"
          >
            取消
          </Button>
          <Button
            variant="brand"
            @click="applyBatchOptions"
          >
            确认导入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 全局设置弹窗 -->
    <Dialog v-model:open="showSettingsModal">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle class="text-base"> 弹幕投票全局设置 </DialogTitle>
          <DialogDescription class="text-xs"> 此处设置将作为默认参数应用于新发起的投票和 OBS 渲染。 </DialogDescription>
        </DialogHeader>

        <div class="space-y-4 py-2">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="font-medium text-xs text-foreground">启用弹幕投票功能</div>
              <div class="text-[11px] text-muted-foreground">关闭后将忽略直播间发送的投票弹幕</div>
            </div>
            <Switch v-model="voteConfig.isEnabled" />
          </div>

          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="font-medium text-xs text-foreground">实时显示票数与进度</div>
              <div class="text-[11px] text-muted-foreground">OBS 挂件实时渲染各选项得票比率</div>
            </div>
            <Switch v-model="voteConfig.showResults" />
          </div>

          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="font-medium text-xs text-foreground">允许观众自由提名</div>
              <div class="text-[11px] text-muted-foreground">观众发送未在列表中的词条将自动追加为新选项</div>
            </div>
            <Switch v-model="voteConfig.allowCustomOptions" />
          </div>

          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="font-medium text-xs text-foreground">送礼按金额计票</div>
              <div class="text-[11px] text-muted-foreground">观众送礼时按电池金额折算追加票数</div>
            </div>
            <Switch v-model="voteConfig.allowGiftVoting" />
          </div>

          <Separator />

          <div class="space-y-1.5">
            <span class="text-xs text-muted-foreground block">默认主题风格</span>
            <div class="grid grid-cols-2 gap-2">
              <Button
                v-for="th in [
                  { key: 'glass', label: '毛玻璃 Modern Glass' },
                  { key: 'duel', label: '对决 Duel VS' },
                  { key: 'minimal', label: '极简 Minimal' },
                  { key: 'transparent', label: '无背景/纯透明' },
                ]"
                :key="th.key"
                size="xs"
                :variant="voteConfig.theme === th.key ? 'default' : 'outline'"
                class="justify-start"
                @click="voteConfig.theme = th.key"
              >
                {{ th.label }}
              </Button>
            </div>
          </div>

          <div class="space-y-1.5">
            <span class="text-xs text-muted-foreground block">OBS 画面停靠位置</span>
            <Select v-model="voteConfig.displayPosition">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="center"> 正中心 (默认) </SelectItem>
                <SelectItem value="top-center"> 顶部居中 (推荐长条对决) </SelectItem>
                <SelectItem value="bottom-right"> 右下角 </SelectItem>
                <SelectItem value="bottom-left"> 左下角 </SelectItem>
                <SelectItem value="top-right"> 右上角 </SelectItem>
                <SelectItem value="top-left"> 左上角 </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            @click="showSettingsModal = false"
          >
            取消
          </Button>
          <Button
            variant="brand"
            :loading="isLoading"
            @click="saveVoteConfig"
          >
            保存设置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
