<script setup lang="ts">
import {
  Add24Filled,
  ArrowClockwise24Regular,
  ArrowTrending24Filled,
  ChartMultiple24Regular,
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
import {
  NAlert,
  NButton,
  NButtonGroup,
  NCard,
  NCheckbox,
  NDivider,
  NEmpty,
  NFlex,
  NGrid,
  NGridItem,
  NIcon,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NInputNumber,
  NModal,
  NPopconfirm,
  NProgress,
  NRadio,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSpin,
  NSwitch,
  NTabPane,
  NTabs,
  NTag,
  NText,
  useMessage,
} from 'naive-ui'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { clearInterval, setInterval } from 'worker-timers'

import { useAccount } from '@/api/account'
import type {
  RequestCreateBulletVote,
  ResponseVoteSession,
  VoteConfig,
  VoteOBSData,
  VoteOptionDto,
} from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import DanmakuVoteCard from '@/shared/components/DanmakuVoteCard.vue'
import { CURRENT_HOST, VOTE_API_URL } from '@/shared/config'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import { usePersistedStorage } from '@/shared/storage/persist'
import { copyToClipboard } from '@/shared/utils'

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
  displayPosition: 'bottom-right',
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

const timeLeftMs = computed(() => {
  if (!currentVote.value?.endTime) return null
  const remain = currentVote.value.endTime * 1000 - nowMs.value
  return Math.max(0, remain)
})

function formatTime(ms: number | null): string {
  if (ms == null) return '进行中'
  const total = Math.ceil(ms / 1000)
  const mm = Math.floor(total / 60)
    .toString()
    .padStart(2, '0')
  const ss = (total % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
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

// 预设模板
const quickPresets = [
  { name: '红蓝 PK', title: '阵营对抗', options: ['红方', '蓝方'] },
  { name: '正反判断', title: '是否赞同', options: ['支持', '反对'] },
  { name: '三选一', title: '路线选择', options: ['方案 A', '方案 B', '方案 C'] },
  { name: '四选一', title: '你最喜欢的项目', options: ['选项 A', '选项 B', '选项 C', '选项 D'] },
]

function applyPreset(preset: { title: string; options: string[] }) {
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
interface SavedTemplate {
  name: string
  title: string
  options: string[]
}
const savedTemplates = usePersistedStorage<SavedTemplate[]>('DanmakuVoteTemplates', [])
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
const previewPosition = ref('bottom-right')
const previewMaxDisplay = ref(6)
const previewMode = ref<'live' | 'mock'>('mock')

// 模拟调试数据源
const mockData = ref<VoteOBSData>({
  sessionId: 9999,
  title: '本局英雄出装选择',
  isActive: true,
  isEnding: false,
  showResults: true,
  theme: 'glass',
  roundedCorners: true,
  displayPosition: 'bottom-right',
  totalVotes: 35,
  startTime: Math.floor(Date.now() / 1000) - 15,
  endTime: Math.floor(Date.now() / 1000) + 45,
  winnerOption: undefined,
  options: [
    { index: 1, text: '疾跑攻速流', count: 18, percentage: 51 },
    { index: 2, text: '纯肉反伤流', count: 12, percentage: 34 },
    { index: 3, text: '暴击秒杀流', count: 5, percentage: 15 },
  ],
})

// 重新计算 Mock 数据的百分比
function recalculateMockPercentages() {
  const total = mockData.value.options.reduce((sum, opt) => sum + opt.count, 0)
  mockData.value.totalVotes = total
  mockData.value.options.forEach((opt) => {
    opt.percentage = total > 0 ? Math.round((opt.count / total) * 100) : 0
  })
}

// 模拟加票
function mockAddVote(optionIndex: number, delta = 1) {
  const target = mockData.value.options.find((o) => o.index === optionIndex)
  if (target) {
    target.count += delta
    recalculateMockPercentages()
    message.info(`已给「${target.text}」增加 ${delta} 票`)
  }
}

// 模拟后方反超
function mockOvertake(targetIdx: number) {
  const leader = [...mockData.value.options].sort((a, b) => b.count - a.count)[0]
  const target = mockData.value.options.find((o) => o.index === targetIdx)
  if (target && leader) {
    target.count = leader.count + 3
    recalculateMockPercentages()
    message.success(`「${target.text}」已反超成为第 1 名！观察赛跑换位动效`)
  }
}

// 场景载入
function loadMockScene(scene: 'duel' | 'duel-top' | 'standard' | 'leaderboard') {
  if (scene === 'duel-top') {
    previewTheme.value = 'duel'
    previewPosition.value = 'top-center'
    mockData.value = {
      sessionId: 9999,
      title: '红蓝阵营对抗赛 (顶部长条 HUD)',
      isActive: true,
      isEnding: false,
      showResults: true,
      theme: 'duel',
      roundedCorners: true,
      displayPosition: 'top-center',
      totalVotes: 50,
      startTime: Math.floor(Date.now() / 1000) - 15,
      endTime: Math.floor(Date.now() / 1000) + 45,
      winnerOption: undefined,
      options: [
        { index: 1, text: '红方：炽热战队', count: 29, percentage: 58 },
        { index: 2, text: '蓝方：冰霜骑士', count: 21, percentage: 42 },
      ],
    }
  } else if (scene === 'duel') {
    previewTheme.value = 'duel'
    previewPosition.value = 'bottom-right'
    mockData.value = {
      sessionId: 9999,
      title: '红蓝阵营对抗赛',
      isActive: true,
      isEnding: false,
      showResults: true,
      theme: 'duel',
      roundedCorners: true,
      displayPosition: previewPosition.value,
      totalVotes: 42,
      startTime: Math.floor(Date.now() / 1000) - 10,
      endTime: Math.floor(Date.now() / 1000) + 50,
      winnerOption: undefined,
      options: [
        { index: 1, text: '红方：炽热战队', count: 24, percentage: 57 },
        { index: 2, text: '蓝方：冰霜骑士', count: 18, percentage: 43 },
      ],
    }
  } else if (scene === 'standard') {
    previewTheme.value = 'glass'
    mockData.value = {
      sessionId: 9999,
      title: '下一局挑战什么游戏？',
      isActive: true,
      isEnding: false,
      showResults: true,
      theme: 'glass',
      roundedCorners: true,
      displayPosition: previewPosition.value,
      totalVotes: 60,
      startTime: Math.floor(Date.now() / 1000) - 20,
      endTime: Math.floor(Date.now() / 1000) + 40,
      winnerOption: undefined,
      options: [
        { index: 1, text: '艾尔登法环', count: 28, percentage: 47 },
        { index: 2, text: '怪物猎人荒野', count: 18, percentage: 30 },
        { index: 3, text: '星露谷物语', count: 10, percentage: 17 },
        { index: 4, text: '杂谈休息', count: 4, percentage: 6 },
      ],
    }
  } else if (scene === 'leaderboard') {
    previewTheme.value = 'glass'
    previewMaxDisplay.value = 6
    const songs = [
      '恋爱循环',
      '晴天',
      '群青',
      '七里香',
      '残酷天使的行动纲领',
      'lemon',
      '起风了',
      '勾指起誓',
      '夜驱',
      '打上花火',
    ]
    const counts = [35, 30, 24, 18, 15, 12, 8, 6, 4, 2]
    const total = counts.reduce((a, b) => a + b, 0)
    mockData.value = {
      sessionId: 9999,
      title: '点歌大乱斗 (前 6 名进入排期)',
      isActive: true,
      isEnding: false,
      showResults: true,
      theme: 'glass',
      roundedCorners: true,
      displayPosition: previewPosition.value,
      totalVotes: total,
      startTime: Math.floor(Date.now() / 1000) - 10,
      endTime: Math.floor(Date.now() / 1000) + 60,
      winnerOption: undefined,
      options: songs.map((text, idx) => ({
        index: idx + 1,
        text,
        count: counts[idx],
        percentage: Math.round((counts[idx] / total) * 100),
      })),
    }
  }
}

// 模拟状态切换
function toggleMockUrgent() {
  mockData.value.isActive = true
  mockData.value.isEnding = false
  mockData.value.winnerOption = undefined
  mockData.value.endTime = Math.floor(Date.now() / 1000) + 8 // 8 秒倒计时，触发紧急呼吸
  message.info('已切换至最后 8s 紧急倒计时状态')
}

function toggleMockWinner() {
  const sorted = [...mockData.value.options].sort((a, b) => b.count - a.count)
  mockData.value.isActive = false
  mockData.value.isEnding = true
  mockData.value.winnerOption = sorted[0]?.text || '胜出选项'
  mockData.value.endTime = undefined
  message.success(`已触发结算揭晓动效：胜出者「${mockData.value.winnerOption}」`)
}

// 当前送往 Card 组件的数据
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
      startTime: Math.floor(Date.now() / 1000),
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

// API 操作
async function fetchVoteConfig() {
  try {
    const res = await QueryGetAPI<VoteConfig>(`${VOTE_API_URL}get-config`)
    if (res.code === 200 && res.data) {
      voteConfig.value = { ...voteConfig.value, ...res.data }
      previewTheme.value = (res.data.theme as any) || 'glass'
      previewPosition.value = res.data.displayPosition || 'bottom-right'
    }
  } catch (err) {
    console.error('获取配置失败:', err)
  }
}

async function saveVoteConfig() {
  try {
    isLoading.value = true
    const res = await QueryPostAPI(`${VOTE_API_URL}save-config`, voteConfig.value)
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
    const res = await QueryGetAPI<ResponseVoteSession>(`${VOTE_API_URL}get-active`)
    if (res.code === 200) {
      currentVote.value = res.data
    }
  } catch (err) {
    // 静默处理轮询异常
  }
}

async function fetchHistory() {
  try {
    const res = await QueryGetAPI<ResponseVoteSession[]>(`${VOTE_API_URL}history`, { limit: 15 })
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
    const res = await QueryPostAPI<ResponseVoteSession>(`${VOTE_API_URL}create`, payload)
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
    const res = await QueryGetAPI<ResponseVoteSession>(`${VOTE_API_URL}extend`, { seconds })
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
    const res = await QueryGetAPI<ResponseVoteSession>(`${VOTE_API_URL}end`, { id: currentVote.value.id })
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
    const res = await QueryGetAPI(`${VOTE_API_URL}delete`, { id })
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
  <div class="vote-manage-container">
    <ManagePageHeader
      title="弹幕投票"
      description="观众可通过直播间弹幕发送选项序号或文字参与投票，实时统计并投屏到 OBS 画面"
    >
      <template #action>
        <NFlex align="center" :size="8">
          <NRadioGroup v-model:value="activeTab" size="small">
            <NRadioButton value="console">
              <NFlex align="center" :size="4">
                <NIcon><Clock24Regular /></NIcon>
                <span>工作台</span>
              </NFlex>
            </NRadioButton>
            <NRadioButton value="preview">
              <NFlex align="center" :size="4">
                <NIcon><Desktop24Regular /></NIcon>
                <span>OBS 预览与调试</span>
              </NFlex>
            </NRadioButton>
          </NRadioGroup>

          <NButton secondary size="small" @click="showSettingsModal = true">
            <template #icon>
              <NIcon><Settings24Regular /></NIcon>
            </template>
            全局设置
          </NButton>
          <NButton type="primary" size="small" @click="copyObsLink(voteConfig.theme, voteConfig.displayPosition)">
            <template #icon>
              <NIcon><Copy24Regular /></NIcon>
            </template>
            复制 OBS 链接
          </NButton>
        </NFlex>
      </template>
    </ManagePageHeader>

    <!-- 视图 1：工作台 (发起与监控) -->
    <div v-show="activeTab === 'console'" style="margin-top: 16px">
      <NGrid cols="1 m:3" :x-gap="16" :y-gap="16">
        <!-- 左侧：实时控制看板 + 发起投票 (占 2 列) -->
        <NGridItem :span="2">
          <NFlex vertical :size="16">
            <!-- 1. 进行中的投票监控卡片 -->
            <NCard
              v-if="currentVote && currentVote.isActive"
              size="small"
              class="active-vote-card"
              :segmented="{ content: true }"
            >
              <template #header>
                <NFlex align="center" justify="space-between">
                  <NFlex align="center" :size="8">
                    <span class="pulse-dot"></span>
                    <NText strong style="font-size: 16px">{{ currentVote.title }}</NText>
                    <NTag type="warning" size="small" :bordered="false">
                      剩余：{{ formatTime(timeLeftMs) }}
                    </NTag>
                  </NFlex>
                  <NText depth="3" style="font-size: 13px">
                    总票数：<strong>{{ currentVote.totalVotes }}</strong> 票
                  </NText>
                </NFlex>
              </template>

              <!-- 动态选项统计条 -->
              <div class="active-options-list">
                <div
                  v-for="(opt, idx) in currentVote.options ?? []"
                  :key="idx"
                  class="active-option-row"
                  :class="{ 'is-leading': idx === leadingOptionIndex }"
                >
                  <NFlex justify="space-between" align="center" style="margin-bottom: 4px">
                    <NText :strong="idx === leadingOptionIndex">
                      <span class="idx-badge">{{ idx + 1 }}</span>
                      {{ opt.text }}
                      <NTag v-if="idx === leadingOptionIndex" type="warning" size="tiny" :bordered="false">
                        领先
                      </NTag>
                    </NText>
                    <NFlex align="center" :size="6">
                      <span class="opt-count">{{ opt.count }} 票</span>
                      <span class="opt-pct">{{ calcPercentage(opt.count, currentVote.totalVotes) }}%</span>
                    </NFlex>
                  </NFlex>
                  <NProgress
                    type="line"
                    :percentage="calcPercentage(opt.count, currentVote.totalVotes)"
                    :height="10"
                    :status="idx === leadingOptionIndex ? 'warning' : 'default'"
                  />
                </div>
              </div>

              <template #action>
                <NFlex justify="space-between" align="center">
                  <NFlex align="center" :size="8">
                    <NText depth="3" style="font-size: 12px">加时：</NText>
                    <NButtonGroup size="small">
                      <NButton secondary @click="extendDuration(30)">+30s</NButton>
                      <NButton secondary @click="extendDuration(60)">+60s</NButton>
                      <NButton secondary @click="extendDuration(120)">+2m</NButton>
                    </NButtonGroup>
                  </NFlex>

                  <NPopconfirm @positive-click="endVote">
                    <template #trigger>
                      <NButton type="warning" size="small">
                        <template #icon>
                          <NIcon><Pause24Regular /></NIcon>
                        </template>
                        提前结束
                      </NButton>
                    </template>
                    确定要提前结束当前投票并进入结算展示吗？
                  </NPopconfirm>
                </NFlex>
              </template>
            </NCard>

            <!-- 2. 发起新投票卡片 -->
            <NCard size="small" title="发起投票">
              <NSpin :show="isLoading">
                <NFlex vertical :size="14">
                  <!-- 快捷预设芯片 -->
                  <NFlex align="center" :size="8">
                    <NText depth="3" style="font-size: 12px">快捷预设：</NText>
                    <NButton
                      v-for="p in quickPresets"
                      :key="p.name"
                      size="tiny"
                      secondary
                      @click="applyPreset(p)"
                    >
                      <template #icon>
                        <NIcon><Sparkle24Regular /></NIcon>
                      </template>
                      {{ p.name }}
                    </NButton>
                  </NFlex>

                  <!-- 标题 -->
                  <NInput
                    v-model:value="formTitle"
                    placeholder="输入投票主题 (例如: 本局出装选择 / 下一把玩什么)"
                    size="small"
                    maxlength="50"
                    show-count
                  />

                  <!-- 选项列表 -->
                  <div class="form-options-editor">
                    <div v-for="(opt, idx) in formOptions" :key="opt.id" class="form-option-row">
                      <span class="form-option-idx">{{ idx + 1 }}</span>
                      <NInput
                        v-model:value="opt.text"
                        placeholder="选项文字"
                        size="small"
                        maxlength="30"
                        class="form-option-input"
                      />
                      <NButton
                        v-if="formOptions.length > 2"
                        size="tiny"
                        quaternary
                        type="error"
                        @click="removeOption(idx)"
                      >
                        <template #icon>
                          <NIcon><Delete24Regular /></NIcon>
                        </template>
                      </NButton>
                    </div>
                  </div>

                  <NFlex align="center" :size="10">
                    <NButton size="small" secondary @click="addOption">
                      <template #icon>
                        <NIcon><Add24Filled /></NIcon>
                      </template>
                      添加选项
                    </NButton>
                    <NButton size="small" secondary @click="openBatchModal">
                      批量粘贴/导入
                    </NButton>
                    <NButton
                      v-if="formOptions.length > 2"
                      size="small"
                      quaternary
                      @click="formOptions = [createFormOption('选项1'), createFormOption('选项2')]"
                    >
                      重置为 2 项
                    </NButton>
                  </NFlex>

                  <NDivider style="margin: 4px 0" />

                  <!-- 时长与规则 -->
                  <NFlex align="center" justify="space-between" :wrap="true">
                    <NFlex align="center" :size="12">
                      <NInputGroup style="width: 170px">
                        <NInputGroupLabel size="small">时长</NInputGroupLabel>
                        <NInputNumber
                          v-model:value="formDuration"
                          size="small"
                          :min="0"
                          :max="3600"
                          :step="30"
                          placeholder="秒"
                        />
                        <NInputGroupLabel size="small">秒</NInputGroupLabel>
                      </NInputGroup>

                      <NCheckbox v-model:checked="formAllowMultiple">
                        每人允许多次投票
                      </NCheckbox>
                    </NFlex>

                    <NButton type="primary" size="small" @click="createVote">
                      <template #icon>
                        <NIcon><Play24Regular /></NIcon>
                      </template>
                      {{ currentVote?.isActive ? '覆盖并重新发起' : '立即发起投票' }}
                    </NButton>
                  </NFlex>
                </NFlex>
              </NSpin>
            </NCard>
          </NFlex>
        </NGridItem>

        <!-- 右侧：模板库与历史记录 (占 1 列) -->
        <NGridItem :span="1">
          <NFlex vertical :size="16">
            <!-- 模板库卡片 -->
            <NCard size="small" title="我的模板库">
              <NFlex vertical :size="10">
                <NFlex :size="8">
                  <NInput
                    v-model:value="newTemplateName"
                    placeholder="当前选项存为模板..."
                    size="small"
                    style="flex: 1"
                  />
                  <NButton size="small" secondary @click="saveCustomTemplate">
                    保存
                  </NButton>
                </NFlex>

                <div v-if="savedTemplates.length === 0" class="empty-hint">
                  暂无保存的模板，可将上方表单存入模板库
                </div>
                <div v-else class="template-list">
                  <div v-for="(tpl, idx) in savedTemplates" :key="idx" class="template-item">
                    <div class="template-info" @click="applyPreset(tpl)">
                      <div class="template-name">{{ tpl.name }}</div>
                      <div class="template-preview">
                        {{ tpl.options.join(' / ') }}
                      </div>
                    </div>
                    <NButton size="tiny" quaternary type="error" @click.stop="deleteCustomTemplate(idx)">
                      <template #icon>
                        <NIcon><Delete24Regular /></NIcon>
                      </template>
                    </NButton>
                  </div>
                </div>
              </NFlex>
            </NCard>

            <!-- 历史记录卡片 -->
            <NCard size="small" title="历史投票记录">
              <div v-if="voteHistory.length === 0" class="empty-hint">
                暂无历史记录
              </div>
              <div v-else class="history-list">
                <div v-for="item in voteHistory" :key="item.id" class="history-item">
                  <div class="history-main">
                    <div class="history-title">{{ item.title }}</div>
                    <div class="history-meta">
                      <span>总票数：{{ item.totalVotes }}</span>
                      <span>{{ item.options.length }} 个选项</span>
                    </div>
                  </div>
                  <NFlex align="center" :size="4">
                    <NButton size="tiny" secondary @click="reuseHistory(item)">
                      复刻
                    </NButton>
                    <NPopconfirm @positive-click="deleteHistoryVote(item.id)">
                      <template #trigger>
                        <NButton size="tiny" quaternary type="error">
                          <template #icon>
                            <NIcon><Delete24Regular /></NIcon>
                          </template>
                        </NButton>
                      </template>
                      确定要删除这条记录吗？
                    </NPopconfirm>
                  </NFlex>
                </div>
              </div>
            </NCard>
          </NFlex>
        </NGridItem>
      </NGrid>
    </div>

    <!-- 视图 2：OBS 实时预览舞台与仿真调试控制台 -->
    <div v-show="activeTab === 'preview'" style="margin-top: 16px">
      <NGrid cols="1 m:3" :x-gap="16" :y-gap="16">
        <!-- 左侧：OBS 预览舞台 (占 2 列) -->
        <NGridItem :span="2">
          <NCard size="small" class="preview-stage-card">
            <template #header>
              <NFlex justify="space-between" align="center">
                <NFlex align="center" :size="8">
                  <NIcon><Eye24Regular /></NIcon>
                  <NText strong>OBS 画布实时预览 (1080P 比例视口)</NText>
                  <NTag :type="previewMode === 'live' ? 'success' : 'info'" size="tiny" :bordered="false">
                    {{ previewMode === 'live' ? '真实数据源' : '模拟仿真模式' }}
                  </NTag>
                </NFlex>

                <NFlex align="center" :size="8">
                  <NRadioGroup v-model:value="previewBg" size="small">
                    <NRadioButton value="checker">透明网格</NRadioButton>
                    <NRadioButton value="dark">纯黑背景</NRadioButton>
                    <NRadioButton value="light">浅色背景</NRadioButton>
                    <NRadioButton value="game">直播场景</NRadioButton>
                  </NRadioGroup>
                </NFlex>
              </NFlex>
            </template>

            <!-- 仿真舞台视口 -->
            <div class="obs-stage-viewport" :class="[`bg-${previewBg}`]">
              <div class="obs-stage-canvas">
                <DanmakuVoteCard
                  :data="activePreviewCardData"
                  :theme="previewTheme"
                  :position="previewPosition"
                  :max-display="previewMaxDisplay"
                  :current-time-ms="nowMs"
                />
              </div>
            </div>

            <template #action>
              <NFlex justify="space-between" align="center">
                <NText depth="3" style="font-size: 12px">
                  当前生成的 OBS URL 参数：<code>?theme={{ previewTheme }}&position={{ previewPosition }}&max={{ previewMaxDisplay }}</code>
                </NText>
                <NButton
                  size="small"
                  type="primary"
                  @click="copyObsLink(previewTheme, previewPosition, previewMaxDisplay)"
                >
                  <template #icon>
                    <NIcon><Copy24Regular /></NIcon>
                  </template>
                  复制当前调试参数的 OBS 链接
                </NButton>
              </NFlex>
            </template>
          </NCard>
        </NGridItem>

        <!-- 右侧：仿真调试控制台 (占 1 列) -->
        <NGridItem :span="1">
          <NFlex vertical :size="16">
            <!-- 场景与主题控制 -->
            <NCard size="small">
              <template #header>
                <NFlex align="center" :size="6">
                  <NIcon :component="Color24Regular" />
                  <span>视觉与场景调试</span>
                </NFlex>
              </template>
              <NFlex vertical :size="12">
                <div>
                  <NText depth="3" style="font-size: 12px; display: block; margin-bottom: 6px">
                    一键载入仿真场景：
                  </NText>
                  <NFlex :size="8">
                    <NButton size="tiny" secondary @click="loadMockScene('duel-top')">
                      红蓝顶栏长条
                    </NButton>
                    <NButton size="tiny" secondary @click="loadMockScene('duel')">
                      红蓝卡片
                    </NButton>
                    <NButton size="tiny" secondary @click="loadMockScene('standard')">
                      四选一投票
                    </NButton>
                    <NButton size="tiny" secondary @click="loadMockScene('leaderboard')">
                      10人排行榜赛跑
                    </NButton>
                  </NFlex>
                </div>

                <NDivider style="margin: 4px 0" />

                <div>
                  <NText depth="3" style="font-size: 12px; display: block; margin-bottom: 6px">
                    预设主题：
                  </NText>
                  <NRadioGroup v-model:value="previewTheme" size="small">
                    <NRadioButton value="glass">毛玻璃 Glass</NRadioButton>
                    <NRadioButton value="duel">对决 Duel</NRadioButton>
                    <NRadioButton value="minimal">极简 Minimal</NRadioButton>
                    <NRadioButton value="transparent">无背景/纯透明 (贴素材)</NRadioButton>
                  </NRadioGroup>
                </div>

                <div>
                  <NText depth="3" style="font-size: 12px; display: block; margin-bottom: 6px">
                    屏幕对齐位置：
                  </NText>
                  <NSelect
                    v-model:value="previewPosition"
                    size="small"
                    :options="[
                      { label: '顶部居中 (推荐长条对决)', value: 'top-center' },
                      { label: '右下角 (默认)', value: 'bottom-right' },
                      { label: '左下角', value: 'bottom-left' },
                      { label: '右上角', value: 'top-right' },
                      { label: '左上角', value: 'top-left' },
                      { label: '正中央', value: 'center' },
                    ]"
                  />
                </div>

                <div>
                  <NText depth="3" style="font-size: 12px; display: block; margin-bottom: 6px">
                    排行榜最大显示行数：
                  </NText>
                  <NInputNumber
                    v-model:value="previewMaxDisplay"
                    size="small"
                    :min="2"
                    :max="20"
                  />
                </div>
              </NFlex>
            </NCard>

            <!-- 互动模拟控制 -->
            <NCard size="small">
              <template #header>
                <NFlex align="center" :size="6">
                  <NIcon :component="Flash24Regular" />
                  <span>实时互动模拟</span>
                </NFlex>
              </template>
              <NFlex vertical :size="12">
                <NText depth="3" style="font-size: 12px">
                  点击按钮模拟观众弹幕投票，观察实时进度变化与 FLIP 顺位赛跑换位：
                </NText>

                <div class="mock-vote-buttons">
                  <div
                    v-for="opt in mockData.options.slice(0, 6)"
                    :key="opt.index"
                    class="mock-vote-row"
                  >
                    <span class="mock-opt-name">{{ opt.index }}. {{ opt.text }}</span>
                    <NFlex align="center" :size="4">
                      <NButton size="tiny" secondary @click="mockAddVote(opt.index, 1)">
                        +1
                      </NButton>
                      <NButton size="tiny" secondary @click="mockAddVote(opt.index, 10)">
                        +10
                      </NButton>
                      <NButton size="tiny" quaternary type="warning" @click="mockOvertake(opt.index)">
                        <template #icon>
                          <NIcon><ArrowTrending24Filled /></NIcon>
                        </template>
                        反超
                      </NButton>
                    </NFlex>
                  </div>
                </div>

                <NDivider style="margin: 4px 0" />

                <div>
                  <NText depth="3" style="font-size: 12px; display: block; margin-bottom: 6px">
                    模拟倒计时与状态：
                  </NText>
                  <NFlex :size="8">
                    <NButton size="tiny" type="warning" secondary @click="toggleMockUrgent">
                      <template #icon><NIcon :component="Timer24Regular" /></template>
                      剩余 8s (呼吸警告)
                    </NButton>
                    <NButton size="tiny" type="success" secondary @click="toggleMockWinner">
                      <template #icon><NIcon :component="Trophy24Regular" /></template>
                      胜出结算 (Reveal)
                    </NButton>
                  </NFlex>
                </div>
              </NFlex>
            </NCard>
          </NFlex>
        </NGridItem>
      </NGrid>
    </div>

    <!-- 批量导入选项弹窗 -->
    <NModal
      v-model:show="showBatchModal"
      preset="card"
      title="批量导入选项 (一行一个)"
      style="width: 480px; max-width: 95vw"
    >
      <NFlex vertical :size="12">
        <NText depth="3" style="font-size: 12px">
          请粘贴或输入候选选项，每行一个（适合 5~30 项的大规模投票，如歌单点播、全英雄选择、活动评选等）：
        </NText>
        <NInput
          v-model:value="batchInputText"
          type="textarea"
          :rows="8"
          placeholder="选项A&#10;选项B&#10;选项C&#10;选项D..."
        />
      </NFlex>
      <template #footer>
        <NFlex justify="end" :size="10">
          <NButton secondary @click="showBatchModal = false">取消</NButton>
          <NButton type="primary" @click="applyBatchOptions">确认导入</NButton>
        </NFlex>
      </template>
    </NModal>

    <!-- 全局设置弹窗 -->
    <NModal
      v-model:show="showSettingsModal"
      preset="card"
      title="弹幕投票全局设置"
      style="width: 540px; max-width: 95vw"
    >
      <NSpin :show="isLoading">
        <NFlex vertical :size="14">
          <NAlert type="info" :show-icon="false" style="font-size: 12px">
            此处设置将作为默认参数应用于新发起的投票和 OBS 渲染。
          </NAlert>

          <NFlex justify="space-between" align="center">
            <div>
              <div style="font-weight: 600; font-size: 13px">启用弹幕投票功能</div>
              <NText depth="3" style="font-size: 11px">关闭后将忽略直播间发送的投票弹幕</NText>
            </div>
            <NSwitch v-model:value="voteConfig.isEnabled" />
          </NFlex>

          <NFlex justify="space-between" align="center">
            <div>
              <div style="font-weight: 600; font-size: 13px">实时显示票数与进度</div>
              <NText depth="3" style="font-size: 11px">OBS 挂件实时渲染各选项得票比率</NText>
            </div>
            <NSwitch v-model:value="voteConfig.showResults" />
          </NFlex>

          <NFlex justify="space-between" align="center">
            <div>
              <div style="font-weight: 600; font-size: 13px">允许观众自由提名</div>
              <NText depth="3" style="font-size: 11px">观众发送未在列表中的词条将自动追加为新选项</NText>
            </div>
            <NSwitch v-model:value="voteConfig.allowCustomOptions" />
          </NFlex>

          <NFlex justify="space-between" align="center">
            <div>
              <div style="font-weight: 600; font-size: 13px">送礼按金额计票</div>
              <NText depth="3" style="font-size: 11px">观众送礼时按电池金额折算追加票数</NText>
            </div>
            <NSwitch v-model:value="voteConfig.allowGiftVoting" />
          </NFlex>

          <NDivider style="margin: 4px 0" />

          <div>
            <div style="font-weight: 600; font-size: 13px; margin-bottom: 6px">默认主题风格</div>
            <NRadioGroup v-model:value="voteConfig.theme" size="small">
              <NRadioButton value="glass">毛玻璃 Modern Glass</NRadioButton>
              <NRadioButton value="duel">对决 Duel VS</NRadioButton>
              <NRadioButton value="minimal">极简 Minimal</NRadioButton>
              <NRadioButton value="transparent">无背景/纯透明 (贴素材)</NRadioButton>
            </NRadioGroup>
          </div>

          <div>
            <div style="font-weight: 600; font-size: 13px; margin-bottom: 6px">OBS 画面停靠位置</div>
            <NSelect
              v-model:value="voteConfig.displayPosition"
              size="small"
              :options="[
                { label: '顶部居中 (推荐长条对决)', value: 'top-center' },
                { label: '右下角 (推荐卡片)', value: 'bottom-right' },
                { label: '左下角', value: 'bottom-left' },
                { label: '右上角', value: 'top-right' },
                { label: '左上角', value: 'top-left' },
                { label: '正中央', value: 'center' },
              ]"
            />
          </div>
        </NFlex>
      </NSpin>
      <template #footer>
        <NFlex justify="end" :size="10">
          <NButton secondary @click="showSettingsModal = false">取消</NButton>
          <NButton type="primary" :loading="isLoading" @click="saveVoteConfig">保存设置</NButton>
        </NFlex>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.vote-manage-container {
  max-width: 1380px;
  margin: 0 auto;
}

/* 活跃投票监控 */
.active-vote-card {
  border-left: 3px solid #f59e0b;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
  animation: pulse-dot-anim 1.5s infinite;
}

@keyframes pulse-dot-anim {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}

.active-options-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.active-option-row {
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--vtsuru-bg-muted, rgba(0, 0, 0, 0.02));
  border: 1px solid var(--vtsuru-border, rgba(0, 0, 0, 0.06));
}

.active-option-row.is-leading {
  background: rgba(245, 158, 11, 0.05);
  border-color: rgba(245, 158, 11, 0.3);
}

.idx-badge {
  font-weight: 800;
  margin-right: 6px;
  color: var(--vtsuru-fg-muted);
}

.opt-count {
  font-size: 13px;
  font-weight: 600;
}

.opt-pct {
  font-size: 13px;
  font-weight: 700;
  color: #f59e0b;
  font-family: monospace;
}

/* 发起表单 */
.form-options-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 280px;
  overflow-y: auto;
  padding-right: 4px;
}

.form-option-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-option-idx {
  font-size: 12px;
  font-weight: 700;
  width: 18px;
  text-align: center;
  color: var(--vtsuru-fg-muted);
}

.form-option-input {
  flex: 1;
}

/* 模板列表 */
.empty-hint {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
  text-align: center;
  padding: 16px 0;
}

.template-list, .history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
}

.template-item, .history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--vtsuru-bg-muted, rgba(0, 0, 0, 0.02));
  border: 1px solid var(--vtsuru-border, rgba(0, 0, 0, 0.06));
}

.template-info {
  flex: 1;
  cursor: pointer;
}

.template-name {
  font-size: 13px;
  font-weight: 600;
}

.template-preview {
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}

.history-main {
  flex: 1;
}

.history-title {
  font-size: 13px;
  font-weight: 600;
}

.history-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
}

/* ================= OBS 预览舞台 ================= */
.preview-stage-card {
  overflow: hidden;
}

.obs-stage-viewport {
  width: 100%;
  height: 480px;
  border-radius: 12px;
  border: 1px solid var(--vtsuru-border, rgba(255, 255, 255, 0.1));
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.3s ease;
}

.obs-stage-viewport.bg-checker {
  background-color: #18181b;
  background-image:
    linear-gradient(45deg, #27272a 25%, transparent 25%),
    linear-gradient(-45deg, #27272a 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #27272a 75%),
    linear-gradient(-45deg, transparent 75%, #27272a 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
}

.obs-stage-viewport.bg-dark {
  background-color: #09090b;
}

.obs-stage-viewport.bg-light {
  background-color: #f4f4f5;
}

.obs-stage-viewport.bg-game {
  background-image: linear-gradient(rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.6)), radial-gradient(circle at center, #1e1b4b 0%, #0f172a 100%);
  background-size: cover;
  background-position: center;
}

.obs-stage-canvas {
  width: 100%;
  height: 100%;
  padding: 24px;
  box-sizing: border-box;
}

/* 互动模拟按钮列表 */
.mock-vote-buttons {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 240px;
  overflow-y: auto;
}

.mock-vote-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--vtsuru-bg-muted, rgba(0, 0, 0, 0.02));
  border: 1px solid var(--vtsuru-border, rgba(0, 0, 0, 0.06));
}

.mock-opt-name {
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 110px;
}
</style>
