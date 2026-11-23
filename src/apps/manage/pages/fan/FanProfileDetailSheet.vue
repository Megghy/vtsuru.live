<script setup lang="ts">
import {
  AlertTriangle,
  BarChart3,
  BookHeart,
  BookmarkPlus,
  Cake,
  CalendarHeart,
  Check,
  Crown,
  Eye,
  EyeOff,
  GitMerge,
  Gift,
  Heart,
  History,
  Link2,
  Loader2,
  MessageSquare,
  Music,
  Plus,
  Save,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import {
  addFanMemory,
  deleteFanMemory,
  type FanAnniversaryItem,
  type FanDanmakuItem,
  type FanDetailResponse,
  getFanDanmakus,
  getFanDetail,
  mergeFanProfiles,
  resolveFanCandidateFact,
  saveFanProfile,
  summarizeFanAi,
  toggleFanStar,
} from '@/api/fanProfile'
import { EventDataTypes } from '@/api/generated/model'
import { useFanPrivacy } from '@/shared/composables/useFanPrivacy'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Skeleton } from '@/shared/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Textarea } from '@/shared/ui/textarea'

import FanMemoryBookletDialog from './FanMemoryBookletDialog.vue'

const props = defineProps<{
  open: boolean
  ouid?: string
  uid?: number
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  updated: []
}>()

const router = useRouter()
const { privacyMode, togglePrivacyMode, formatBirthday, formatPrice } = useFanPrivacy()

const loading = ref(false)
const saving = ref(false)
const summarizing = ref(false)
const merging = ref(false)
const togglingStar = ref(false)
const bookletOpen = ref(false)
const birthdayRevealed = ref(false)
const detail = ref<FanDetailResponse | null>(null)
const activeTab = ref<'profile' | 'ai' | 'records'>('profile')

// 表单草稿
const nickname = ref('')
const pronunciation = ref('')
const birthdayMonth = ref<string>('none')
const birthdayDay = ref<string>('none')
const anniversaries = ref<FanAnniversaryItem[]>([])
const newAnnTitle = ref('')
const newAnnDate = ref('')
const newAnnRepeat = ref(true)
const tags = ref<string[]>([])
const newTag = ref('')
const taboos = ref('')
const note = ref('')

// 记忆片段新增
const memoryDraft = ref('')
const addingMemory = ref(false)

// 合号输入
const mergeInput = ref('')

// 弹幕筛选分页
const dmFilterType = ref<string>('all')
const dmList = ref<FanDanmakuItem[]>([])
const dmLoading = ref(false)
const dmHasMore = ref(true)

const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1))
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1))

const displayName = computed(() => {
  if (!detail.value) return ''
  return detail.value.nickname || detail.value.latestKnownName || (detail.value.uId ? `UID ${detail.value.uId}` : detail.value.canonicalOUId.slice(0, 8))
})

const trendBars = computed(() => {
  const lives = [...(detail.value?.recentLives ?? [])].slice(0, 12).reverse()
  const maxVal = Math.max(1, ...lives.map((l) => l.interactCount || l.danmakuCount || 1))
  return lives.map((l) => {
    const val = l.interactCount || l.danmakuCount
    return {
      ...l,
      val,
      heightPct: Math.max(10, Math.round((val / maxVal) * 100)),
      shortDate: l.startDate ? l.startDate.slice(5, 10) : '',
    }
  })
})

function syncForm(d: FanDetailResponse) {
  nickname.value = d.nickname ?? ''
  pronunciation.value = d.pronunciation ?? ''
  birthdayMonth.value = d.birthdayMonth ? String(d.birthdayMonth) : 'none'
  birthdayDay.value = d.birthdayDay ? String(d.birthdayDay) : 'none'
  anniversaries.value = (d.anniversaries ?? []).map((a) => ({
    ...a,
    date: a.date ? a.date.slice(0, 10) : '',
  }))
  tags.value = [...(d.tags ?? [])]
  taboos.value = d.taboos ?? ''
  note.value = d.note ?? ''
  dmList.value = [...(d.recentDanmakus ?? [])]
  dmHasMore.value = dmList.value.length >= 60
  dmFilterType.value = 'all'
  birthdayRevealed.value = false
}

function addAnniversary() {
  const title = newAnnTitle.value.trim() || '纪念日'
  const date = newAnnDate.value.trim()
  if (!date) {
    toast.warning('请选择纪念日日期')
    return
  }
  if (anniversaries.value.length >= 20) {
    toast.warning('最多添加 20 条自定义纪念日')
    return
  }
  anniversaries.value.push({
    id: `ann_${Date.now().toString(36)}`,
    title,
    date,
    repeatYearly: newAnnRepeat.value,
  })
  newAnnTitle.value = ''
  newAnnDate.value = ''
  newAnnRepeat.value = true
}

function removeAnniversary(id: string) {
  anniversaries.value = anniversaries.value.filter((a) => a.id !== id)
}

async function handleToggleStar() {
  if (!detail.value || togglingStar.value) return
  togglingStar.value = true
  try {
    const next = !detail.value.isStarred
    const res = await toggleFanStar({
      oUId: detail.value.canonicalOUId,
      uId: detail.value.uId ?? undefined,
      latestKnownName: detail.value.latestKnownName || undefined,
      isStarred: next,
    })
    if (res.code === 200) {
      detail.value.isStarred = next
      emit('updated')
      toast.success(next ? '已设为重点粉丝' : '已取消重点粉丝')
    } else {
      toast.error(res.message || '操作失败')
    }
  } finally {
    togglingStar.value = false
  }
}

async function loadDetail() {
  if (!props.ouid && !props.uid) return
  loading.value = true
  try {
    const res = await getFanDetail({ ouid: props.ouid || undefined, uid: props.uid || undefined })
    if (res.code === 200 && res.data) {
      detail.value = res.data
      syncForm(res.data)
    } else {
      toast.error(res.message || '加载粉丝档案失败')
    }
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.open, props.ouid, props.uid],
  ([open]) => {
    if (open) {
      activeTab.value = 'profile'
      void loadDetail()
    }
  },
  { immediate: true },
)

function addTag() {
  const val = newTag.value.trim()
  if (!val) return
  if (!tags.value.includes(val) && tags.value.length < 20) {
    tags.value.push(val)
  }
  newTag.value = ''
}

function removeTag(tag: string) {
  tags.value = tags.value.filter((t) => t !== tag)
}

async function handleSave() {
  if (!detail.value || saving.value) return
  saving.value = true
  try {
    const m = birthdayMonth.value !== 'none' ? Number(birthdayMonth.value) : null
    const d = birthdayDay.value !== 'none' ? Number(birthdayDay.value) : null
    const res = await saveFanProfile({
      oUId: detail.value.canonicalOUId,
      uId: detail.value.uId ?? undefined,
      latestKnownName: detail.value.latestKnownName || undefined,
      isStarred: detail.value.isStarred,
      nickname: nickname.value.trim(),
      pronunciation: pronunciation.value.trim(),
      birthdayMonth: m && d ? m : null,
      birthdayDay: m && d ? d : null,
      anniversaries: anniversaries.value.map((a) => ({
        id: a.id,
        title: a.title.trim() || '纪念日',
        date: a.date,
        repeatYearly: a.repeatYearly,
      })),
      tags: tags.value,
      taboos: taboos.value.trim(),
      note: note.value.trim(),
    })
    if (res.code === 200 && res.data) {
      detail.value = res.data
      syncForm(res.data)
      emit('updated')
      toast.success('粉丝档案已保存')
    } else {
      toast.error(res.message || '保存失败')
    }
  } finally {
    saving.value = false
  }
}

async function handleAddMemory() {
  if (!detail.value || !memoryDraft.value.trim() || addingMemory.value) return
  addingMemory.value = true
  try {
    const res = await addFanMemory({
      oUId: detail.value.canonicalOUId,
      uId: detail.value.uId ?? undefined,
      latestKnownName: detail.value.latestKnownName || undefined,
      content: memoryDraft.value.trim(),
    })
    if (res.code === 200 && res.data) {
      detail.value.memories.unshift(res.data)
      memoryDraft.value = ''
      emit('updated')
      toast.success('记忆片段已记录')
    } else {
      toast.error(res.message || '记录失败')
    }
  } finally {
    addingMemory.value = false
  }
}

async function handleDeleteMemory(memoryId: string) {
  if (!detail.value) return
  const res = await deleteFanMemory({ oUId: detail.value.canonicalOUId, memoryId })
  if (res.code === 200 && res.data) {
    detail.value.memories = detail.value.memories.filter((m) => m.id !== memoryId)
    emit('updated')
    toast.success('已移除记忆片段')
  }
}

async function handleSummarize() {
  if (!detail.value || summarizing.value) return
  summarizing.value = true
  try {
    const res = await summarizeFanAi({
      oUId: detail.value.canonicalOUId,
      uId: detail.value.uId ?? undefined,
      latestKnownName: detail.value.latestKnownName || undefined,
    })
    if (res.code === 200 && res.data) {
      detail.value = res.data
      syncForm(res.data)
      activeTab.value = 'ai'
      emit('updated')
      toast.success('AI 粉丝画像已刷新')
    } else {
      toast.error(res.message || 'AI 画像生成失败')
    }
  } finally {
    summarizing.value = false
  }
}

async function handleResolveFact(factId: string, accept: boolean) {
  if (!detail.value) return
  const res = await resolveFanCandidateFact({
    oUId: detail.value.canonicalOUId,
    factId,
    accept,
  })
  if (res.code === 200 && res.data) {
    detail.value = res.data
    syncForm(res.data)
    emit('updated')
    toast.success(accept ? '已采纳并写入档案' : '已忽略该条情报')
  } else {
    toast.error(res.message || '操作失败')
  }
}

async function handleMerge() {
  if (!detail.value || !mergeInput.value.trim() || merging.value) return
  const raw = mergeInput.value.trim()
  const isNumericUid = /^\d+$/.test(raw)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)
  if (!isNumericUid && !isUuid) {
    toast.warning('请输入要合并的 B 站纯数字 UID 或 OpenId (UUID)')
    return
  }
  merging.value = true
  try {
    const res = await mergeFanProfiles({
      targetOUId: detail.value.canonicalOUId,
      sourceUId: isNumericUid ? Number(raw) : undefined,
      sourceOUId: isUuid ? raw : undefined,
    })
    if (res.code === 200 && res.data) {
      detail.value = res.data
      syncForm(res.data)
      mergeInput.value = ''
      emit('updated')
      toast.success('账号档案已合并，历史弹幕与统计将自动聚合')
    } else {
      toast.error(res.message || '合并失败')
    }
  } finally {
    merging.value = false
  }
}

async function loadDanmakus(reset: boolean) {
  if (!detail.value || dmLoading.value) return
  dmLoading.value = true
  try {
    const offset = reset ? 0 : dmList.value.length
    const typeParam = dmFilterType.value === 'all' ? undefined : (Number(dmFilterType.value) as EventDataTypes)
    const res = await getFanDanmakus({
      ouid: detail.value.canonicalOUId,
      type: typeParam,
      limit: 60,
      offset,
    })
    if (res.code === 200 && res.data) {
      dmList.value = reset ? res.data : [...dmList.value, ...res.data]
      dmHasMore.value = res.data.length >= 60
    }
  } finally {
    dmLoading.value = false
  }
}

watch(dmFilterType, () => {
  if (detail.value) void loadDanmakus(true)
})

function formatDate(iso?: string | null) {
  if (!iso) return '-'
  return iso.replace('T', ' ').slice(0, 16)
}

function eventTypeLabel(t: EventDataTypes) {
  switch (t) {
    case EventDataTypes.Guard:
      return '上舰'
    case EventDataTypes.SC:
      return 'SC'
    case EventDataTypes.Gift:
      return '礼物'
    case EventDataTypes.Message:
      return '弹幕'
    case EventDataTypes.Enter:
      return '进场'
    case EventDataTypes.Follow:
      return '关注'
    case EventDataTypes.Like:
      return '点赞'
    default:
      return '互动'
  }
}

function guardName(level: number) {
  if (level === 1) return '总督'
  if (level === 2) return '提督'
  if (level === 3) return '舰长'
  return ''
}
</script>

<template>
  <Sheet
    :open="open"
    @update:open="(v) => emit('update:open', v)"
  >
    <SheetContent
      side="right"
      class="w-full sm:max-w-[740px] p-0 flex flex-col gap-0"
    >
      <SheetHeader class="p-4 border-b border-border shrink-0 space-y-2">
        <div
          v-if="loading && !detail"
          class="flex items-center gap-3"
        >
          <Skeleton class="size-11 rounded-full" />
          <div class="space-y-1.5 flex-1">
            <Skeleton class="h-4 w-36" />
            <Skeleton class="h-3 w-48" />
          </div>
        </div>
        <template v-else-if="detail">
          <div class="flex items-start gap-3 pr-6">
            <img
              v-if="detail.avatar"
              :src="detail.avatar"
              referrerpolicy="no-referrer"
              class="size-11 rounded-full object-cover border border-border shrink-0"
            />
            <div
              v-else
              class="size-11 rounded-full bg-muted flex-center text-sm font-semibold text-muted-foreground shrink-0"
            >
              {{ displayName.slice(0, 1) }}
            </div>
            <div class="min-w-0 flex-1">
              <SheetTitle class="text-sm font-semibold flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  class="inline-flex items-center justify-center rounded-sm hover:bg-accent p-0.5 transition-colors"
                  :disabled="togglingStar"
                  :title="detail.isStarred ? '取消重点粉丝' : '设为重点粉丝'"
                  @click="handleToggleStar"
                >
                  <Star
                    class="size-4"
                    :class="detail.isStarred ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground'"
                  />
                </button>
                <span>{{ displayName }}</span>
                <span
                  v-if="detail.nickname && detail.latestKnownName && detail.nickname !== detail.latestKnownName"
                  class="text-xs font-normal text-muted-foreground"
                >
                  ({{ detail.latestKnownName }})
                </span>
                <Badge
                  v-if="detail.isStarred"
                  variant="secondary"
                  class="text-[10px] text-amber-600 dark:text-amber-400"
                >
                  重点粉丝
                </Badge>
                <Badge
                  v-if="detail.guard?.isActive"
                  variant="secondary"
                  class="text-[11px] gap-0.5"
                >
                  <Crown class="size-3 text-amber-500" />
                  {{ guardName(detail.guard.guardLevel) }} · {{ detail.guard.accompanyDays }}天
                </Badge>
                <Badge
                  v-if="detail.isAuthed"
                  variant="outline"
                  class="text-[11px]"
                >
                  已认证
                </Badge>
              </SheetTitle>
              <SheetDescription class="text-[11px] flex items-center gap-2 flex-wrap mt-0.5 tabular-nums">
                <span v-if="detail.uId">UID {{ detail.uId }}</span>
                <span class="truncate max-w-[180px]" :title="detail.canonicalOUId">OUID {{ detail.canonicalOUId.slice(0, 12) }}…</span>
                <button
                  v-if="detail.birthdayMonth && detail.birthdayDay"
                  type="button"
                  class="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:underline"
                  :title="privacyMode ? '已开启防露屏模式' : birthdayRevealed ? '点击隐藏生日' : '点击查看生日'"
                  @click="birthdayRevealed = !birthdayRevealed"
                >
                  <Cake class="size-3" />
                  <span>{{ formatBirthday(detail.birthdayMonth, detail.birthdayDay, birthdayRevealed) }}</span>
                  <EyeOff
                    v-if="birthdayRevealed && !privacyMode"
                    class="size-2.5 opacity-70"
                  />
                  <Eye
                    v-else
                    class="size-2.5 opacity-70"
                  />
                </button>
              </SheetDescription>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <Button
                variant="ghost"
                size="icon-xs"
                :title="privacyMode ? '关闭防露屏模式' : '开启防露屏模式（隐藏敏感信息与消费）'"
                @click="togglePrivacyMode"
              >
                <EyeOff
                  v-if="privacyMode"
                  class="size-3.5 text-amber-500"
                />
                <Eye
                  v-else
                  class="size-3.5 text-muted-foreground"
                />
              </Button>
              <Button
                variant="outline"
                size="xs"
                @click="bookletOpen = true"
              >
                <BookHeart class="size-3.5 mr-1 text-primary" />
                纪念手册
              </Button>
              <Button
                variant="secondary"
                size="xs"
                :disabled="summarizing"
                @click="handleSummarize"
              >
                <Loader2
                  v-if="summarizing"
                  class="size-3.5 mr-1 animate-spin"
                />
                <Sparkles
                  v-else
                  class="size-3.5 mr-1 text-brand"
                />
                {{ detail.aiSummary ? '刷新 AI' : 'AI 画像' }}
              </Button>
            </div>
          </div>

          <!-- 跨场统计紧凑条 -->
          <div class="grid grid-cols-4 gap-2 pt-1">
            <div class="rounded-md bg-muted/50 px-2.5 py-1.5">
              <div class="text-[11px] text-muted-foreground">参与场次</div>
              <div class="text-sm font-semibold tabular-nums">{{ detail.liveCount }}</div>
            </div>
            <div class="rounded-md bg-muted/50 px-2.5 py-1.5">
              <div class="text-[11px] text-muted-foreground">累计弹幕</div>
              <div class="text-sm font-semibold tabular-nums">{{ detail.danmakuCount }}</div>
            </div>
            <div class="rounded-md bg-muted/50 px-2.5 py-1.5">
              <div class="text-[11px] text-muted-foreground">累计消费</div>
              <div class="text-sm font-semibold tabular-nums">{{ formatPrice(detail.totalPrice) }}</div>
            </div>
            <div class="rounded-md bg-muted/50 px-2.5 py-1.5">
              <div class="text-[11px] text-muted-foreground">积分 / 签到</div>
              <div class="text-sm font-semibold tabular-nums">
                {{ detail.point ? `${Math.round(detail.point.point)} / ${detail.point.totalCheckInDays}天` : '-' }}
              </div>
            </div>
          </div>
        </template>
      </SheetHeader>

      <div
        v-if="detail"
        class="flex-1 min-h-0 flex flex-col"
      >
        <Tabs
          v-model="activeTab"
          class="flex-1 min-h-0 flex flex-col"
        >
          <div class="px-4 pt-3 shrink-0">
            <TabsList class="w-full grid grid-cols-3">
              <TabsTrigger value="profile">档案与手记</TabsTrigger>
              <TabsTrigger value="ai">
                AI 画像
                <Badge
                  v-if="detail.pendingFacts.length > 0"
                  variant="secondary"
                  class="ml-1 px-1 py-0 text-[10px]"
                >
                  {{ detail.pendingFacts.length }}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="records">跨模块记录</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea class="flex-1 min-w-0 [&_[data-reka-scroll-area-viewport]>div]:!block">
            <!-- TAB 1: 主播手写档案 + 记忆片段 + 合号 -->
            <TabsContent
              value="profile"
              class="p-4 space-y-4 mt-0"
            >
              <div class="grid grid-cols-2 gap-2.5">
                <FormField
                  label="专属称呼"
                  description="中控台弹幕流优先显示，防改名失忆"
                  class="min-w-0"
                >
                  <Input
                    v-model="nickname"
                    placeholder="如：小张 / 狗哥"
                  />
                </FormField>
                <FormField
                  label="读音注音"
                  description="生僻字或外文 ID 念法"
                  class="min-w-0"
                >
                  <Input
                    v-model="pronunciation"
                    placeholder="如：读作 mì"
                  />
                </FormField>
              </div>

              <FormField
                label="生日（月 / 日，默认打码保护）"
                class="min-w-0"
              >
                <div
                  v-if="privacyMode"
                  class="h-8 rounded-md border border-dashed border-border bg-muted/40 px-3 flex items-center justify-between text-xs text-muted-foreground"
                >
                  <span>已开启防露屏模式：{{ detail.birthdayMonth ? '••月••日' : '未设置' }}</span>
                  <Button
                    size="xs"
                    variant="ghost"
                    @click="togglePrivacyMode"
                  >
                    临时关闭防露屏
                  </Button>
                </div>
                <div
                  v-else
                  class="grid grid-cols-2 gap-2"
                >
                  <Select v-model="birthdayMonth">
                    <SelectTrigger class="w-full">
                      <SelectValue placeholder="月" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">未设置</SelectItem>
                      <SelectItem
                        v-for="m in MONTHS"
                        :key="m"
                        :value="m"
                        >{{ m }}月</SelectItem
                      >
                    </SelectContent>
                  </Select>
                  <Select v-model="birthdayDay">
                    <SelectTrigger class="w-full">
                      <SelectValue placeholder="日" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">未设置</SelectItem>
                      <SelectItem
                        v-for="d in DAYS"
                        :key="d"
                        :value="d"
                        >{{ d }}日</SelectItem
                      >
                    </SelectContent>
                  </Select>
                </div>
              </FormField>

              <!-- 多条自定义纪念日 -->
              <div class="space-y-2 rounded-md border border-border bg-muted/20 p-3">
                <div class="text-xs font-semibold flex items-center gap-1.5">
                  <CalendarHeart class="size-3.5 text-primary" />
                  自定义纪念日（{{ anniversaries.length }}）
                </div>
                <div
                  v-if="anniversaries.length > 0"
                  class="space-y-1.5"
                >
                  <div
                    v-for="ann in anniversaries"
                    :key="ann.id"
                    class="rounded-md border border-border bg-card px-2.5 py-1.5 flex-between gap-2 text-xs"
                  >
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="font-medium truncate">{{ ann.title }}</span>
                      <span class="text-[11px] text-muted-foreground tabular-nums shrink-0">{{ ann.date }}</span>
                      <Badge
                        v-if="ann.repeatYearly"
                        variant="secondary"
                        class="text-[10px] shrink-0"
                      >
                        每年提醒
                      </Badge>
                    </div>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      class="text-muted-foreground hover:text-destructive shrink-0"
                      @click="removeAnniversary(ann.id)"
                    >
                      <Trash2 class="size-3" />
                    </Button>
                  </div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto_auto] gap-1.5 items-center">
                  <Input
                    v-model="newAnnTitle"
                    placeholder="纪念日名称（如：第一次听歌 / 首上舰长）"
                  />
                  <Input
                    v-model="newAnnDate"
                    type="date"
                  />
                  <label class="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer px-1">
                    <Checkbox
                      :model-value="newAnnRepeat"
                      @update:model-value="newAnnRepeat = Boolean($event)"
                    />
                    <span>每年</span>
                  </label>
                  <Button
                    variant="secondary"
                    @click="addAnniversary"
                  >
                    <Plus class="size-3.5 mr-1" />
                    添加
                  </Button>
                </div>
              </div>

              <FormField label="自定义标签">
                <div class="space-y-2">
                  <div class="flex gap-1.5">
                    <Input
                      v-model="newTag"
                      placeholder="输入标签回车添加（如：画师、老舰长、歌单党）"
                      @keyup.enter.prevent="addTag"
                    />
                    <Button
                      variant="secondary"
                      @click="addTag"
                    >
                      <Plus class="size-3.5 mr-1" />
                      添加
                    </Button>
                  </div>
                  <div
                    v-if="tags.length > 0"
                    class="flex flex-wrap gap-1.5"
                  >
                    <Badge
                      v-for="tag in tags"
                      :key="tag"
                      variant="secondary"
                      class="gap-1 pr-1"
                    >
                      {{ tag }}
                      <button
                        type="button"
                        class="hover:text-destructive"
                        @click="removeTag(tag)"
                      >
                        <X class="size-3" />
                      </button>
                    </Badge>
                  </div>
                </div>
              </FormField>

              <FormField
                label="忌讳 / 雷区提醒"
                description="设置后会在中控台卡片醒目提示"
              >
                <div
                  v-if="privacyMode"
                  class="h-8 rounded-md border border-dashed border-border bg-muted/40 px-3 flex items-center text-xs text-muted-foreground"
                >
                  {{ taboos ? '已开启防露屏遮罩（••••••）' : '未设置' }}
                </div>
                <Input
                  v-else
                  v-model="taboos"
                  placeholder="如：不喜欢被开年龄玩笑 / 不要公开念真名"
                />
              </FormField>

              <FormField label="自由备注">
                <div
                  v-if="privacyMode"
                  class="min-h-[72px] rounded-md border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground"
                >
                  {{ note ? '已开启防露屏遮罩，关闭防露屏后可查看与编辑备注' : '暂无备注' }}
                </div>
                <Textarea
                  v-else
                  v-model="note"
                  rows="4"
                  placeholder="记录这位粉丝的职业、爱好、舰礼偏好、聊过的话题等（AI 绝不会覆盖此区）"
                />
                <div class="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <ShieldCheck class="size-3 text-emerald-500 shrink-0" />
                  <span>仅主播控制台可见，绝不透出到 OBS 或公开主页；请勿在备注中填写手机号或家庭住址。</span>
                </div>
              </FormField>

              <div class="flex justify-end">
                <Button
                  :disabled="saving"
                  @click="handleSave"
                >
                  <Loader2
                    v-if="saving"
                    class="size-3.5 mr-1.5 animate-spin"
                  />
                  <Save
                    v-else
                    class="size-3.5 mr-1.5"
                  />
                  保存档案
                </Button>
              </div>

              <Separator />

              <!-- 一起经历的事（自动里程碑） -->
              <div
                v-if="detail.milestones && detail.milestones.length > 0"
                class="space-y-2"
              >
                <div class="flex-between">
                  <div class="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles class="size-3.5 text-primary" />
                    一起经历的事（{{ detail.milestones.length }}）
                  </div>
                  <Button
                    size="xs"
                    variant="ghost"
                    @click="bookletOpen = true"
                  >
                    生成纪念手册 →
                  </Button>
                </div>
                <div class="border-l-2 border-primary/30 pl-3 space-y-2">
                  <div
                    v-for="ms in detail.milestones"
                    :key="ms.key"
                    class="relative text-xs"
                  >
                    <span class="absolute -left-[17px] top-1.5 size-2 rounded-full bg-primary" />
                    <div class="flex-between gap-2">
                      <span class="font-medium text-foreground">{{ ms.title }}</span>
                      <span class="text-[11px] text-muted-foreground tabular-nums shrink-0">{{ ms.date.slice(0, 10) }}</span>
                    </div>
                    <p class="text-[11px] text-muted-foreground">{{ ms.detail }}</p>
                  </div>
                </div>
              </div>

              <Separator v-if="detail.milestones && detail.milestones.length > 0" />

              <!-- 收藏记忆片段 -->
              <div class="space-y-2.5">
                <div class="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <BookmarkPlus class="size-3.5 text-brand" />
                  记忆片段 / 名场面（{{ detail.memories.length }}）
                </div>
                <div class="flex gap-1.5">
                  <Input
                    v-model="memoryDraft"
                    placeholder="记一件值得记住的事或名场面..."
                    @keyup.enter.prevent="handleAddMemory"
                  />
                  <Button
                    variant="secondary"
                    :disabled="addingMemory || !memoryDraft.trim()"
                    @click="handleAddMemory"
                  >
                    记录
                  </Button>
                </div>
                <div
                  v-if="detail.memories.length > 0"
                  class="space-y-1.5"
                >
                  <div
                    v-for="m in detail.memories"
                    :key="m.id"
                    class="rounded-md border border-border bg-card p-2.5 flex items-start justify-between gap-2"
                  >
                    <div class="min-w-0 space-y-0.5">
                      <p class="text-xs text-foreground wrap-anywhere">{{ m.content }}</p>
                      <div class="text-[11px] text-muted-foreground tabular-nums">
                        {{ formatDate(m.createdAt) }}
                        <span v-if="m.context"> · {{ m.context }}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      class="text-muted-foreground hover:text-destructive shrink-0"
                      @click="handleDeleteMemory(m.id)"
                    >
                      <Trash2 class="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              <!-- 合并小号 / 关联 OpenId -->
              <div class="space-y-2">
                <div class="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <GitMerge class="size-3.5 text-muted-foreground" />
                  合号 / 关联小号与 OpenId
                </div>
                <p class="text-[11px] text-muted-foreground">
                  将同一位粉丝的小号 UID 或不同采集通道的 OpenId 合并到当前档案，ClickHouse 弹幕与统计将自动合并显示。
                </p>
                <div class="flex gap-1.5">
                  <Input
                    v-model="mergeInput"
                    placeholder="输入待合并的 B 站 UID 或 OpenId (UUID)"
                  />
                  <Button
                    variant="outline"
                    :disabled="merging || !mergeInput.trim()"
                    @click="handleMerge"
                  >
                    <Loader2
                      v-if="merging"
                      class="size-3.5 mr-1 animate-spin"
                    />
                    合并
                  </Button>
                </div>
                <div
                  v-if="detail.aliasOUIds.length > 0"
                  class="flex flex-wrap gap-1 pt-1"
                >
                  <Badge
                    v-for="alias in detail.aliasOUIds"
                    :key="alias"
                    variant="outline"
                    class="text-[11px] gap-1 font-mono"
                  >
                    <Link2 class="size-3" />
                    {{ alias.slice(0, 12) }}…
                  </Badge>
                </div>
              </div>
            </TabsContent>

            <!-- TAB 2: AI 画像 + 待确认情报 -->
            <TabsContent
              value="ai"
              class="p-4 space-y-4 mt-0"
            >
              <div class="rounded-lg border border-border bg-card p-3.5 space-y-3">
                <div class="flex-between gap-2">
                  <div class="text-xs font-semibold flex items-center gap-1.5">
                    <Sparkles class="size-4 text-brand" />
                    AI 粉丝画像
                  </div>
                  <span
                    v-if="detail.aiUpdatedAt"
                    class="text-[11px] text-muted-foreground tabular-nums"
                  >
                    更新于 {{ formatDate(detail.aiUpdatedAt) }}
                  </span>
                </div>

                <template v-if="detail.aiSummary">
                  <p class="text-xs text-foreground leading-relaxed wrap-anywhere">{{ detail.aiSummary }}</p>
                  <div
                    v-if="detail.aiStyle"
                    class="text-[11px] text-muted-foreground"
                  >
                    互动风格：<span class="text-foreground font-medium">{{ detail.aiStyle }}</span>
                  </div>
                  <div
                    v-if="detail.aiPersonaTags.length > 0"
                    class="flex flex-wrap gap-1.5"
                  >
                    <Badge
                      v-for="t in detail.aiPersonaTags"
                      :key="t"
                      variant="secondary"
                      class="text-[11px]"
                    >
                      {{ t }}
                    </Badge>
                  </div>
                  <div
                    v-if="detail.aiSharedMemes.length > 0"
                    class="space-y-1 pt-1 border-t border-border"
                  >
                    <div class="text-[11px] font-medium text-muted-foreground">共同梗 / 常聊话题</div>
                    <ul class="space-y-1 text-xs text-foreground list-disc pl-4">
                      <li
                        v-for="meme in detail.aiSharedMemes"
                        :key="meme"
                      >
                        {{ meme }}
                      </li>
                    </ul>
                  </div>
                </template>
                <Empty
                  v-else
                  description="尚未生成 AI 画像，点击右上角「AI 总结画像」即可基于本直播间历史数据自动归纳"
                />
              </div>

              <!-- 待确认候选情报 -->
              <div class="space-y-2.5">
                <div class="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <AlertTriangle class="size-3.5 text-amber-500" />
                  待确认 AI 候选情报（{{ detail.pendingFacts.length }}）
                </div>
                <p class="text-[11px] text-muted-foreground">
                  AI 从弹幕/SC 中挖掘出的疑似个人信息，点击「采纳」后才会正式写入你的手写档案。
                </p>

                <div
                  v-if="detail.pendingFacts.length > 0"
                  class="space-y-2"
                >
                  <div
                    v-for="fact in detail.pendingFacts"
                    :key="fact.id"
                    class="rounded-md border border-border bg-card p-3 space-y-1.5"
                  >
                    <div class="flex-between gap-2">
                      <div class="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          class="text-[11px]"
                        >
                          {{ fact.label || fact.kind }}
                        </Badge>
                        <span class="text-xs font-medium text-foreground">{{ fact.value }}</span>
                      </div>
                      <div class="flex items-center gap-1 shrink-0">
                        <Button
                          size="xs"
                          variant="secondary"
                          @click="handleResolveFact(fact.id, true)"
                        >
                          <Check class="size-3 mr-1" />
                          采纳
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          class="text-muted-foreground"
                          @click="handleResolveFact(fact.id, false)"
                        >
                          忽略
                        </Button>
                      </div>
                    </div>
                    <p
                      v-if="fact.evidence"
                      class="text-[11px] text-muted-foreground bg-muted/50 rounded px-2 py-1 wrap-anywhere"
                    >
                      原话：「{{ fact.evidence }}」
                    </p>
                  </div>
                </div>
                <Empty
                  v-else
                  description="暂无待审核的新情报"
                />
              </div>
            </TabsContent>

            <!-- TAB 3: 跨模块记录 -->
            <TabsContent
              value="records"
              class="p-4 space-y-4 mt-0"
            >
              <!-- 近 12 场互动趋势柱状图 -->
              <div
                v-if="trendBars.length > 0"
                class="rounded-lg border border-border bg-card p-3 space-y-2.5"
              >
                <div class="flex-between gap-2">
                  <div class="text-xs font-semibold flex items-center gap-1.5">
                    <BarChart3 class="size-3.5 text-primary" />
                    近 {{ trendBars.length }} 场互动趋势
                  </div>
                  <span class="text-[11px] text-muted-foreground tabular-nums">
                    累计参与 {{ detail.liveCount }} 场 · 共 {{ detail.interactCount }} 次互动
                  </span>
                </div>
                <div class="grid grid-flow-col auto-cols-fr gap-1.5 items-end pt-1">
                  <button
                    v-for="bar in trendBars"
                    :key="bar.liveId"
                    type="button"
                    class="flex flex-col items-center justify-end gap-1 group min-w-0"
                    :title="`${bar.title || '未命名直播'} (${bar.startDate.slice(0, 10)})\n互动 ${bar.interactCount} · 弹幕 ${bar.danmakuCount}${!privacyMode && bar.totalPrice > 0 ? ` · ¥${bar.totalPrice.toFixed(0)}` : ''}`"
                    @click="router.push({ name: 'manage-liveDetail', params: { id: bar.liveId } })"
                  >
                    <span class="text-[10px] leading-none text-muted-foreground tabular-nums opacity-75 group-hover:opacity-100">
                      {{ bar.val }}
                    </span>
                    <div class="w-full h-14 flex items-end justify-center">
                      <div
                        class="w-full max-w-[26px] rounded-t-sm bg-primary/70 group-hover:bg-primary transition-colors"
                        :style="{ height: `${bar.heightPct}%` }"
                      />
                    </div>
                    <span class="text-[9px] leading-none text-muted-foreground tabular-nums truncate w-full text-center">
                      {{ bar.shortDate }}
                    </span>
                  </button>
                </div>
              </div>

              <!-- 曾用名轨迹 -->
              <div
                v-if="detail.nameHistory.length > 0"
                class="space-y-1.5"
              >
                <div class="text-xs font-semibold flex items-center gap-1.5">
                  <History class="size-3.5 text-muted-foreground" />
                  曾用名轨迹
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <Badge
                    v-for="n in detail.nameHistory"
                    :key="n"
                    variant="outline"
                    class="text-[11px]"
                  >
                    {{ n }}
                  </Badge>
                </div>
              </div>

              <!-- ClickHouse 历史弹幕明细 -->
              <div class="space-y-2">
                <div class="flex-between gap-2">
                  <div class="text-xs font-semibold flex items-center gap-1.5">
                    <MessageSquare class="size-3.5 text-brand" />
                    历史互动明细
                  </div>
                  <Select v-model="dmFilterType">
                    <SelectTrigger class="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部类型</SelectItem>
                      <SelectItem :value="String(EventDataTypes.Message)">弹幕</SelectItem>
                      <SelectItem :value="String(EventDataTypes.SC)">醒目留言</SelectItem>
                      <SelectItem :value="String(EventDataTypes.Gift)">礼物</SelectItem>
                      <SelectItem :value="String(EventDataTypes.Guard)">大航海</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div
                  v-if="dmList.length > 0"
                  class="rounded-md border border-border divide-y divide-border max-h-[280px] overflow-y-auto scrollbar-thin"
                >
                  <div
                    v-for="(dm, idx) in dmList"
                    :key="`${dm.time}-${idx}`"
                    class="px-2.5 py-1.5 text-xs flex items-start gap-2"
                  >
                    <Badge
                      variant="secondary"
                      class="text-[10px] shrink-0 mt-0.5"
                    >
                      {{ eventTypeLabel(dm.type) }}
                    </Badge>
                    <div class="min-w-0 flex-1">
                      <span class="text-foreground wrap-anywhere">{{ dm.message || (dm.mysteryBoxName ? `盲盒 ${dm.mysteryBoxName}` : '-') }}</span>
                      <span
                        v-if="dm.price > 0"
                        class="ml-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 tabular-nums"
                      >
                        {{ formatPrice(dm.price) }}
                      </span>
                    </div>
                    <span class="text-[11px] text-muted-foreground shrink-0 tabular-nums">{{ formatDate(dm.time) }}</span>
                  </div>
                </div>
                <Button
                  v-if="dmHasMore"
                  variant="outline"
                  size="xs"
                  class="w-full"
                  :disabled="dmLoading"
                  @click="loadDanmakus(false)"
                >
                  {{ dmLoading ? '加载中...' : '加载更多历史弹幕' }}
                </Button>
              </div>

              <!-- 参与场次 -->
              <div
                v-if="detail.recentLives.length > 0"
                class="space-y-1.5"
              >
                <div class="text-xs font-semibold flex items-center gap-1.5">
                  <Gift class="size-3.5 text-muted-foreground" />
                  近期参与场次（{{ detail.recentLives.length }}）
                </div>
                <div class="rounded-md border border-border divide-y divide-border">
                  <button
                    v-for="live in detail.recentLives.slice(0, 12)"
                    :key="live.liveId"
                    type="button"
                    class="w-full text-left px-2.5 py-2 list-item-interactive flex-between gap-2 text-xs"
                    @click="router.push({ name: 'manage-liveDetail', params: { id: live.liveId } })"
                  >
                    <div class="min-w-0">
                      <div class="font-medium truncate">{{ live.title || '未命名直播' }}</div>
                      <div class="text-[11px] text-muted-foreground tabular-nums">{{ formatDate(live.startDate) }}</div>
                    </div>
                    <div class="text-right text-[11px] text-muted-foreground shrink-0 tabular-nums">
                      <div>弹幕 {{ live.danmakuCount }} · 互动 {{ live.interactCount }}</div>
                      <div
                        v-if="live.totalPrice > 0"
                        class="text-amber-600 dark:text-amber-400 font-medium"
                      >
                        {{ formatPrice(live.totalPrice) }}
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <!-- 点歌偏好 -->
              <div
                v-if="detail.recentSongRequests.length > 0"
                class="space-y-1.5"
              >
                <div class="text-xs font-semibold flex items-center gap-1.5">
                  <Music class="size-3.5 text-muted-foreground" />
                  点歌记录（{{ detail.recentSongRequests.length }}）
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <Badge
                    v-for="s in detail.recentSongRequests.slice(0, 15)"
                    :key="s.id"
                    variant="secondary"
                    class="text-[11px]"
                  >
                    {{ s.songName }}
                  </Badge>
                </div>
              </div>

              <!-- 商城订单 -->
              <div
                v-if="detail.recentOrders.length > 0"
                class="space-y-1.5"
              >
                <div class="text-xs font-semibold flex items-center gap-1.5">
                  <ShoppingBag class="size-3.5 text-muted-foreground" />
                  商城兑换 / 舰礼订单（{{ detail.recentOrders.length }}）
                </div>
                <div class="rounded-md border border-border divide-y divide-border">
                  <div
                    v-for="o in detail.recentOrders"
                    :key="o.id"
                    class="px-2.5 py-1.5 text-xs flex-between gap-2"
                  >
                    <div class="min-w-0">
                      <span class="font-medium">{{ o.goodsName }} ×{{ o.count }}</span>
                      <p
                        v-if="o.remark"
                        class="text-[11px] text-muted-foreground truncate"
                      >
                        备注：{{ o.remark }}
                      </p>
                    </div>
                    <span class="text-[11px] text-muted-foreground shrink-0 tabular-nums">{{ formatDate(o.createdAt) }}</span>
                  </div>
                </div>
              </div>

              <!-- 非匿名提问箱 -->
              <div
                v-if="detail.recentQAs.length > 0"
                class="space-y-1.5"
              >
                <div class="text-xs font-semibold flex items-center gap-1.5">
                  <Heart class="size-3.5 text-muted-foreground" />
                  非匿名提问箱记录（{{ detail.recentQAs.length }}）
                </div>
                <div class="space-y-1.5">
                  <div
                    v-for="q in detail.recentQAs"
                    :key="q.id"
                    class="rounded-md border border-border bg-card p-2.5 text-xs space-y-1"
                  >
                    <p class="text-foreground wrap-anywhere">Q: {{ q.question }}</p>
                    <p
                      v-if="q.answer"
                      class="text-muted-foreground wrap-anywhere"
                    >
                      A: {{ q.answer }}
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>
    </SheetContent>
  </Sheet>

  <FanMemoryBookletDialog
    v-if="detail"
    v-model:open="bookletOpen"
    :detail="detail"
  />
</template>
