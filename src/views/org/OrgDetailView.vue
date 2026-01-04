<script setup lang="ts">
import {
  ArrowBack,
  ChatbubblesOutline,
  LogOutOutline,
  Pencil,
  PeopleOutline,
  RefreshOutline,
  TimeOutline,
  TrashOutline,
  WalletOutline,
} from '@vicons/ionicons5'
import {
  NAlert,
  NAvatar,
  NButton,
  NCard,
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
  NPageHeader,
  NPopconfirm,
  NSelect,
  NSpace,
  NSpin,
  NStatistic,
  NTabPane,
  NTabs,
  NTag,
  NTime,
  useMessage,
  useThemeVars,
} from 'naive-ui'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isLoggedIn } from '@/api/account'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'
import { ORG_API_URL } from '@/data/constants'
import { useOrgAnalyzeChart } from './useOrgAnalyzeChart'
import type { OrgAnalyzeChartMetric } from './useOrgAnalyzeChart'
import OrgAnalyzeTab from './tabs/OrgAnalyzeTab.vue'
import OrgAuditTabPane from './tabs/OrgAuditTabPane.vue'
import OrgLivesTab from './tabs/OrgLivesTab.vue'
import OrgMembersTab from './tabs/OrgMembersTab.vue'
import OrgOrdersTab from './tabs/OrgOrdersTab.vue'
import OrgPointsTab from './tabs/OrgPointsTab.vue'
import OrgStreamersTab from './tabs/OrgStreamersTab.vue'

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

const selectedMetrics = ref<string[]>(['income', 'interactionCount'])
const chartMetrics: OrgAnalyzeChartMetric[] = [
  { label: '收入', value: 'income', color: '#f5a623', type: 'line', yAxisIndex: 1 },
  { label: '互动数', value: 'interactionCount', color: '#2080f0', type: 'line', yAxisIndex: 0 },
  { label: '弹幕数', value: 'danmakuCount', color: '#18a058', type: 'line', yAxisIndex: 0 },
  { label: '点赞数', value: 'likeCount', color: '#d03050', type: 'line', yAxisIndex: 0 },
  { label: '互动人数', value: 'interactionUsers', color: '#8a2be2', type: 'bar', yAxisIndex: 0 },
  { label: '付费人数', value: 'payingUsers', color: '#ff69b4', type: 'bar', yAxisIndex: 0 },
]

function setAnalyzeChartRef(el: HTMLElement | null) {
  chartRef.value = el
}

const { initChart, updateChartOption, disposeChart } = useOrgAnalyzeChart({
  chartRef,
  analyzeData,
  formatDate,
  themeVars,
  selectedMetrics,
  chartMetrics,
})

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
  if (!isLoggedIn.value) return
  if (!orgId.value) return

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
  if (!isLoggedIn.value) return
  if (!isOrgAdmin.value) return
  if (!orgId.value) return
  if (userId <= 0) return

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
          <OrgAnalyzeTab
            v-model:summaryRange="summaryRange"
            v-model:selectedMetrics="selectedMetrics"
            :loading="loadingAnalyze"
            :summary-data="summaryData"
            :chart-metrics="chartMetrics"
            :has-chart-data="hasChartData"
            :set-chart-ref="setAnalyzeChartRef"
          />
        </NTabPane>

        <NTabPane name="lives" tab="直播记录">
          <OrgLivesTab :loading="loadingLives" :lives="lives" />
        </NTabPane>

        <NTabPane name="streamers" tab="主播管理">
          <OrgStreamersTab
            v-model:streamerInviteTargetUserId="streamerInviteTargetUserId"
            v-model:streamerInviteExpireDays="streamerInviteExpireDays"
            v-model:streamerSearch="streamerSearch"
            v-model:includeAllStreamers="includeAllStreamers"
            :loading="loadingStreamers"
            :is-org-admin="isOrgAdmin"
            :creating-streamer-invite="creatingStreamerInvite"
            :streamer-invite-url="streamerInviteUrl"
            :loading-streamer-invites="loadingStreamerInvites"
            :streamer-invites="streamerInvites"
            :invite-status-label="inviteStatusLabel"
            :invite-status-tag-type="inviteStatusTagType"
            :streamer-status-label="streamerStatusLabel"
            :streamer-status-tag-type="streamerStatusTagType"
            :filtered-streamers="filteredStreamers"
            :create-streamer-invite="createStreamerInvite"
            :load-streamer-invites="loadStreamerInvites"
            :open-streamer-detail-drawer="openStreamerDetailDrawer"
            :remove-streamer="removeStreamer"
            :copy-to-clipboard="copyToClipboard"
            :on-user-search-error="(m) => message.error(m)"
          />
        </NTabPane>

        <NTabPane name="members" tab="成员管理">
          <OrgMembersTab
            v-model:memberInviteRole="memberInviteRole"
            v-model:memberInviteTargetUserId="memberInviteTargetUserId"
            v-model:memberInviteExpireDays="memberInviteExpireDays"
            v-model:memberSearch="memberSearch"
            :loading="loadingMembers"
            :is-org-admin="isOrgAdmin"
            :my-role="myRole"
            :owner-user-id="orgInfo?.ownerUserId ?? null"
            :creating-member-invite="creatingMemberInvite"
            :member-invite-url="memberInviteUrl"
            :loading-member-invites="loadingMemberInvites"
            :member-invites="memberInvites"
            :filtered-members="filteredMembers"
            :invite-status-label="inviteStatusLabel"
            :invite-status-tag-type="inviteStatusTagType"
            :role-label="roleLabel"
            :create-member-invite="createMemberInvite"
            :load-member-invites="loadMemberInvites"
            :update-member-role="updateMemberRole"
            :remove-member="removeMember"
            :copy-to-clipboard="copyToClipboard"
            :on-user-search-error="(m) => message.error(m)"
          />
        </NTabPane>

        <NTabPane name="points" tab="积分管理">
          <OrgPointsTab
            :is-org-admin="isOrgAdmin"
            :org-id="orgId"
            :streamer-options="streamers.map(s => ({ label: s.streamer.name, value: s.streamer.id }))"
          />
        </NTabPane>

        <NTabPane name="shipping" tab="订单管理">
          <OrgOrdersTab
            :is-org-admin="isOrgAdmin"
            :org-id="orgId"
            :streamer-options="streamers.map(s => ({ label: s.streamer.name, value: s.streamer.id }))"
          />
        </NTabPane>

        <NTabPane name="audit" tab="操作审计">
          <OrgAuditTabPane :is-org-admin="isOrgAdmin" :org-id="orgId" />
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
:deep(.stat-card) {
  background: var(--n-card-color);
  transition: all 0.3s;
}
:deep(.stat-card):hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
:deep(.live-card) {
  height: 100%;
  display: flex;
  flex-direction: column;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}
:deep(.live-card):hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 20px -8px rgba(0, 0, 0, 0.12);
}
:deep(.live-card-title) {
  font-weight: 600;
  margin-bottom: 6px;
  height: 44px;
  line-height: 22px;
}
:deep(.text-ellipsis-2) {
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}
:deep(.live-card-meta) {
  font-size: 12px;
  opacity: 0.75;
  margin-bottom: 8px;
}
:deep(.meta-row) {
  display: flex;
  justify-content: space-between;
}
</style>
