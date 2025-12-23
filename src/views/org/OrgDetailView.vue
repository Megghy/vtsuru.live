<script setup lang="ts">
import {
  ArrowBack,
  ChatbubblesOutline,
  CopyOutline,
  LogOutOutline,
  Pencil,
  PeopleOutline,
  RefreshOutline,
  SearchOutline,
  TimeOutline,
  TrashOutline,
  TrendingDown,
  TrendingUp,
  WalletOutline,
} from '@vicons/ionicons5'
import { BarChart, LineChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import {
  NAlert,
  NAvatar,
  NButton,
  NCard,
  NCollapse,
  NCollapseItem,
  NDescriptions,
  NDescriptionsItem,
  NDivider,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
  NHeatmap,
  NIcon,
  NImage,
  NInput,
  NInputNumber,
  NList,
  NListItem,
  NModal,
  NNumberAnimation,
  NPageHeader,
  NPopconfirm,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSkeleton,
  NSpace,
  NSpin,
  NStatistic,
  NSwitch,
  NTabPane,
  NTabs,
  NTag,
  NTime,
  NTooltip,
  useMessage,
  useThemeVars,
} from 'naive-ui'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isLoggedIn } from '@/api/account'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'
import UserAutocompleteSelect from '@/components/common/UserAutocompleteSelect.vue'
import { ORG_API_URL } from '@/data/constants'

// 注册必要的组件
// @ts-expect-error
// eslint-disable-next-line
;(echarts as any).use([
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  LineChart,
  BarChart,
  CanvasRenderer,
  MarkPointComponent,
  MarkLineComponent,
  DataZoomComponent,
])

interface ChartItem {
  income: number
  interactionCount: number
  danmakuCount: number
  payingUsers: number
  interactionUsers: number
  liveMinutes: number
  likeCount: number
}

interface Summary {
  last7Days: {
    totalIncome: number
    totalInteractions: number
    totalDanmakuCount: number
    totalLiveMinutes: number
    dailyAvgIncome: number
    dailyAvgDanmaku: number
    incomeTrend: number
    interactionTrend: number
    danmakuTrend: number
    activeLiveDays: number
    interactionUsers: number
    payingUsers: number
    interactionUsersTrend: number
    payingUsersTrend: number
  }
  last30Days: {
    totalIncome: number
    totalInteractions: number
    totalDanmakuCount: number
    totalLiveMinutes: number
    dailyAvgIncome: number
    dailyAvgDanmaku: number
    incomeTrend: number
    interactionTrend: number
    danmakuTrend: number
    activeLiveDays: number
    interactionUsers: number
    payingUsers: number
  }
}

function openStreamerDetailDrawer(streamerUserId: number) {
  if (streamerUserId <= 0) return
  selectedStreamerId.value = streamerUserId
  showStreamerDetailDrawer.value = true
}

async function loadStreamerDetail(reset: boolean) {
  if (!isLoggedIn.value) return
  if (!selectedStreamerId.value) return
  if (!orgId.value) return

  if (reset) {
    streamerDetail.value = null
    streamerDetailLives.value = []
    streamerDetailPage.value = 1
    streamerDetailHasMoreLives.value = false
  }

  loadingStreamerDetail.value = true
  try {
    const resp = await QueryGetAPI<OrgStreamerDetailModel>(
      `${ORG_API_URL}${orgId.value}/streamers/${selectedStreamerId.value}/detail`,
      {
        page: streamerDetailPage.value,
        pageSize: streamerDetailPageSize.value,
      },
    )

    if (resp.code !== 200) {
      message.error(resp.message)
      return
    }

    streamerDetail.value = resp.data

    if (streamerDetailPage.value === 1) {
      streamerDetailLives.value = resp.data.lives || []
    } else {
      streamerDetailLives.value = [...streamerDetailLives.value, ...(resp.data.lives || [])]
    }

    streamerDetailHasMoreLives.value = (resp.data.lives?.length || 0) >= streamerDetailPageSize.value

    editStreamerStatus.value = resp.data.status
    editStreamerNote.value = resp.data.note || ''
  } catch (err) {
    message.error(err instanceof Error ? err.message : '加载失败')
  } finally {
    loadingStreamerDetail.value = false
  }
}

async function loadMoreStreamerLives() {
  if (loadingStreamerDetail.value) return
  if (!streamerDetailHasMoreLives.value) return
  streamerDetailPage.value += 1
  await loadStreamerDetail(false)
}

async function updateStreamerSettings() {
  if (!isLoggedIn.value) return
  if (!isOrgAdmin.value) return
  if (!selectedStreamerId.value) return
  if (!orgId.value) return

  savingStreamerSettings.value = true
  try {
    const resp = await QueryPostAPI<void>(`${ORG_API_URL}${orgId.value}/streamer/update`, {
      targetStreamerUserId: selectedStreamerId.value,
      status: editStreamerStatus.value ?? undefined,
      note: editStreamerNote.value,
    })

    if (resp.code === 200) {
      message.success('已保存')
      await loadStreamers()
      await loadStreamerDetail(true)
    } else {
      message.error(resp.message)
    }
  } catch (err) {
    message.error(err instanceof Error ? err.message : '保存失败')
  } finally {
    savingStreamerSettings.value = false
  }
}

interface AnalyzeData {
  summary: Summary
  chartData: Record<number, ChartItem>
}

interface UserBasicInfo {
  name: string
  id: number
  isBiliAuthed: boolean
  faceUrl?: string
}

interface LiveInfoModel {
  liveId: string
  isFinish: boolean
  parentArea: string
  area: string
  coverUrl: string
  danmakusCount: number
  startAt: number
  stopAt: number | null
  title: string
  totalIncome: number
  totalIncomeWithGuard: number
  likeCount: number
  paymentCount: number
  interactionCount: number
}

interface OrgLiveItem {
  streamer: UserBasicInfo
  live: LiveInfoModel
}

interface OrgInfoModel {
  id: number
  name: string
  ownerUserId: number
  role: number
}

interface OrgInviteResponseModel {
  token: string
  expiresAt: number
  joinUrl: string
}

interface OrgInviteMemberListItem {
  token: string
  joinUrl: string
  expiresAt: number
  status: number
  role: number
  createdByUserId: number
  createdByUserName: string | null
  targetUserId: number | null
  targetUserName: string | null
  usedCount: number
  lastUsedAt: number | null
  isRevoked: boolean
}

interface OrgInviteStreamerListItem {
  token: string
  joinUrl: string
  expiresAt: number
  status: number
  createdByUserId: number
  createdByUserName: string | null
  targetStreamerUserId: number | null
  targetStreamerUserName: string | null
  usedCount: number
  lastUsedAt: number | null
  isRevoked: boolean
}

interface OrgStreamerItem {
  streamer: UserBasicInfo
  status: number
  addedAt: number
  respondedAt: number | null
  addedByUserId: number
}

interface HeatmapDataItem {
  timestamp: number
  value: number
}

interface StreamerLiveSummary {
  totalIncome: number
  totalIncomeWithGuard: number
  totalDanmakuCount: number
  totalInteractionCount: number
  totalLikeCount: number
  totalPayCount: number
  totalLiveMinutes: number
  totalUniqueInteractionUsers: number
  totalUniquePayingUsers: number
  liveCount: number
}

interface OrgStreamerDetailModel {
  streamer: UserBasicInfo
  status: number
  note: string | null
  addedAt: number
  respondedAt: number | null
  summary: StreamerLiveSummary
  heatmap: HeatmapDataItem[]
  lives: LiveInfoModel[]
  page: number
  pageSize: number
}

interface OrgMemberItem {
  user: UserBasicInfo
  role: number
  joinedAt: number
}

const route = useRoute()
const router = useRouter()
const message = useMessage()
const themeVars = useThemeVars()

const orgId = computed(() => Number(route.params.orgId || 0))

const orgName = ref<string>('')
const orgInfo = ref<OrgInfoModel | null>(null)

const loadingOrgs = ref(false)
const loadingAnalyze = ref(true)
const loadingLives = ref(true)
const loadingStreamers = ref(true)
const loadingMembers = ref(true)

const loadingMemberInvites = ref(false)
const loadingStreamerInvites = ref(false)
const memberInvites = ref<OrgInviteMemberListItem[]>([])
const streamerInvites = ref<OrgInviteStreamerListItem[]>([])

const analyzeData = ref<AnalyzeData | null>(null)
const lives = ref<OrgLiveItem[]>([])
const streamers = ref<OrgStreamerItem[]>([])
const members = ref<OrgMemberItem[]>([])

const includeAllStreamers = ref(false)

const showStreamerDetailDrawer = ref(false)
const selectedStreamerId = ref<number | null>(null)
const loadingStreamerDetail = ref(false)
const streamerDetail = ref<OrgStreamerDetailModel | null>(null)
const streamerDetailLives = ref<LiveInfoModel[]>([])
const streamerDetailPage = ref(1)
const streamerDetailPageSize = ref(20)
const streamerDetailHasMoreLives = ref(false)

const editStreamerStatus = ref<number | null>(null)
const editStreamerNote = ref<string>('')
const savingStreamerSettings = ref(false)

const creatingMemberInvite = ref(false)
const creatingStreamerInvite = ref(false)
const memberInviteRole = ref<number>(2)
const memberInviteTargetUserId = ref<number | null>(null)
const memberInviteExpireDays = ref<number | null>(7)
const streamerInviteTargetUserId = ref<number | null>(null)
const streamerInviteExpireDays = ref<number | null>(7)

const memberInviteUrl = ref<string>('')
const streamerInviteUrl = ref<string>('')

const showRenameModal = ref(false)
const renaming = ref(false)
const newOrgName = ref('')

const chartRef = ref<HTMLElement | null>(null)
let mainChart: echarts.ECharts | null = null

const selectedMetrics = ref<string[]>(['income', 'interactionCount'])
const chartMetrics = [
  { label: '收入', value: 'income', color: '#f5a623', type: 'line', yAxisIndex: 1 },
  { label: '互动数', value: 'interactionCount', color: '#2080f0', type: 'line', yAxisIndex: 0 },
  { label: '弹幕数', value: 'danmakuCount', color: '#18a058', type: 'line', yAxisIndex: 0 },
  { label: '点赞数', value: 'likeCount', color: '#d03050', type: 'line', yAxisIndex: 0 },
  { label: '互动人数', value: 'interactionUsers', color: '#8a2be2', type: 'bar', yAxisIndex: 0 },
  { label: '付费人数', value: 'payingUsers', color: '#ff69b4', type: 'bar', yAxisIndex: 0 },
]

const summaryRange = ref<'last7Days' | 'last30Days'>('last7Days')
const summaryData = computed(() => {
  if (!analyzeData.value?.summary) return null
  return analyzeData.value.summary[summaryRange.value]
})

const streamerSearch = ref('')
const memberSearch = ref('')

function inviteStatusLabel(status: number): string {
  if (status === 0) return '有效'
  if (status === 1) return '已过期'
  if (status === 2) return '已撤销'
  if (status === 3) return '已使用'
  if (status === 4) return '已接受'
  if (status === 5) return '已拒绝'
  return `未知(${status})`
}

function inviteStatusTagType(status: number): 'success' | 'info' | 'warning' | 'error' | 'default' {
  if (status === 0) return 'success'
  if (status === 4) return 'success'
  if (status === 1) return 'warning'
  if (status === 2) return 'error'
  if (status === 5) return 'error'
  if (status === 3) return 'info'
  return 'default'
}

const filteredStreamers = computed(() => {
  if (!streamerSearch.value) return streamers.value
  const lowerSearch = streamerSearch.value.toLowerCase()
  return streamers.value.filter(s =>
    s.streamer.name.toLowerCase().includes(lowerSearch) ||
    String(s.streamer.id).includes(lowerSearch)
  )
})

const filteredMembers = computed(() => {
  if (!memberSearch.value) return members.value
  const lowerSearch = memberSearch.value.toLowerCase()
  return members.value.filter(m =>
    m.user.name.toLowerCase().includes(lowerSearch) ||
    String(m.user.id).includes(lowerSearch)
  )
})

const hasChartData = computed(() => analyzeData.value && Object.keys(analyzeData.value.chartData || {}).length > 0)

const myRole = computed(() => orgInfo.value?.role ?? null)
const isOrgAdmin = computed(() => myRole.value === 0 || myRole.value === 1)
const roleLabel = computed(() => {
  return (role: number) => {
    if (role === 0) return 'Owner'
    if (role === 1) return 'Admin'
    return 'Member'
  }
})

function streamerStatusLabel(status: number) {
  if (status === 0) return 'Pending'
  if (status === 1) return 'Active'
  if (status === 2) return 'Rejected'
  if (status === 3) return 'Removed'
  return String(status)
}

function streamerStatusTagType(status: number): 'default' | 'success' | 'warning' | 'error' | 'info' {
  if (status === 1) return 'success'
  if (status === 0) return 'warning'
  if (status === 2) return 'error'
  return 'default'
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    message.success('已复制到剪贴板')
  } catch (err) {
    message.error(err instanceof Error ? err.message : '复制失败')
  }
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp > 10000000000 ? timestamp : timestamp * 1000)
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

function getChartDataArray() {
  if (!analyzeData.value?.chartData) return []
  return Object.entries(analyzeData.value.chartData)
    .map(([timestamp, data]) => ({
      timestamp: Number.parseInt(timestamp, 10),
      date: formatDate(Number.parseInt(timestamp, 10)),
      ...data,
    }))
    .sort((a, b) => a.timestamp - b.timestamp)
}

function getThemeColors() {
  return {
    textColor: themeVars.value.textColor2,
    axisLineColor: themeVars.value.borderColor,
    splitLineColor: themeVars.value.dividerColor,
  }
}

function initChart() {
  if (!chartRef.value) return
  const chartData = getChartDataArray()
  if (chartData.length === 0) return

  mainChart = echarts.init(chartRef.value)
  updateChartOption()
}

function updateChartOption() {
  if (!mainChart) return
  const chartData = getChartDataArray()
  const dates = chartData.map(item => item.date)
  const themeColors = getThemeColors()

  const showRightAxis = selectedMetrics.value.includes('income')
  const showLeftAxis = selectedMetrics.value.some(m => m !== 'income')

  const series = selectedMetrics.value.map((metricKey) => {
    const metricConfig = chartMetrics.find(m => m.value === metricKey)
    if (!metricConfig) return null

    return {
      name: metricConfig.label,
      type: metricConfig.type,
      data: chartData.map(item => (item as any)[metricKey]),
      smooth: true,
      yAxisIndex: (metricKey === 'income' && showLeftAxis) ? 1 : 0,
      itemStyle: { color: metricConfig.color },
      areaStyle: metricConfig.type === 'line'
        ? { opacity: 0.1, color: metricConfig.color }
        : undefined,
      barMaxWidth: metricConfig.type === 'bar' ? '20%' : undefined,
    }
  }).filter(Boolean)

  const yAxis: any[] = []
  if (showLeftAxis) {
    yAxis.push({
      type: 'value',
      position: 'left',
      name: '数量',
      axisLine: { show: true, lineStyle: { color: themeColors.axisLineColor } },
      axisLabel: { color: themeColors.textColor },
      splitLine: { lineStyle: { color: themeColors.splitLineColor } },
      nameTextStyle: { color: themeColors.textColor },
    })
  } else if (showRightAxis) {
    yAxis.push({
      type: 'value',
      position: 'left',
      name: '金额',
      axisLine: { show: true, lineStyle: { color: themeColors.axisLineColor } },
      axisLabel: { color: themeColors.textColor },
      splitLine: { lineStyle: { color: themeColors.splitLineColor } },
      nameTextStyle: { color: themeColors.textColor },
    })
  }

  if (showLeftAxis && showRightAxis) {
    yAxis.push({
      type: 'value',
      position: 'right',
      name: '金额',
      axisLine: { show: true, lineStyle: { color: themeColors.axisLineColor } },
      axisLabel: { color: themeColors.textColor },
      splitLine: { show: false },
      nameTextStyle: { color: themeColors.textColor },
    })
  }

  mainChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: selectedMetrics.value.map(m => chartMetrics.find(x => x.value === m)?.label).filter(Boolean), textStyle: { color: themeColors.textColor } },
    grid: { left: '3%', right: '4%', bottom: '12%', containLabel: true },
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      { type: 'slider', start: 0, end: 100, height: 20, bottom: 0 },
    ],
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { color: themeColors.textColor },
      axisLine: { lineStyle: { color: themeColors.axisLineColor } },
    },
    yAxis,
    series,
  })
}

function disposeChart() {
  if (mainChart) {
    mainChart.dispose()
    mainChart = null
  }
}

function getTrendType(value: number): 'success' | 'error' | 'default' {
  if (value > 0) return 'success'
  if (value < 0) return 'error'
  return 'default'
}

async function loadOrgInfo() {
  if (!isLoggedIn.value) return
  loadingOrgs.value = true
  try {
    const resp = await QueryGetAPI<OrgInfoModel>(`${ORG_API_URL}${orgId.value}`)
    if (resp.code === 200) {
      orgInfo.value = resp.data
      orgName.value = resp.data.name
      return
    }

    orgInfo.value = null
    orgName.value = `Org ${orgId.value}`
    message.error(resp.message)
  } catch (err) {
    orgInfo.value = null
    orgName.value = `Org ${orgId.value}`
    message.error(err instanceof Error ? err.message : '加载失败')
  } finally {
    loadingOrgs.value = false
  }
}

async function loadStreamers() {
  if (!isLoggedIn.value) return
  loadingStreamers.value = true
  try {
    const includeAll = isOrgAdmin.value ? includeAllStreamers.value : false
    const resp = await QueryGetAPI<OrgStreamerItem[]>(`${ORG_API_URL}${orgId.value}/streamers`, {
      includeAll: includeAll ? true : undefined,
    })
    if (resp.code === 200) {
      streamers.value = resp.data
    } else {
      message.error(resp.message)
    }
  } catch (err) {
    message.error(err instanceof Error ? err.message : '加载失败')
  } finally {
    loadingStreamers.value = false
  }
}

async function loadMembers() {
  if (!isLoggedIn.value) return
  loadingMembers.value = true
  try {
    const resp = await QueryGetAPI<OrgMemberItem[]>(`${ORG_API_URL}${orgId.value}/members`)
    if (resp.code === 200) {
      members.value = resp.data
    } else {
      message.error(resp.message)
    }
  } catch (err) {
    message.error(err instanceof Error ? err.message : '加载成员失败')
  } finally {
    loadingMembers.value = false
  }
}

async function loadMemberInvites() {
  if (!isLoggedIn.value) return
  if (!isOrgAdmin.value) return

  loadingMemberInvites.value = true
  try {
    const resp = await QueryGetAPI<OrgInviteMemberListItem[]>(`${ORG_API_URL}${orgId.value}/invites/member`)
    if (resp.code === 200) {
      memberInvites.value = resp.data
    } else {
      message.error(resp.message)
    }
  } catch (err) {
    message.error(err instanceof Error ? err.message : '加载邀请失败')
  } finally {
    loadingMemberInvites.value = false
  }
}

async function loadStreamerInvites() {
  if (!isLoggedIn.value) return
  if (!isOrgAdmin.value) return

  loadingStreamerInvites.value = true
  try {
    const resp = await QueryGetAPI<OrgInviteStreamerListItem[]>(`${ORG_API_URL}${orgId.value}/invites/streamer`)
    if (resp.code === 200) {
      streamerInvites.value = resp.data
    } else {
      message.error(resp.message)
    }
  } catch (err) {
    message.error(err instanceof Error ? err.message : '加载邀请失败')
  } finally {
    loadingStreamerInvites.value = false
  }
}

async function createMemberInvite() {
  if (!isLoggedIn.value) return
  if (!isOrgAdmin.value) return

  creatingMemberInvite.value = true
  try {
    const body: any = {
      role: memberInviteRole.value,
      targetUserId: memberInviteTargetUserId.value || undefined,
      expireDays: memberInviteExpireDays.value || undefined,
    }
    const resp = await QueryPostAPI<OrgInviteResponseModel>(`${ORG_API_URL}${orgId.value}/invite/member`, body)
    if (resp.code === 200) {
      memberInviteUrl.value = resp.data.joinUrl
      await copyToClipboard(resp.data.joinUrl)
      await loadMemberInvites()
    } else {
      message.error(resp.message)
    }
  } catch (err) {
    message.error(err instanceof Error ? err.message : '生成邀请失败')
  } finally {
    creatingMemberInvite.value = false
  }
}

async function createStreamerInvite() {
  if (!isLoggedIn.value) return
  if (!isOrgAdmin.value) return

  creatingStreamerInvite.value = true
  try {
    const body: any = {
      targetStreamerUserId: streamerInviteTargetUserId.value || undefined,
      expireDays: streamerInviteExpireDays.value || undefined,
    }
    const resp = await QueryPostAPI<OrgInviteResponseModel>(`${ORG_API_URL}${orgId.value}/invite/streamer`, body)
    if (resp.code === 200) {
      streamerInviteUrl.value = resp.data.joinUrl
      await copyToClipboard(resp.data.joinUrl)
      await loadStreamerInvites()
    } else {
      message.error(resp.message)
    }
  } catch (err) {
    message.error(err instanceof Error ? err.message : '生成邀请失败')
  } finally {
    creatingStreamerInvite.value = false
  }
}

async function renameOrg() {
  const name = newOrgName.value.trim()
  if (!name) {
    message.warning('请输入新名称')
    return
  }
  renaming.value = true
  try {
    const resp = await QueryPostAPI(`${ORG_API_URL}${orgId.value}/rename`, { name })
    if (resp.code === 200) {
      message.success('重命名成功')
      showRenameModal.value = false
      await loadOrgInfo()
    } else {
      message.error(resp.message)
    }
  } catch (err) {
    message.error(err instanceof Error ? err.message : '重命名失败')
  } finally {
    renaming.value = false
  }
}

async function leaveOrg() {
  try {
    const resp = await QueryPostAPI(`${ORG_API_URL}${orgId.value}/leave`)
    if (resp.code === 200) {
      message.success('已退出组织')
      router.push({ name: 'org-index' })
    } else {
      message.error(resp.message)
    }
  } catch (err) {
    message.error(err instanceof Error ? err.message : '退出失败')
  }
}

async function removeMember(userId: number) {
  try {
    const resp = await QueryPostAPI(`${ORG_API_URL}${orgId.value}/member/remove`, { targetUserId: userId })
    if (resp.code === 200) {
      message.success('移除成功')
      await loadMembers()
    } else {
      message.error(resp.message)
    }
  } catch (err) {
    message.error(err instanceof Error ? err.message : '移除失败')
  }
}

async function updateMemberRole(userId: number, role: number) {
  if (!isLoggedIn.value) return
  if (myRole.value !== 0) return
  if (userId <= 0) return

  try {
    const resp = await QueryPostAPI(`${ORG_API_URL}${orgId.value}/member/role`, {
      targetUserId: userId,
      role,
    })
    if (resp.code === 200) {
      message.success('已更新角色')
      await loadMembers()
    } else {
      message.error(resp.message)
    }
  } catch (err) {
    message.error(err instanceof Error ? err.message : '更新角色失败')
  }
}

async function removeStreamer(userId: number) {
  try {
    const resp = await QueryPostAPI(`${ORG_API_URL}${orgId.value}/streamer/remove`, { targetStreamerUserId: userId })
    if (resp.code === 200) {
      message.success('移除成功')
      await loadStreamers()
    } else {
      message.error(resp.message)
    }
  } catch (err) {
    message.error(err instanceof Error ? err.message : '移除失败')
  }
}

async function loadAnalyze() {
  if (!isLoggedIn.value) return
  loadingAnalyze.value = true
  try {
    const resp = await QueryGetAPI<AnalyzeData>(`${ORG_API_URL}${orgId.value}/analyze`)
    if (resp.code === 200) {
      analyzeData.value = resp.data
      await nextTick()
      disposeChart()
      initChart()
    } else {
      message.error(resp.message)
    }
  } catch (err) {
    message.error(err instanceof Error ? err.message : '加载失败')
  } finally {
    loadingAnalyze.value = false
  }
}

async function loadLives() {
  if (!isLoggedIn.value) return
  loadingLives.value = true
  try {
    const resp = await QueryGetAPI<OrgLiveItem[]>(`${ORG_API_URL}${orgId.value}/lives`)
    if (resp.code === 200) {
      lives.value = resp.data
    } else {
      message.error(resp.message)
    }
  } catch (err) {
    message.error(err instanceof Error ? err.message : '加载失败')
  } finally {
    loadingLives.value = false
  }
}

async function refreshAll() {
  if (!isLoggedIn.value) return
  await loadOrgInfo()
  await Promise.all([
    loadAnalyze(),
    loadLives(),
    loadStreamers(),
    loadMembers(),
    loadStreamerInvites(),
    loadMemberInvites(),
  ])
}

watch(
  [() => isLoggedIn.value, () => orgId.value],
  async ([loggedIn, id]) => {
    if (!loggedIn) return
    if (!id) return
    await refreshAll()
  },
  { immediate: true },
)

watch(selectedMetrics, () => {
  updateChartOption()
}, { deep: true })

watch(includeAllStreamers, async () => {
  await loadStreamers()
})

watch(
  [() => showStreamerDetailDrawer.value, () => selectedStreamerId.value],
  async ([show, streamerId]) => {
    if (!show) return
    if (!streamerId) return
    await loadStreamerDetail(true)
  },
)

onUnmounted(() => {
  disposeChart()
})

function handleBack() {
  router.push({ name: 'org-index' })
}

function handleGoConsole() {
  router.push({ name: 'manage-index' })
}
</script>

<template>
  <div style="max-width: 1400px; margin: 0 auto; padding: 16px;">
    <template v-if="!isLoggedIn">
      <NCard>
        <NAlert type="warning" :bordered="false" style="margin-bottom: 12px;">
          需要先登录才能查看组织数据。
        </NAlert>
        <RegisterAndLogin />
      </NCard>
    </template>

    <template v-else>
      <NPageHeader @back="handleBack">
        <template #title>
          <NSpace align="center">
            <span>{{ orgName || `组织 ${orgId}` }}</span>
            <NButton v-if="isOrgAdmin" size="tiny" circle secondary @click="showRenameModal = true; newOrgName = orgName">
              <template #icon><NIcon :component="Pencil" /></template>
            </NButton>
          </NSpace>
        </template>
        <template #subtitle>
          ID: {{ orgId }}
        </template>
        <template #extra>
          <NSpace>
            <NButton secondary @click="handleGoConsole">
              返回控制台
            </NButton>
            <NPopconfirm v-if="myRole !== 0" @positive-click="leaveOrg">
              <template #trigger>
                <NButton type="error" ghost>
                  <template #icon>
                    <NIcon :component="LogOutOutline" />
                  </template>
                  退出组织
                </NButton>
              </template>
              确定要退出该组织吗？
            </NPopconfirm>
            <NButton type="primary" :loading="loadingAnalyze || loadingLives || loadingOrgs || loadingStreamers || loadingMembers" @click="refreshAll">
              <template #icon>
                <NIcon :component="RefreshOutline" />
              </template>
              刷新
            </NButton>
          </NSpace>
        </template>
        <template #avatar>
          <NIcon :component="PeopleOutline" />
        </template>

        <div style="margin-top: 16px;">
          <NDescriptions :column="4" size="small">
            <NDescriptionsItem label="我的角色">
              <NTag :bordered="false" type="info" size="small">
                {{ orgInfo ? roleLabel(orgInfo.role) : '-' }}
              </NTag>
            </NDescriptionsItem>
            <NDescriptionsItem label="OwnerUserId">
              {{ orgInfo?.ownerUserId ?? '-' }}
            </NDescriptionsItem>
            <NDescriptionsItem label="主播数">
              {{ streamers.length }}
            </NDescriptionsItem>
          </NDescriptions>
        </div>
      </NPageHeader>

      <NTabs type="line" animated style="margin-top: 12px;">
        <NTabPane name="analyze" tab="数据分析">
          <div style="margin-bottom: 12px; display: flex; justify-content: flex-end;">
            <NRadioGroup v-model:value="summaryRange" size="small">
              <NRadioButton value="last7Days">
                近7日
              </NRadioButton>
              <NRadioButton value="last30Days">
                近30日
              </NRadioButton>
            </NRadioGroup>
          </div>
          <template v-if="loadingAnalyze">
            <NSkeleton text :repeat="4" />
          </template>

          <template v-else-if="!summaryData">
            <NEmpty description="暂无分析数据" />
          </template>

          <template v-else>
            <NGrid :x-gap="12" :y-gap="12" :cols="4" item-responsive responsive="screen">
              <NGridItem span="4 m:2 l:1">
                <NCard size="small" :bordered="false" class="stat-card">
                  <NStatistic :label="summaryRange === 'last7Days' ? '近7日总收入' : '近30日总收入'" :value="summaryData.totalIncome" :precision="2">
                    <template #prefix>¥</template>
                    <template #suffix>
                      <NTag :type="getTrendType(summaryData.incomeTrend)" :bordered="false" size="tiny" style="vertical-align: middle; margin-left: 4px;">
                        <template #icon>
                          <NIcon :component="summaryData.incomeTrend >= 0 ? TrendingUp : TrendingDown" />
                        </template>
                        {{ Math.abs(summaryData.incomeTrend) }}%
                      </NTag>
                    </template>
                  </NStatistic>
                </NCard>
              </NGridItem>
              <NGridItem span="4 m:2 l:1">
                <NCard size="small" :bordered="false" class="stat-card">
                  <NStatistic :label="summaryRange === 'last7Days' ? '近7日互动数' : '近30日互动数'" :value="summaryData.totalInteractions">
                    <template #suffix>
                      <NTag :type="getTrendType(summaryData.interactionTrend)" :bordered="false" size="tiny" style="vertical-align: middle; margin-left: 4px;">
                        <template #icon>
                          <NIcon :component="summaryData.interactionTrend >= 0 ? TrendingUp : TrendingDown" />
                        </template>
                        {{ Math.abs(summaryData.interactionTrend) }}%
                      </NTag>
                    </template>
                  </NStatistic>
                </NCard>
              </NGridItem>
              <NGridItem span="4 m:2 l:1">
                <NCard size="small" :bordered="false" class="stat-card">
                  <NStatistic :label="summaryRange === 'last7Days' ? '近7日弹幕数' : '近30日弹幕数'" :value="summaryData.totalDanmakuCount">
                    <template #suffix>
                      <NTag :type="getTrendType(summaryData.danmakuTrend)" :bordered="false" size="tiny" style="vertical-align: middle; margin-left: 4px;">
                        <template #icon>
                          <NIcon :component="summaryData.danmakuTrend >= 0 ? TrendingUp : TrendingDown" />
                        </template>
                        {{ Math.abs(summaryData.danmakuTrend) }}%
                      </NTag>
                    </template>
                  </NStatistic>
                </NCard>
              </NGridItem>
              <NGridItem span="4 m:2 l:1">
                <NCard size="small" :bordered="false" class="stat-card">
                  <NStatistic :label="summaryRange === 'last7Days' ? '近7日直播时长' : '近30日直播时长'" :value="summaryData.totalLiveMinutes">
                    <template #suffix>min</template>
                  </NStatistic>
                </NCard>
              </NGridItem>
            </NGrid>

            <NCard title="趋势图表" size="small" :segmented="{ content: true }" style="margin-top: 16px;">
              <template #header-extra>
                <NSpace>
                  <NTag
                    v-for="m in chartMetrics"
                    :key="m.value"
                    clickable
                    :type="selectedMetrics.includes(m.value) ? 'primary' : 'default'"
                    @click="selectedMetrics.includes(m.value) ? selectedMetrics = selectedMetrics.filter(x => x !== m.value) : selectedMetrics.push(m.value)"
                  >
                    {{ m.label }}
                  </NTag>
                </NSpace>
              </template>
              <div v-if="!hasChartData" style="padding: 12px;">
                <NEmpty description="暂无图表数据" />
              </div>
              <div v-else ref="chartRef" style="height: 420px; width: 100%;" />
            </NCard>
          </template>
        </NTabPane>

        <NTabPane name="lives" tab="直播记录">
          <template v-if="loadingLives">
            <NSkeleton text :repeat="6" />
          </template>

          <template v-else-if="lives.length === 0">
            <NEmpty description="暂无直播记录" />
          </template>

          <template v-else>
            <NGrid :x-gap="12" :y-gap="12" cols="1 600:2 1100:3" item-responsive>
              <NGridItem v-for="item in lives" :key="item.live.liveId">
                <NCard hoverable size="small" class="live-card">
                  <template #cover>
                    <div style="height: 140px; overflow: hidden; position: relative; background: #f5f5f5;">
                      <NImage
                        v-if="item.live.coverUrl"
                        :src="item.live.coverUrl.includes('@') ? item.live.coverUrl : `${item.live.coverUrl}@140h`"
                        object-fit="cover"
                        :img-props="{ referrerpolicy: 'no-referrer' }"
                        style="width: 100%; height: 100%;"
                        preview-disabled
                      />
                      <div v-else style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #ccc;">
                        <NIcon size="48" :component="TimeOutline" />
                      </div>
                      <div style="position: absolute; top: 8px; right: 8px;">
                        <NTag v-if="!item.live.isFinish" type="success" size="small">LIVE</NTag>
                        <NTag v-else color="#00000080" text-color="#fff" :bordered="false" size="small">已结束</NTag>
                      </div>
                      <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 4px 8px; background: linear-gradient(to top, rgba(0,0,0,0.7), transparent); color: #fff; font-size: 12px; display: flex; align-items: center;">
                        <NAvatar
                          v-if="item.streamer.faceUrl"
                          round
                          :size="20"
                          :src="item.streamer.faceUrl.includes('@') ? item.streamer.faceUrl : `${item.streamer.faceUrl}@20w`"
                          :img-props="{ referrerpolicy: 'no-referrer' }"
                          style="margin-right: 6px; border: 1px solid rgba(255,255,255,0.5);"
                        />
                        {{ item.streamer.name }}
                      </div>
                    </div>
                  </template>

                  <div class="live-card-title text-ellipsis-2">
                    <NTooltip trigger="hover">
                      <template #trigger>
                        <span>{{ item.live.title }}</span>
                      </template>
                      {{ item.live.title }}
                    </NTooltip>
                  </div>

                  <div class="live-card-meta">
                    <div class="meta-row">
                      <span class="area">{{ item.live.parentArea }} / {{ item.live.area }}</span>
                    </div>
                    <div class="meta-row time">
                      <NTime :time="item.live.startAt" format="MM-dd HH:mm" />
                      <template v-if="item.live.stopAt">
                        - <NTime :time="item.live.stopAt" format="HH:mm" />
                      </template>
                      <template v-else>
                         - Now
                      </template>
                    </div>
                  </div>

                  <template #footer>
                    <NSpace justify="space-between" size="small" style="font-size: 12px; opacity: 0.9;">
                      <span title="营收">
                        <NIcon :component="WalletOutline" style="vertical-align: -2px;" />
                        {{ item.live.totalIncomeWithGuard.toFixed(0) }}
                      </span>
                      <span title="互动">
                        <NIcon :component="PeopleOutline" style="vertical-align: -2px;" />
                        {{ item.live.interactionCount }}
                      </span>
                      <span title="弹幕">
                        <NIcon :component="ChatbubblesOutline" style="vertical-align: -2px;" />
                        {{ item.live.danmakusCount }}
                      </span>
                    </NSpace>
                  </template>
                </NCard>
              </NGridItem>
            </NGrid>
          </template>
        </NTabPane>

        <NTabPane name="streamers" tab="主播管理">
          <template v-if="loadingStreamers">
            <NSkeleton text :repeat="6" />
          </template>

          <template v-else>
            <template v-if="isOrgAdmin">
              <NCollapse style="margin-bottom: 16px;">
                <NCollapseItem title="邀请主播" name="1">
                  <NCard size="small" embedded :bordered="false">
                    <NSpace vertical>
                      <UserAutocompleteSelect
                        v-model:value="streamerInviteTargetUserId"
                        style="width: 100%;"
                        placeholder="输入B站UID/用户名搜索主播(可选)"
                        @error="(m) => message.error(m)"
                      />
                      <NSpace align="center">
                        <NInputNumber v-model:value="streamerInviteExpireDays" placeholder="有效期(天)" :min="1" size="small" />
                        <NPopconfirm @positive-click="createStreamerInvite">
                          <template #trigger>
                            <NButton type="primary" size="small" :loading="creatingStreamerInvite">
                              生成链接
                            </NButton>
                          </template>
                          确定要发送主播邀请吗？
                        </NPopconfirm>
                      </NSpace>
                      <div v-if="streamerInviteUrl">
                        <NSpace>
                          <NInput :value="streamerInviteUrl" readonly size="small" placeholder="邀请链接" />
                          <NButton size="small" secondary type="success" @click="copyToClipboard(streamerInviteUrl)">
                            <template #icon><NIcon :component="CopyOutline" /></template>
                            复制
                          </NButton>
                        </NSpace>
                      </div>
                    </NSpace>
                  </NCard>
                </NCollapseItem>
              </NCollapse>

              <NCard size="small" style="margin-bottom: 12px;" :bordered="false" :segmented="{ content: true }">
                <template #header>
                  已发出邀请
                </template>
                <template #header-extra>
                  <NButton size="small" :loading="loadingStreamerInvites" @click="loadStreamerInvites">
                    刷新邀请
                  </NButton>
                </template>

                <template v-if="loadingStreamerInvites">
                  <NSkeleton text :repeat="4" />
                </template>
                <template v-else-if="streamerInvites.length === 0">
                  <NEmpty description="暂无邀请" />
                </template>
                <NList v-else>
                  <NListItem v-for="inv in streamerInvites" :key="inv.token">
                    <div style="display:flex; flex-direction: column; gap: 6px; width: 100%;">
                      <div style="display:flex; justify-content: space-between; align-items: center; gap: 8px;">
                        <div style="font-weight: 600;">
                          <NTag size="small" :bordered="false" :type="inviteStatusTagType(inv.status)">
                            {{ inviteStatusLabel(inv.status) }}
                          </NTag>
                          <span style="margin-left: 6px;">
                            {{ inv.targetStreamerUserName || (inv.targetStreamerUserId ? `ID: ${inv.targetStreamerUserId}` : '公开链接') }}
                          </span>
                        </div>
                        <NTime :time="inv.expiresAt" format="yyyy-MM-dd HH:mm" />
                      </div>

                      <div style="font-size: 12px; opacity: .75; display:flex; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                        <span>创建者: {{ inv.createdByUserName || inv.createdByUserId }}</span>
                        <span>使用次数: {{ inv.usedCount }}<template v-if="inv.lastUsedAt">, 最近使用: <NTime :time="inv.lastUsedAt" format="yyyy-MM-dd HH:mm" /></template></span>
                      </div>

                      <NSpace>
                        <NInput :value="inv.joinUrl" readonly size="small" placeholder="邀请链接" />
                        <NButton size="small" secondary type="success" @click="copyToClipboard(inv.joinUrl)">
                          <template #icon><NIcon :component="CopyOutline" /></template>
                          复制
                        </NButton>
                      </NSpace>
                    </div>
                  </NListItem>
                </NList>
              </NCard>

              <NCard size="small" style="margin-bottom: 12px; background: transparent;" :bordered="false">
                <NSpace align="center" justify="space-between">
                  <NInput v-model:value="streamerSearch" placeholder="搜索主播名称或ID" size="small" style="width: 200px">
                    <template #prefix>
                      <NIcon :component="SearchOutline" />
                    </template>
                  </NInput>
                  <NSpace align="center">
                    <span style="opacity: .8; font-size: 12px;">包含非 Active 状态</span>
                    <NSwitch v-model:value="includeAllStreamers" size="small" />
                  </NSpace>
                </NSpace>
              </NCard>
            </template>
            <template v-else>
               <NCard size="small" style="margin-bottom: 12px; background: transparent;" :bordered="false">
                <NSpace align="center" justify="start">
                  <NInput v-model:value="streamerSearch" placeholder="搜索主播名称或ID" size="small" style="width: 200px">
                    <template #prefix>
                      <NIcon :component="SearchOutline" />
                    </template>
                  </NInput>
                </NSpace>
              </NCard>
            </template>

            <template v-if="filteredStreamers.length === 0">
              <NEmpty description="暂无主播" />
            </template>

            <NList v-else hoverable clickable>
              <NListItem v-for="s in filteredStreamers" :key="s.streamer.id" @click="openStreamerDetailDrawer(s.streamer.id)">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <NSpace align="center">
                    <NAvatar
                      round
                      :size="48"
                      :src="s.streamer.faceUrl ? (s.streamer.faceUrl.includes('@') ? s.streamer.faceUrl : `${s.streamer.faceUrl}@48w`) : ''"
                      :img-props="{ referrerpolicy: 'no-referrer' }"
                      :fallback-src="'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png'"
                      style="border: 1px solid var(--n-divider-color);"
                    />
                    <NSpace vertical :size="2">
                      <div style="font-weight: 600; font-size: 15px;">{{ s.streamer.name }}</div>
                      <div style="font-size: 12px; opacity: 0.6;">ID: {{ s.streamer.id }}</div>
                    </NSpace>
                    <NTag :bordered="false" :type="streamerStatusTagType(s.status)" size="small">
                      {{ streamerStatusLabel(s.status) }}
                    </NTag>
                    <NTag v-if="s.streamer.isBiliAuthed" :bordered="false" type="success" size="small">
                      已绑定B站
                    </NTag>
                    <NTag v-else :bordered="false" size="small">
                      未绑定
                    </NTag>
                  </NSpace>

                  <div style="text-align: right; display: flex; align-items: center; gap: 12px;">
                    <div style="font-size: 12px; opacity: 0.7;">
                      <div>加入时间: <NTime :time="s.addedAt" format="yyyy-MM-dd" /></div>
                      <div v-if="s.respondedAt">响应时间: <NTime :time="s.respondedAt" format="yyyy-MM-dd" /></div>
                    </div>
                    <NPopconfirm
                      v-if="isOrgAdmin"
                      @positive-click="removeStreamer(s.streamer.id)"
                    >
                      <template #trigger>
                        <NButton size="tiny" type="error" ghost circle @click.stop>
                          <template #icon><NIcon :component="TrashOutline" /></template>
                        </NButton>
                      </template>
                      确定要移除该主播吗？
                    </NPopconfirm>
                  </div>
                </div>
              </NListItem>
            </NList>
          </template>
        </NTabPane>

        <NTabPane name="members" tab="成员管理">
          <template v-if="loadingMembers">
            <NSkeleton text :repeat="6" />
          </template>

          <template v-else>
            <template v-if="isOrgAdmin">
              <NCollapse style="margin-bottom: 16px;">
                <NCollapseItem title="邀请成员" name="1">
                  <NCard size="small" embedded :bordered="false">
                    <NSpace vertical>
                      <NSpace align="center">
                        <NSelect
                          v-model:value="memberInviteRole"
                          style="width: 120px;"
                          size="small"
                          :options="[
                            { label: 'Owner', value: 0 },
                            { label: 'Admin', value: 1 },
                            { label: 'Member', value: 2 },
                          ]"
                        />
                        <UserAutocompleteSelect
                          v-model:value="memberInviteTargetUserId"
                          style="min-width: 240px;"
                          placeholder="输入B站UID/用户名搜索成员(可选)"
                          @error="(m) => message.error(m)"
                        />
                      </NSpace>
                      <NSpace align="center">
                        <NInputNumber v-model:value="memberInviteExpireDays" placeholder="有效期(天)" :min="1" size="small" />
                        <NPopconfirm @positive-click="createMemberInvite">
                          <template #trigger>
                            <NButton type="primary" size="small" :loading="creatingMemberInvite">
                              生成链接
                            </NButton>
                          </template>
                          确定要发送成员邀请吗？
                        </NPopconfirm>
                      </NSpace>
                      <div v-if="memberInviteUrl">
                        <NSpace>
                          <NInput :value="memberInviteUrl" readonly size="small" placeholder="邀请链接" />
                          <NButton size="small" secondary type="success" @click="copyToClipboard(memberInviteUrl)">
                            <template #icon><NIcon :component="CopyOutline" /></template>
                            复制
                          </NButton>
                        </NSpace>
                      </div>
                    </NSpace>
                  </NCard>
                </NCollapseItem>
              </NCollapse>

              <NCard size="small" style="margin-bottom: 12px;" :bordered="false" :segmented="{ content: true }">
                <template #header>
                  已发出邀请
                </template>
                <template #header-extra>
                  <NButton size="small" :loading="loadingMemberInvites" @click="loadMemberInvites">
                    刷新邀请
                  </NButton>
                </template>

                <template v-if="loadingMemberInvites">
                  <NSkeleton text :repeat="4" />
                </template>
                <template v-else-if="memberInvites.length === 0">
                  <NEmpty description="暂无邀请" />
                </template>
                <NList v-else>
                  <NListItem v-for="inv in memberInvites" :key="inv.token">
                    <div style="display:flex; flex-direction: column; gap: 6px; width: 100%;">
                      <div style="display:flex; justify-content: space-between; align-items: center; gap: 8px;">
                        <div style="font-weight: 600;">
                          <NTag size="small" :bordered="false" :type="inviteStatusTagType(inv.status)">
                            {{ inviteStatusLabel(inv.status) }}
                          </NTag>
                          <span style="margin-left: 6px;">
                            {{ inv.targetUserName || (inv.targetUserId ? `ID: ${inv.targetUserId}` : '公开链接') }}
                          </span>
                          <NTag size="small" :bordered="false" type="info" style="margin-left: 6px;">
                            {{ roleLabel(inv.role) }}
                          </NTag>
                        </div>
                        <NTime :time="inv.expiresAt" format="yyyy-MM-dd HH:mm" />
                      </div>

                      <div style="font-size: 12px; opacity: .75; display:flex; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                        <span>创建者: {{ inv.createdByUserName || inv.createdByUserId }}</span>
                        <span>使用次数: {{ inv.usedCount }}<template v-if="inv.lastUsedAt">, 最近使用: <NTime :time="inv.lastUsedAt" format="yyyy-MM-dd HH:mm" /></template></span>
                      </div>

                      <NSpace>
                        <NInput :value="inv.joinUrl" readonly size="small" placeholder="邀请链接" />
                        <NButton size="small" secondary type="success" @click="copyToClipboard(inv.joinUrl)">
                          <template #icon><NIcon :component="CopyOutline" /></template>
                          复制
                        </NButton>
                      </NSpace>
                    </div>
                  </NListItem>
                </NList>
              </NCard>
            </template>
            
            <NCard size="small" style="margin-bottom: 12px; background: transparent;" :bordered="false">
              <NSpace align="center" justify="start">
                <NInput v-model:value="memberSearch" placeholder="搜索成员名称或ID" size="small" style="width: 200px">
                  <template #prefix>
                    <NIcon :component="SearchOutline" />
                  </template>
                </NInput>
              </NSpace>
            </NCard>

            <template v-if="filteredMembers.length === 0">
              <NEmpty description="暂无成员" />
            </template>

            <NList v-else hoverable>
              <NListItem v-for="m in filteredMembers" :key="m.user.id">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <NSpace align="center">
                    <NAvatar
                      round
                      :size="40"
                      :src="m.user.faceUrl ? (m.user.faceUrl.includes('@') ? m.user.faceUrl : `${m.user.faceUrl}@40w`) : ''"
                      :img-props="{ referrerpolicy: 'no-referrer' }"
                      :fallback-src="'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png'"
                      style="border: 1px solid var(--n-divider-color);"
                    />
                    <NSpace vertical :size="2">
                      <div style="font-weight: 600;">{{ m.user.name }}</div>
                      <div style="font-size: 12px; opacity: 0.6;">ID: {{ m.user.id }}</div>
                    </NSpace>
                    <NTag :bordered="false" size="small" type="info">
                      {{ roleLabel(m.role) }}
                    </NTag>
                  </NSpace>

                  <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 12px; opacity: 0.7;">
                      加入于 <NTime :time="m.joinedAt" format="yyyy-MM-dd" />
                    </span>

                    <template v-if="myRole === 0 && m.role !== 0 && m.user.id !== orgInfo?.ownerUserId">
                      <NPopconfirm @positive-click="updateMemberRole(m.user.id, 1)">
                        <template #trigger>
                          <NButton size="tiny" tertiary type="info">
                            设为 Admin
                          </NButton>
                        </template>
                        确定要将该成员设为 Admin 吗？
                      </NPopconfirm>
                      <NPopconfirm @positive-click="updateMemberRole(m.user.id, 2)">
                        <template #trigger>
                          <NButton size="tiny" tertiary>
                            设为 Member
                          </NButton>
                        </template>
                        确定要将该成员设为 Member 吗？
                      </NPopconfirm>
                    </template>

                    <NPopconfirm
                      v-if="isOrgAdmin && m.role > myRole"
                      @positive-click="removeMember(m.user.id)"
                    >
                      <template #trigger>
                        <NButton size="tiny" type="error" ghost circle>
                          <template #icon><NIcon :component="TrashOutline" /></template>
                        </NButton>
                      </template>
                      确定要移除该成员吗？
                    </NPopconfirm>
                  </div>
                </div>
              </NListItem>
            </NList>
          </template>
        </NTabPane>
      </NTabs>

      <NModal
        v-model:show="showRenameModal"
        preset="card"
        title="重命名组织"
        style="width: 400px; max-width: 90vw;"
      >
        <NForm @submit.prevent="renameOrg">
          <NFormItem label="新名称" :show-feedback="false">
            <NInput
              v-model:value="newOrgName"
              placeholder="请输入新名称"
              autofocus
              @keydown.enter.prevent="renameOrg"
            />
          </NFormItem>
          <div style="margin-top: 24px; display: flex; justify-content: flex-end; gap: 12px;">
            <NButton @click="showRenameModal = false">
              取消
            </NButton>
            <NButton type="primary" :loading="renaming" attr-type="submit" @click="renameOrg">
              确定
            </NButton>
          </div>
        </NForm>
      </NModal>
    </template>

    <NDrawer v-model:show="showStreamerDetailDrawer" placement="right" :width="520">
      <NDrawerContent>
        <template #header>
          <div style="display:flex; align-items:center; gap: 10px;">
            <NAvatar
              round
              :size="40"
              :src="streamerDetail?.streamer.faceUrl ? (streamerDetail.streamer.faceUrl.includes('@') ? streamerDetail.streamer.faceUrl : `${streamerDetail.streamer.faceUrl}@40w`) : ''"
              :img-props="{ referrerpolicy: 'no-referrer' }"
              :fallback-src="'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png'"
              style="border: 1px solid var(--n-divider-color);"
            />
            <div style="min-width: 0;">
              <div style="font-weight: 600; line-height: 1.2;">
                {{ streamerDetail?.streamer.name || (selectedStreamerId ? `ID: ${selectedStreamerId}` : '主播详情') }}
              </div>
              <div style="font-size: 12px; opacity: .7;">
                ID: {{ streamerDetail?.streamer.id || selectedStreamerId || '-' }}
              </div>
            </div>
            <div style="margin-left: auto;">
              <NTag v-if="streamerDetail" :bordered="false" size="small" :type="streamerStatusTagType(streamerDetail.status)">
                {{ streamerStatusLabel(streamerDetail.status) }}
              </NTag>
            </div>
          </div>
        </template>

        <NSpin :show="loadingStreamerDetail">
          <template v-if="!streamerDetail">
            <NEmpty description="暂无数据" />
          </template>
          <template v-else>
            <NGrid :x-gap="12" :y-gap="12" :cols="2">
              <NGridItem>
                <NCard size="small" :bordered="false" class="stat-card">
                  <NStatistic label="总收入" :value="streamerDetail.summary.totalIncomeWithGuard" :precision="2">
                    <template #prefix>¥</template>
                  </NStatistic>
                </NCard>
              </NGridItem>
              <NGridItem>
                <NCard size="small" :bordered="false" class="stat-card">
                  <NStatistic label="直播时长" :value="streamerDetail.summary.totalLiveMinutes">
                    <template #suffix>min</template>
                  </NStatistic>
                </NCard>
              </NGridItem>
              <NGridItem>
                <NCard size="small" :bordered="false" class="stat-card">
                  <NStatistic label="互动" :value="streamerDetail.summary.totalInteractionCount" />
                </NCard>
              </NGridItem>
              <NGridItem>
                <NCard size="small" :bordered="false" class="stat-card">
                  <NStatistic label="弹幕" :value="streamerDetail.summary.totalDanmakuCount" />
                </NCard>
              </NGridItem>
            </NGrid>

            <NCard title="直播时间热力图" size="small" :bordered="false" style="margin-top: 12px;">
              <NHeatmap
                :data="streamerDetail.heatmap"
                size="small"
                :tooltip="true"
              >
                <template #tooltip="p">
                  <div style="font-size: 12px;">
                    {{ formatDate(p.timestamp) }}
                    <template v-if="p.value != null">: {{ p.value }} min</template>
                  </div>
                </template>
              </NHeatmap>
            </NCard>

            <NCard v-if="isOrgAdmin" title="主播设置" size="small" :bordered="false" style="margin-top: 12px;">
              <NForm label-placement="left" label-width="auto" size="small">
                <NFormItem label="状态">
                  <NSelect
                    v-model:value="editStreamerStatus"
                    style="width: 180px"
                    :options="[
                      { label: 'Active', value: 1 },
                      { label: 'Removed', value: 3 },
                    ]"
                  />
                </NFormItem>
                <NFormItem label="备注">
                  <NInput v-model:value="editStreamerNote" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" placeholder="仅组织管理员可见" />
                </NFormItem>
                <NFormItem>
                  <NButton type="primary" :loading="savingStreamerSettings" @click="updateStreamerSettings">
                    保存
                  </NButton>
                </NFormItem>
              </NForm>
            </NCard>

            <NCard title="直播记录" size="small" :bordered="false" style="margin-top: 12px;">
              <template v-if="streamerDetailLives.length === 0">
                <NEmpty description="暂无直播记录" />
              </template>
              <NList v-else>
                <NListItem v-for="live in streamerDetailLives" :key="live.liveId">
                  <div style="display:flex; gap: 10px; width: 100%;">
                    <NImage
                      width="96"
                      height="54"
                      object-fit="cover"
                      :src="live.coverUrl"
                      :img-props="{ referrerpolicy: 'no-referrer' }"
                      :fallback-src="'https://cube.elemecdn.com/e/fd/0fc7d20532fdaf769a25683617711png.png'"
                      style="border-radius: 6px; overflow: hidden; flex: 0 0 auto;"
                    />
                    <div style="min-width: 0; flex: 1;">
                      <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        {{ live.title }}
                      </div>
                      <div style="font-size: 12px; opacity: .7; display:flex; align-items:center; gap: 8px; flex-wrap: wrap;">
                        <span>
                          <NIcon :component="TimeOutline" style="vertical-align: -2px;" />
                          <NTime :time="live.startAt" format="yyyy-MM-dd HH:mm" />
                        </span>
                        <span v-if="live.stopAt">
                          - <NTime :time="live.stopAt" format="HH:mm" />
                        </span>
                      </div>
                      <div style="margin-top: 4px; font-size: 12px; opacity: .85; display:flex; gap: 10px; flex-wrap: wrap;">
                        <span title="营收">
                          <NIcon :component="WalletOutline" style="vertical-align: -2px;" />
                          {{ live.totalIncomeWithGuard.toFixed(0) }}
                        </span>
                        <span title="互动">
                          <NIcon :component="PeopleOutline" style="vertical-align: -2px;" />
                          {{ live.interactionCount }}
                        </span>
                        <span title="弹幕">
                          <NIcon :component="ChatbubblesOutline" style="vertical-align: -2px;" />
                          {{ live.danmakusCount }}
                        </span>
                      </div>
                    </div>
                  </div>
                </NListItem>
              </NList>

              <div style="margin-top: 8px; display:flex; justify-content: center;">
                <NButton v-if="streamerDetailHasMoreLives" secondary :loading="loadingStreamerDetail" @click="loadMoreStreamerLives">
                  加载更多
                </NButton>
              </div>
            </NCard>
          </template>
        </NSpin>
      </NDrawerContent>
    </NDrawer>
  </div>
</template>

<style scoped>
.stat-card {
  background: var(--n-card-color);
  transition: all 0.3s;
}
.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.live-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.live-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 20px -8px rgba(0, 0, 0, 0.12);
}
.live-card-title {
  font-weight: 600;
  margin-bottom: 6px;
  height: 44px;
  line-height: 22px;
}
.text-ellipsis-2 {
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}
.live-card-meta {
  font-size: 12px;
  opacity: 0.75;
  margin-bottom: 8px;
}
.meta-row {
  display: flex;
  justify-content: space-between;
}
</style>
