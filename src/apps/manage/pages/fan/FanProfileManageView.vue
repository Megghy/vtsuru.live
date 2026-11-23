<script setup lang="ts">
import { saveAs } from 'file-saver'
import {
  AlertTriangle,
  Cake,
  Check,
  Crown,
  Download,
  Eye,
  EyeOff,
  History,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Users,
} from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import {
  createManualFanProfile,
  exportFanProfiles,
  extractLiveFanFacts,
  type ExtractLiveFactsResponse,
  type FanListItem,
  type FanOverviewStats,
  type FanReminderItem,
  getFanList,
  resolveFanCandidateFact,
  toggleFanStar,
} from '@/api/fanProfile'
import { getApiLiveGetAll } from '@/api/generated/live/live'
import type { ResponseLiveInfoModel } from '@/api/generated/model'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import { useFanPrivacy } from '@/shared/composables/useFanPrivacy'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Skeleton } from '@/shared/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Textarea } from '@/shared/ui/textarea'

import FanProfileDetailSheet from './FanProfileDetailSheet.vue'

const route = useRoute()
const router = useRouter()
const { privacyMode, togglePrivacyMode, formatBirthday, formatPrice } = useFanPrivacy()

const loading = ref(false)
const exporting = ref(false)
const keyword = ref('')
const filter = ref<'all' | 'starred' | 'profiled' | 'birthday' | 'pending' | 'guard' | 'dormant'>('all')
const sort = ref<'lastActive' | 'price' | 'lives' | 'interacts' | 'birthday' | 'updated'>('lastActive')
const page = ref(1)
const pageSize = 30
const revealedBirthdays = ref<Record<string, boolean>>({})

const stats = ref<FanOverviewStats>({
  totalProfiles: 0,
  starredCount: 0,
  upcomingBirthdays: 0,
  pendingFactsCount: 0,
  activeGuardsCount: 0,
  dormantOldFansCount: 0,
})
const total = ref(0)
const items = ref<FanListItem[]>([])
const reminders = ref<FanReminderItem[]>([])

const todayReminders = computed(() => reminders.value.filter((r) => r.daysUntil === 0))

// 手动添加粉丝弹窗
const createDialogOpen = ref(false)
const creatingFan = ref(false)
const createUid = ref('')
const createName = ref('')
const createNickname = ref('')
const createStarred = ref(true)
const createNote = ref('')

// 详情抽屉
const detailOpen = ref(false)
const selectedOuid = ref<string | undefined>()
const selectedUid = ref<number | undefined>()

// 单场 AI 情报挖掘弹窗
const extractDialogOpen = ref(false)
const recentLives = ref<ResponseLiveInfoModel[]>([])
const selectedLiveId = ref('')
const extracting = ref(false)
const extractResult = ref<ExtractLiveFactsResponse | null>(null)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

async function fetchList() {
  loading.value = true
  try {
    const res = await getFanList({
      keyword: keyword.value.trim() || undefined,
      filter: filter.value,
      sort: sort.value,
      page: page.value,
      pageSize,
    })
    if (res.code === 200 && res.data) {
      stats.value = res.data.stats
      total.value = res.data.total
      items.value = res.data.items
      reminders.value = res.data.upcomingReminders
    } else {
      toast.error(res.message || '获取粉丝列表失败')
    }
  } finally {
    loading.value = false
  }
}

function openDetail(ouid?: string, uid?: number | null) {
  selectedOuid.value = ouid
  selectedUid.value = uid ?? undefined
  detailOpen.value = true
}

function applyStatFilter(target: typeof filter.value) {
  filter.value = target
  if (target === 'birthday') sort.value = 'birthday'
  page.value = 1
}

function toggleRevealBirthday(ouid: string) {
  if (privacyMode.value) {
    toast.info('当前处于防露屏模式，关闭后可单独展开生日')
    return
  }
  revealedBirthdays.value[ouid] = !revealedBirthdays.value[ouid]
}

async function handleToggleStar(fan: FanListItem) {
  const next = !fan.isStarred
  fan.isStarred = next
  const res = await toggleFanStar({
    oUId: fan.canonicalOUId,
    uId: fan.uId ?? undefined,
    latestKnownName: fan.latestKnownName || undefined,
    isStarred: next,
  })
  if (res.code === 200) {
    stats.value.starredCount = Math.max(0, stats.value.starredCount + (next ? 1 : -1))
    toast.success(next ? `已将「${fan.displayName}」设为重点粉丝` : `已取消「${fan.displayName}」的重点粉丝`)
  } else {
    fan.isStarred = !next
    toast.error(res.message || '星标操作失败')
  }
}

async function handleCreateManualFan() {
  const uidNum = Number(createUid.value.trim())
  if (!Number.isInteger(uidNum) || uidNum <= 0) {
    toast.warning('请输入有效的纯数字 B 站 UID')
    return
  }
  creatingFan.value = true
  try {
    const res = await createManualFanProfile({
      uId: uidNum,
      displayName: createName.value.trim() || undefined,
      nickname: createNickname.value.trim() || undefined,
      isStarred: createStarred.value,
      note: createNote.value.trim() || undefined,
    })
    if (res.code === 200 && res.data) {
      createDialogOpen.value = false
      createUid.value = ''
      createName.value = ''
      createNickname.value = ''
      createNote.value = ''
      toast.success('已手动建档')
      void fetchList()
      openDetail(res.data.canonicalOUId, res.data.uId)
    } else {
      toast.error(res.message || '建档失败')
    }
  } finally {
    creatingFan.value = false
  }
}

async function handleExportBackup() {
  if (exporting.value) return
  exporting.value = true
  try {
    const res = await exportFanProfiles()
    if (res.code === 200 && res.data) {
      const json = JSON.stringify(res.data, null, 2)
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
      const dateTag = new Date().toISOString().slice(0, 10)
      saveAs(blob, `vtsuru-fan-profiles-${dateTag}.json`)
      toast.success(`已导出 ${res.data.count} 份粉丝档案备份`)
    } else {
      toast.error(res.message || '导出失败')
    }
  } finally {
    exporting.value = false
  }
}

async function openExtractDialog() {
  extractDialogOpen.value = true
  extractResult.value = null
  if (recentLives.value.length === 0) {
    const res = await getApiLiveGetAll()
    if (res.code === 200 && res.data) {
      recentLives.value = res.data.filter((l) => l.isFinish && l.danmakusCount > 0).slice(0, 30)
      if (recentLives.value.length > 0 && !selectedLiveId.value) {
        selectedLiveId.value = recentLives.value[0].liveId
      }
    }
  }
}

async function runExtractLive() {
  if (!selectedLiveId.value || extracting.value) return
  extracting.value = true
  try {
    const res = await extractLiveFanFacts(selectedLiveId.value)
    if (res.code === 200 && res.data) {
      extractResult.value = res.data
      if (res.data.newFactsCount > 0) {
        toast.success(`从本场 ${res.data.scannedMessages} 条样本中挖掘出 ${res.data.newFactsCount} 条新线索`)
        void fetchList()
      } else {
        toast.info(`已扫描 ${res.data.scannedMessages} 条弹幕/SC，暂未发现新的个人情报`)
      }
    } else {
      toast.error(res.message || '情报挖掘失败')
    }
  } finally {
    extracting.value = false
  }
}

async function quickResolveExtracted(ouid: string, factId: string, accept: boolean) {
  const res = await resolveFanCandidateFact({ oUId: ouid, factId, accept })
  if (res.code === 200) {
    if (extractResult.value) {
      extractResult.value.items = extractResult.value.items.filter((i) => i.fact.id !== factId)
    }
    toast.success(accept ? '已采纳写入档案' : '已忽略')
    void fetchList()
  }
}

watch([filter, sort], () => {
  page.value = 1
  void fetchList()
})

watch(page, () => {
  void fetchList()
})

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(keyword, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    void fetchList()
  }, 300)
})

function formatShortDate(iso?: string | null) {
  if (!iso) return '-'
  return iso.slice(0, 10)
}

function guardName(level: number) {
  if (level === 1) return '总督'
  if (level === 2) return '提督'
  if (level === 3) return '舰长'
  return ''
}

onMounted(async () => {
  await fetchList()
  const qOuid = typeof route.query.ouid === 'string' ? route.query.ouid : undefined
  const qUid = typeof route.query.uid === 'string' ? Number(route.query.uid) : undefined
  if (qOuid || (qUid && qUid > 0)) {
    openDetail(qOuid, qUid)
    void router.replace({ query: {} })
  }
})
</script>

<template>
  <div class="space-y-4 w-full">
    <ManagePageHeader
      title="粉丝档案"
      subtitle="云端粉丝手记、AI 画像总结、生日提醒与中控台实时联动"
    >
      <template #action>
        <div class="flex flex-wrap items-center gap-2">
          <Button
            :variant="privacyMode ? 'secondary' : 'outline'"
            @click="togglePrivacyMode"
          >
            <EyeOff
              v-if="privacyMode"
              class="size-3.5 mr-1.5 text-amber-500"
            />
            <Eye
              v-else
              class="size-3.5 mr-1.5"
            />
            {{ privacyMode ? '防露屏：已开启' : '防露屏' }}
          </Button>
          <Button
            variant="outline"
            @click="createDialogOpen = true"
          >
            <Plus class="size-3.5 mr-1.5" />
            添加粉丝
          </Button>
          <Button
            variant="outline"
            :disabled="exporting"
            @click="handleExportBackup"
          >
            <Loader2
              v-if="exporting"
              class="size-3.5 mr-1.5 animate-spin"
            />
            <Download
              v-else
              class="size-3.5 mr-1.5"
            />
            导出备份
          </Button>
          <Button
            variant="secondary"
            @click="openExtractDialog"
          >
            <Sparkles class="size-3.5 mr-1.5 text-brand" />
            从直播挖掘 AI 情报
          </Button>
          <Button
            variant="outline"
            :disabled="loading"
            @click="fetchList"
          >
            <RefreshCw
              class="size-3.5 mr-1.5"
              :class="{ 'animate-spin': loading }"
            />
            刷新
          </Button>
        </div>
      </template>
    </ManagePageHeader>

    <!-- 今日生日 / 纪念日轻提醒条 -->
    <div
      v-if="todayReminders.length > 0"
      class="rounded-lg border border-primary/30 bg-primary/5 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2"
    >
      <div class="flex flex-wrap items-center gap-2 text-xs">
        <Cake class="size-4 text-rose-500 shrink-0" />
        <span class="font-semibold text-foreground">
          今天有 {{ todayReminders.length }} 位粉丝过生日 / 纪念日
        </span>
        <Badge
          variant="outline"
          class="text-[10px] gap-1 text-muted-foreground"
        >
          <Lock class="size-2.5" />
          仅提醒主播，不会发到直播间
        </Badge>
        <button
          v-for="r in todayReminders"
          :key="`today-${r.profileId}-${r.kind}-${r.title}`"
          type="button"
          class="inline-flex items-center gap-1 rounded-full bg-background border border-border px-2.5 py-0.5 text-xs hover:bg-accent transition-colors"
          @click="openDetail(r.canonicalOUId, r.uId)"
        >
          <span class="font-medium">{{ privacyMode ? '•••' : r.displayName }}</span>
          <span class="text-muted-foreground">{{ r.kind === 'birthday' ? '生日' : r.title }}</span>
        </button>
      </div>
      <Button
        size="xs"
        variant="ghost"
        @click="applyStatFilter('birthday')"
      >
        查看全部生日 →
      </Button>
    </div>

    <!-- 顶部 6 宫格指标卡（点击直达筛选） -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
      <Card
        class="p-3 card-interactive cursor-pointer"
        :class="filter === 'starred' ? 'border-brand' : ''"
        @click="applyStatFilter('starred')"
      >
        <div class="text-[11px] text-muted-foreground flex items-center gap-1">
          <Star class="size-3.5 text-amber-500 fill-amber-400" />
          重点粉丝
        </div>
        <div class="text-lg font-semibold tabular-nums mt-1">{{ stats.starredCount }}</div>
      </Card>
      <Card
        class="p-3 card-interactive cursor-pointer"
        :class="filter === 'profiled' ? 'border-brand' : ''"
        @click="applyStatFilter('profiled')"
      >
        <div class="text-[11px] text-muted-foreground flex items-center gap-1">
          <Users class="size-3.5" />
          已建档粉丝
        </div>
        <div class="text-lg font-semibold tabular-nums mt-1">{{ stats.totalProfiles }}</div>
      </Card>
      <Card
        class="p-3 card-interactive cursor-pointer"
        :class="filter === 'birthday' ? 'border-brand' : ''"
        @click="applyStatFilter('birthday')"
      >
        <div class="text-[11px] text-muted-foreground flex items-center gap-1">
          <Cake class="size-3.5 text-amber-500" />
          30天内生日
        </div>
        <div class="text-lg font-semibold tabular-nums mt-1">{{ stats.upcomingBirthdays }}</div>
      </Card>
      <Card
        class="p-3 card-interactive cursor-pointer"
        :class="filter === 'pending' ? 'border-brand' : ''"
        @click="applyStatFilter('pending')"
      >
        <div class="text-[11px] text-muted-foreground flex items-center gap-1">
          <AlertTriangle class="size-3.5 text-brand" />
          待确认 AI 情报
        </div>
        <div class="text-lg font-semibold tabular-nums mt-1">{{ stats.pendingFactsCount }}</div>
      </Card>
      <Card
        class="p-3 card-interactive cursor-pointer"
        :class="filter === 'guard' ? 'border-brand' : ''"
        @click="applyStatFilter('guard')"
      >
        <div class="text-[11px] text-muted-foreground flex items-center gap-1">
          <Crown class="size-3.5 text-amber-500" />
          在舰成员
        </div>
        <div class="text-lg font-semibold tabular-nums mt-1">{{ stats.activeGuardsCount }}</div>
      </Card>
      <Card
        class="p-3 card-interactive cursor-pointer"
        :class="filter === 'dormant' ? 'border-brand' : ''"
        @click="applyStatFilter('dormant')"
      >
        <div class="text-[11px] text-muted-foreground flex items-center gap-1">
          <History class="size-3.5" />
          沉睡老粉 (≥30天)
        </div>
        <div class="text-lg font-semibold tabular-nums mt-1">{{ stats.dormantOldFansCount }}</div>
      </Card>
    </div>

    <!-- 近期生日 / 纪念日日历条 -->
    <Card
      v-if="reminders.length > 0"
      class="p-3 space-y-2"
    >
      <div class="text-xs font-semibold flex items-center gap-1.5">
        <Cake class="size-3.5 text-amber-500" />
        近期生日与纪念日提醒（未来 30 天）
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="r in reminders"
          :key="`${r.profileId}-${r.kind}`"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 hover:bg-muted px-2.5 py-1 text-xs transition-colors"
          @click="openDetail(r.canonicalOUId, r.uId)"
        >
          <span class="font-medium text-foreground">{{ privacyMode ? '•••' : r.displayName }}</span>
          <span class="text-muted-foreground">
            {{ r.kind === 'birthday' ? '生日' : r.years ? `${r.title || '纪念日'} ${r.years}周年` : r.title || '纪念日' }}
            {{ privacyMode && r.kind === 'birthday' ? '••月••日' : r.dateLabel }}
          </span>
          <Badge
            :variant="r.daysUntil === 0 ? 'default' : 'secondary'"
            class="text-[10px] px-1.5 py-0 tabular-nums"
          >
            {{ r.daysUntil === 0 ? '今天' : `${r.daysUntil}天后` }}
          </Badge>
        </button>
      </div>
    </Card>

    <!-- 筛选与搜索栏 -->
    <div class="flex flex-wrap items-center gap-2.5">
      <Tabs
        v-model="filter"
        class="w-full sm:w-auto"
      >
        <TabsList>
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="starred">重点粉丝</TabsTrigger>
          <TabsTrigger value="profiled">已建档</TabsTrigger>
          <TabsTrigger value="birthday">近期生日</TabsTrigger>
          <TabsTrigger value="pending">待确认</TabsTrigger>
          <TabsTrigger value="guard">在舰</TabsTrigger>
          <TabsTrigger value="dormant">沉睡老粉</TabsTrigger>
        </TabsList>
      </Tabs>

      <div class="relative flex-1 min-w-[200px]">
        <Search class="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <Input
          v-model="keyword"
          class="pl-8"
          placeholder="搜索称呼、昵称、标签、备注或 UID..."
        />
      </div>

      <Select v-model="sort">
        <SelectTrigger class="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="lastActive">最近活跃</SelectItem>
          <SelectItem value="price">累计消费</SelectItem>
          <SelectItem value="lives">参与场次</SelectItem>
          <SelectItem value="interacts">累计互动</SelectItem>
          <SelectItem value="birthday">生日临近</SelectItem>
          <SelectItem value="updated">最近编辑</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- 粉丝列表 -->
    <Card class="overflow-hidden">
      <div
        v-if="loading && items.length === 0"
        class="p-4 space-y-2.5"
      >
        <Skeleton
          v-for="i in 6"
          :key="i"
          class="h-14 rounded-md"
        />
      </div>

      <div
        v-else-if="items.length > 0"
        class="divide-y divide-border"
      >
        <div
          v-for="fan in items"
          :key="fan.canonicalOUId"
          role="button"
          tabindex="0"
          class="w-full text-left px-4 py-3 list-item-interactive flex items-center gap-3 cursor-pointer"
          @click="openDetail(fan.canonicalOUId, fan.uId)"
          @keydown.enter="openDetail(fan.canonicalOUId, fan.uId)"
        >
          <button
            type="button"
            class="p-1 rounded-md hover:bg-accent transition-colors shrink-0"
            :title="fan.isStarred ? '取消重点粉丝' : '设为重点粉丝'"
            @click.stop="handleToggleStar(fan)"
          >
            <Star
              class="size-4"
              :class="fan.isStarred ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground/50 hover:text-amber-500'"
            />
          </button>

          <img
            v-if="fan.avatar"
            :src="fan.avatar"
            referrerpolicy="no-referrer"
            loading="lazy"
            class="size-10 rounded-full object-cover border border-border shrink-0"
          />
          <div
            v-else
            class="size-10 rounded-full bg-muted flex-center text-xs font-semibold text-muted-foreground shrink-0"
          >
            {{ fan.displayName.slice(0, 1) }}
          </div>

          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-sm font-medium text-foreground">{{ fan.displayName }}</span>
              <span
                v-if="fan.nickname && fan.latestKnownName && fan.nickname !== fan.latestKnownName"
                class="text-xs text-muted-foreground"
              >
                ({{ fan.latestKnownName }})
              </span>
              <Badge
                v-if="fan.isActiveGuard"
                variant="secondary"
                class="text-[11px] gap-0.5"
              >
                <Crown class="size-3 text-amber-500" />
                {{ guardName(fan.guardLevel) }}
              </Badge>
              <button
                v-if="fan.birthdayMonth && fan.birthdayDay"
                type="button"
                class="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 hover:bg-accent px-2 py-0.5 text-[11px] text-amber-600 dark:text-amber-400 transition-colors"
                :title="privacyMode ? '已开启防露屏模式' : '点击查看/隐藏生日'"
                @click.stop="toggleRevealBirthday(fan.canonicalOUId)"
              >
                <Cake class="size-3" />
                <span>{{ formatBirthday(fan.birthdayMonth, fan.birthdayDay, !!revealedBirthdays[fan.canonicalOUId]) }}</span>
                <span
                  v-if="fan.daysUntilBirthday !== null && fan.daysUntilBirthday !== undefined && fan.daysUntilBirthday <= 30"
                  class="text-[10px] opacity-80"
                >
                  ({{ fan.daysUntilBirthday === 0 ? '今天' : `${fan.daysUntilBirthday}天` }})
                </span>
              </button>
              <Badge
                v-if="fan.pendingFactCount > 0"
                variant="secondary"
                class="text-[11px] text-brand"
              >
                {{ fan.pendingFactCount }} 条待确认
              </Badge>
              <Badge
                v-for="tag in fan.tags.slice(0, 3)"
                :key="tag"
                variant="outline"
                class="text-[11px]"
              >
                {{ tag }}
              </Badge>
            </div>
            <p
              v-if="fan.aiSummary || fan.notePreview"
              class="text-xs text-muted-foreground truncate"
            >
              <template v-if="privacyMode && !fan.aiSummary">
                已开启防露屏遮罩（备注已隐藏）
              </template>
              <template v-else>
                <span
                  v-if="fan.aiSummary"
                  class="text-brand mr-1"
                  >[AI]</span
                >
                {{ fan.aiSummary || fan.notePreview }}
              </template>
            </p>
          </div>

          <div class="hidden sm:grid grid-cols-3 gap-4 text-right text-xs tabular-nums shrink-0">
            <div>
              <div class="font-medium text-foreground">{{ fan.liveCount }} 场</div>
              <div class="text-[11px] text-muted-foreground">弹幕 {{ fan.danmakuCount }}</div>
            </div>
            <div>
              <div class="font-medium text-foreground">{{ formatPrice(fan.totalPrice) }}</div>
              <div class="text-[11px] text-muted-foreground">累计消费</div>
            </div>
            <div>
              <div class="font-medium text-foreground">{{ formatShortDate(fan.lastActiveAt) }}</div>
              <div class="text-[11px] text-muted-foreground">
                {{ fan.dormantDays ? `${fan.dormantDays}天前` : '近期活跃' }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-else
        class="p-10"
      >
        <Empty description="当前条件下暂无粉丝数据" />
      </div>

      <div
        v-if="total > pageSize"
        class="px-4 py-2.5 border-t border-border flex-between text-xs text-muted-foreground"
      >
        <span class="tabular-nums">共 {{ total }} 位粉丝，第 {{ page }} / {{ totalPages }} 页</span>
        <div class="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="xs"
            :disabled="page <= 1"
            @click="page--"
          >
            上一页
          </Button>
          <Button
            variant="outline"
            size="xs"
            :disabled="page >= totalPages"
            @click="page++"
          >
            下一页
          </Button>
        </div>
      </div>
    </Card>

    <!-- 手动建档弹窗 -->
    <Dialog v-model:open="createDialogOpen">
      <DialogContent class="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle class="text-sm flex items-center gap-1.5">
            <Plus class="size-4 text-primary" />
            手动添加粉丝档案
          </DialogTitle>
          <DialogDescription class="text-xs">
            输入 B 站 UID 即可提前建档（尚未发过弹幕也能记录称呼与备注，后续发言会自动合并）。
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-3 py-1">
          <FormField
            label="B 站 UID"
            required
          >
            <Input
              v-model="createUid"
              placeholder="例如：12345678"
            />
          </FormField>
          <div class="grid grid-cols-2 gap-2.5">
            <FormField label="B 站昵称（选填）">
              <Input
                v-model="createName"
                placeholder="原昵称"
              />
            </FormField>
            <FormField label="专属称呼（选填）">
              <Input
                v-model="createNickname"
                placeholder="中控台优先显示"
              />
            </FormField>
          </div>
          <label class="flex items-center gap-2 text-xs cursor-pointer">
            <Checkbox
              :model-value="createStarred"
              @update:model-value="createStarred = Boolean($event)"
            />
            <span>设为重点粉丝（星标）</span>
          </label>
          <FormField label="备注（选填）">
            <Textarea
              v-model="createNote"
              rows="3"
              placeholder="记录喜好、称呼来源等（请勿填手机号或家庭住址）"
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            @click="createDialogOpen = false"
          >
            取消
          </Button>
          <Button
            :disabled="creatingFan || !createUid.trim()"
            @click="handleCreateManualFan"
          >
            <Loader2
              v-if="creatingFan"
              class="size-3.5 mr-1.5 animate-spin"
            />
            创建并打开档案
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 详情抽屉 -->
    <FanProfileDetailSheet
      v-model:open="detailOpen"
      :ouid="selectedOuid"
      :uid="selectedUid"
      @updated="fetchList"
    />

    <!-- 从单场直播挖掘 AI 情报弹窗 -->
    <Dialog v-model:open="extractDialogOpen">
      <DialogContent class="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-1.5 text-sm">
            <Sparkles class="size-4 text-brand" />
            从单场直播挖掘粉丝情报
          </DialogTitle>
          <DialogDescription class="text-xs">
            AI 将扫描所选场次的 SC、上舰与高信息量弹幕，提炼生日、爱好、称呼与约定等待确认线索，不会覆盖你已写的备注。
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-3">
          <div class="flex gap-2">
            <Select v-model="selectedLiveId">
              <SelectTrigger class="flex-1">
                <SelectValue placeholder="选择一场已归档直播..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="live in recentLives"
                  :key="live.liveId"
                  :value="live.liveId"
                >
                  {{ live.title || '未命名直播' }}（弹幕 {{ live.danmakusCount }}）
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              :disabled="!selectedLiveId || extracting"
              @click="runExtractLive"
            >
              <Loader2
                v-if="extracting"
                class="size-3.5 mr-1.5 animate-spin"
              />
              开始挖掘
            </Button>
          </div>

          <div
            v-if="extractResult"
            class="space-y-2 max-h-[340px] overflow-y-auto scrollbar-thin"
          >
            <div class="text-[11px] text-muted-foreground tabular-nums">
              已扫描 {{ extractResult.scannedMessages }} 条互动，发现 {{ extractResult.items.length }} 条待审核线索
            </div>
            <div
              v-for="item in extractResult.items"
              :key="item.fact.id"
              class="rounded-md border border-border bg-card p-2.5 space-y-1.5"
            >
              <div class="flex-between gap-2">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="text-xs font-semibold truncate">{{ item.fanName }}</span>
                  <Badge
                    variant="outline"
                    class="text-[10px]"
                    >{{ item.fact.label }}</Badge
                  >
                  <span class="text-xs text-foreground truncate">{{ item.fact.value }}</span>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <Button
                    size="xs"
                    variant="secondary"
                    @click="quickResolveExtracted(item.canonicalOUId, item.fact.id, true)"
                  >
                    <Check class="size-3 mr-0.5" />
                    采纳
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    class="text-muted-foreground"
                    @click="quickResolveExtracted(item.canonicalOUId, item.fact.id, false)"
                  >
                    忽略
                  </Button>
                </div>
              </div>
              <p
                v-if="item.fact.evidence"
                class="text-[11px] text-muted-foreground wrap-anywhere"
              >
                「{{ item.fact.evidence }}」
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
