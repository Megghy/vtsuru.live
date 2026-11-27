<script setup lang="ts">
import { useIntervalFn, useNow, watchDebounced } from '@vueuse/core'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  RotateCcw,
  User,
  Video,
} from 'lucide-vue-next'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { ReponseVideoCollectVideo, RequestAddVideo, ResponseVideoCollectModel } from '@/api/generated/model'
import { DuplicateVideoPolicy, VideoStatus } from '@/api/generated/model'
import { getApiVideoCollectGet, postApiVideoCollectAdd } from '@/api/generated/video-collect/video-collect'
import {
  fetchMyVideoCollectSubmissions,
  type ResolvedVideoPreview,
  resolveVideoCollectVideo,
  withdrawMyVideoCollectSubmission,
} from '@/api/video-collect-extra'
import CaptchaWidget from '@/apps/user/components/CaptchaWidget.vue'
import { refreshCaptcha, requestWithCaptchaRetry } from '@/shared/captcha'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Progress } from '@/shared/ui/progress'
import { Skeleton } from '@/shared/ui/skeleton'
import { Textarea } from '@/shared/ui/textarea'
import { toast } from '@/shared/utils'
import {
  buildBiliVideoUrl,
  formatDurationLimitText,
  formatVideoDuration,
  getVideoCollectLifecycleLabel,
  getVideoCollectLifecycleState,
  isValidBiliVideoInput,
  normalizeBiliCoverUrl,
  normalizeTimestamp,
} from '@/shared/utils/videoCollect'
import { useBiliAuth } from '@/store/useBiliAuth'

import VideoCollectPageShell from './VideoCollectPageShell.vue'

const route = useRoute()
const router = useRouter()
const biliAuth = useBiliAuth()
const now = useNow({ scheduler: (cb) => useIntervalFn(cb, 1000) })

const table = ref<ResponseVideoCollectModel | null | undefined>()
const turnstile = ref<InstanceType<typeof CaptchaWidget>>()
const token = ref('')
const isLoading = ref(false)
const isPageLoading = ref(false)
const submitted = ref(false)

const addModel = ref<RequestAddVideo>({
  id: '',
  video: '',
  name: '',
  uId: undefined,
  description: '',
})

// 视频预解析状态
const previewLoading = ref(false)
const videoPreview = ref<ResolvedVideoPreview | null>(null)
const previewError = ref<string | null>(null)
let previewAbort: AbortController | null = null
let tableLoadSeq = 0

// 已绑定 B 站用户的历史投稿
const mySubmissions = ref<ReponseVideoCollectVideo[]>([])
const loadingMySubmissions = ref(false)
const withdrawingBvid = ref<string | null>(null)

const isBiliAuthed = computed(() => biliAuth.isAuthed && Boolean(biliAuth.biliAuth?.userId))
const lifecycle = computed(() =>
  table.value ? getVideoCollectLifecycleState(table.value, now.value.getTime()) : 'finished',
)
const isClosed = computed(() => !table.value || lifecycle.value === 'finished')
const isNotStarted = computed(() => lifecycle.value === 'upcoming')
const isFull = computed(() => lifecycle.value === 'full')
const collectionStatus = computed(() => getVideoCollectLifecycleLabel(lifecycle.value))
const requiresIdentityForGuest = computed(() => Boolean(table.value && table.value.maxVideoPerUser > 0))

const countdownLabel = computed(() => {
  if (!table.value || isClosed.value || isFull.value) return ''

  const target = normalizeTimestamp(isNotStarted.value ? table.value.startAt : table.value.endAt)
  const totalSeconds = Math.max(0, Math.ceil((target - now.value.getTime()) / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)

  if (days > 0) return `${isNotStarted.value ? '距开始' : '距截止'}还有 ${days} 天${hours ? ` ${hours} 小时` : ''}`

  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${isNotStarted.value ? '距开始' : '距截止'}还有 ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})

const capacityPercentage = computed(() => {
  if (!table.value || !table.value.maxVideoCount) return 0
  return Math.min(100, Math.round((table.value.videoCount / table.value.maxVideoCount) * 100))
})

const submissionRequirements = computed(() => {
  if (!table.value) return []

  const requirements: string[] = []
  const minSec = table.value.minVideoDuration || 0
  const maxSec = table.value.maxVideoDuration || 0

  if (minSec > 0 && maxSec > 0) {
    requirements.push(`视频时长 ${formatDurationLimitText(minSec)} – ${formatDurationLimitText(maxSec)}`)
  } else if (minSec > 0) {
    requirements.push(`视频时长不少于 ${formatDurationLimitText(minSec)}`)
  } else if (maxSec > 0) {
    requirements.push(`视频时长不超过 ${formatDurationLimitText(maxSec)}`)
  }

  if (table.value.maxVideoPerUser) requirements.push(`每人最多投稿 ${table.value.maxVideoPerUser} 个视频`)
  if (table.value.requireDescription) requirements.push('需要填写推荐理由')
  requirements.push(
    table.value.duplicatePolicy === DuplicateVideoPolicy.Reject ? '同一视频请勿重复投稿' : '重复推荐将合并记录',
  )
  if (table.value.allowedPartitions.length) {
    requirements.push(`仅接受 ${table.value.allowedPartitions.join('、')} 分区`)
  }

  return requirements
})

function formatDateTime(ts: number) {
  try {
    return new Date(normalizeTimestamp(ts)).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(ts)
  }
}

function currentId() {
  const id = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
  if (!id) throw new Error('缺少征集 ID')
  return id
}

async function getBiliAuthHeaderRecord(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {}
  if (isBiliAuthed.value) {
    const authHeaders = await biliAuth.getBiliAuthHeaders()
    for (const [k, v] of authHeaders) {
      headers[k] = v
    }
  }
  return headers
}

async function loadTable() {
  const seq = ++tableLoadSeq
  isPageLoading.value = true
  try {
    const response = await getApiVideoCollectGet({ id: currentId() })
    if (seq !== tableLoadSeq) return
    table.value =
      response.code === 200
        ? { ...response.data.table, allowedPartitions: [...(response.data.table.allowedPartitions ?? [])] }
        : null
    if (response.code !== 200 && response.code !== 404) throw new Error(response.message)
    if (table.value && isBiliAuthed.value) {
      void loadMySubmissions()
    }
  } catch (error) {
    if (seq !== tableLoadSeq) return
    console.error('获取视频征集失败', error)
    table.value = null
    toast.error(error instanceof Error ? error.message : '获取失败')
  } finally {
    if (seq === tableLoadSeq) isPageLoading.value = false
  }
}

async function loadMySubmissions() {
  if (!isBiliAuthed.value || !table.value) {
    mySubmissions.value = []
    return
  }
  loadingMySubmissions.value = true
  try {
    const headers = await getBiliAuthHeaderRecord()
    mySubmissions.value = await fetchMyVideoCollectSubmissions(table.value.id, headers)
  } catch {
    // 静默降级
  } finally {
    loadingMySubmissions.value = false
  }
}

async function handleWithdraw(bvid?: string | null) {
  if (!bvid || !table.value) return
  withdrawingBvid.value = bvid
  try {
    const headers = await getBiliAuthHeaderRecord()
    await withdrawMyVideoCollectSubmission(table.value.id, bvid, headers)
    toast.success('已撤回该推荐')
    await Promise.all([loadTable(), loadMySubmissions()])
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '撤回失败')
  } finally {
    withdrawingBvid.value = null
  }
}

async function previewVideoInput(raw: string) {
  previewAbort?.abort()
  previewAbort = null
  const trimmed = raw.trim()
  if (!trimmed || !isValidBiliVideoInput(trimmed)) {
    videoPreview.value = null
    previewError.value = null
    previewLoading.value = false
    return
  }

  const controller = new AbortController()
  previewAbort = controller
  previewLoading.value = true
  previewError.value = null
  try {
    const result = await resolveVideoCollectVideo(trimmed, table.value?.id, controller.signal)
    if (controller.signal.aborted) return
    videoPreview.value = result
  } catch (error) {
    if (controller.signal.aborted) return
    videoPreview.value = null
    previewError.value = error instanceof Error ? error.message : '无法解析视频信息'
  } finally {
    if (!controller.signal.aborted) previewLoading.value = false
  }
}

void loadTable()
watch(() => route.params.id, () => void loadTable())
watch(
  () => biliAuth.biliAuth,
  (auth) => {
    if (!auth?.userId) return
    addModel.value.name = auth.name
    addModel.value.uId = Number(auth.userId)
    if (table.value) void loadMySubmissions()
  },
  { immediate: true },
)

watchDebounced(
  () => addModel.value.video,
  (val) => {
    void previewVideoInput(val ?? '')
  },
  { debounce: 450 },
)

async function addVideo() {
  const rawVideo = addModel.value.video?.trim() ?? ''
  if (!isValidBiliVideoInput(rawVideo)) {
    toast.error('请输入有效的哔哩哔哩视频链接、BV 号、AV 号或 b23.tv 短链')
    return
  }
  if (videoPreview.value && !videoPreview.value.eligible && videoPreview.value.ruleError) {
    toast.error(videoPreview.value.ruleError)
    return
  }
  if (
    !isBiliAuthed.value &&
    requiresIdentityForGuest.value &&
    !addModel.value.name?.trim() &&
    !(addModel.value.uId && addModel.value.uId > 0)
  ) {
    toast.error('此征集限制每人投稿数量，请至少填写推荐人昵称或 B 站 UID')
    return
  }
  if (!isBiliAuthed.value && addModel.value.uId != null && addModel.value.uId <= 0) {
    toast.error('B 站 UID 必须为正整数')
    return
  }
  if (table.value?.requireDescription && !addModel.value.description?.trim()) {
    toast.error('请填写推荐理由')
    return
  }
  if (!token.value) {
    toast.warning('请完成人机验证')
    return
  }

  isLoading.value = true
  const payload: RequestAddVideo = {
    id: table.value?.id ?? currentId(),
    video: rawVideo,
    name: addModel.value.name?.trim() || undefined,
    uId: addModel.value.uId ?? undefined,
    description: addModel.value.description?.trim() || undefined,
  }

  try {
    const response = await requestWithCaptchaRetry({
      getToken: () => token.value,
      refresh: () => refreshCaptcha(turnstile.value),
      request: async (captchaToken) => {
        const headers: Record<string, string> = {
          ...(await getBiliAuthHeaderRecord()),
          Turnstile: captchaToken,
        }
        return postApiVideoCollectAdd(payload, { headers })
      },
    })
    if (response.code !== 200) throw new Error(response.message)

    submitted.value = true
    addModel.value.video = ''
    addModel.value.description = ''
    videoPreview.value = null
    previewError.value = null
    await Promise.all([loadTable(), loadMySubmissions()])
  } catch (error) {
    console.error('推荐视频失败', error)
    toast.error(error instanceof Error ? error.message : '推荐失败')
  } finally {
    isLoading.value = false
    turnstile.value?.reset()
  }
}

function submitAnother() {
  submitted.value = false
}

function submissionStatusLabel(status: VideoStatus) {
  if (status === VideoStatus.Accepted) return '已通过'
  if (status === VideoStatus.Rejected) return '已拒绝'
  return '待审核'
}

function submissionStatusVariant(status: VideoStatus) {
  if (status === VideoStatus.Accepted) return 'success' as const
  if (status === VideoStatus.Rejected) return 'destructive' as const
  return 'secondary' as const
}

onUnmounted(() => {
  previewAbort?.abort()
  turnstile.value?.remove()
})
</script>

<template>
  <VideoCollectPageShell :table="table">
    <template #default>
      <main class="grid min-h-screen min-h-[100svh] py-8 px-4 box-border place-items-center">
        <!-- 加载骨架 -->
        <div
          v-if="isPageLoading && table === undefined"
          class="w-[min(100%,1040px)] grid grid-cols-1 md:grid-cols-2 gap-8"
        >
          <div class="space-y-4">
            <Skeleton class="h-6 w-40" />
            <Skeleton class="h-10 w-3/4" />
            <Skeleton class="h-28 w-full rounded-xl" />
          </div>
          <Skeleton class="h-96 w-full rounded-xl" />
        </div>

        <div
          v-else-if="table === null && !isPageLoading"
          class="text-center py-20 space-y-3"
        >
          <h2 class="text-2xl font-bold">视频征集不存在</h2>
          <p class="text-sm text-muted-foreground">链接可能有误，或该征集已被删除。</p>
          <Button
            variant="outline"
            @click="router.push({ name: 'index' })"
          >
            返回首页
          </Button>
        </div>

        <div
          v-else-if="table"
          class="grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] max-[768px]:grid-cols-1 max-[768px]:gap-6 gap-[clamp(24px,5vw,64px)] items-start w-[min(100%,1040px)] max-w-[var(--vtsuru-page-max-width,1040px)] min-w-0"
        >
          <section class="min-w-0 space-y-5">
            <div class="min-w-0">
              <Button
                variant="link"
                size="xs"
                class="owner-link h-auto p-0 flex items-center gap-1.5 text-muted-foreground hover:text-foreground font-normal"
                @click="router.push({ name: 'user-index', params: { id: table.owner.name } })"
              >
                <User class="size-3.5" />
                <span>{{ table.owner.name }} 的视频征集</span>
              </Button>
              <div class="collect-title-row flex items-center flex-wrap gap-2.5 mt-2">
                <h1 class="text-2xl font-bold tracking-tight min-w-0 break-words">{{ table.name }}</h1>
                <Badge :variant="lifecycle === 'active' ? 'default' : 'secondary'">
                  {{ collectionStatus }}
                </Badge>
              </div>
              <p class="collect-description text-sm text-muted-foreground mt-2.5 leading-relaxed break-words">
                {{ table.description || '未填写征集说明' }}
              </p>
            </div>

            <div class="collect-meta grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl border border-border bg-card text-xs">
              <div class="space-y-1 min-w-0">
                <div class="flex items-center gap-1.5 text-muted-foreground">
                  <Clock class="size-3.5 shrink-0" />
                  <span>开放时间</span>
                </div>
                <div class="font-medium font-mono tabular-nums text-foreground">
                  {{ formatDateTime(table.startAt) }}
                </div>
                <div
                  v-if="isNotStarted && countdownLabel"
                  class="collect-countdown text-[11px] text-primary"
                >
                  {{ countdownLabel }}
                </div>
              </div>
              <div class="space-y-1 min-w-0">
                <div class="flex items-center gap-1.5 text-muted-foreground">
                  <Clock class="size-3.5 shrink-0" />
                  <span>截止时间</span>
                </div>
                <div class="font-medium font-mono tabular-nums text-foreground">
                  {{ formatDateTime(table.endAt) }}
                </div>
                <div
                  v-if="!isNotStarted && countdownLabel"
                  class="collect-countdown text-[11px] text-primary"
                >
                  {{ countdownLabel }}
                </div>
              </div>
              <div class="space-y-1 min-w-0">
                <div class="flex items-center gap-1.5 text-muted-foreground">
                  <Video class="size-3.5 shrink-0" />
                  <span>已收集</span>
                </div>
                <div class="font-medium font-mono tabular-nums text-foreground">
                  {{ table.videoCount }} / {{ table.maxVideoCount }}
                </div>
              </div>
            </div>

            <Progress :model-value="capacityPercentage" />

            <!-- 我的投稿状态（已绑定 B 站账号时展示） -->
            <Card
              v-if="isBiliAuthed && (mySubmissions.length > 0 || loadingMySubmissions)"
              class="min-w-0"
            >
              <CardContent class="p-4 space-y-2.5">
                <div class="flex-between gap-2 flex-wrap text-xs">
                  <span class="font-semibold text-foreground">我的投稿记录 ({{ mySubmissions.length }})</span>
                  <div class="flex items-center gap-3">
                    <Button
                      variant="link"
                      size="none"
                      class="text-xs text-primary"
                      @click="router.push({ name: 'bili-user-video-collect' })"
                    >
                      全部投稿记录
                    </Button>
                    <Button
                      variant="link"
                      size="none"
                      class="text-xs text-muted-foreground hover:text-foreground"
                      @click="router.push({ name: 'video-collect-list', params: { id: table.shortId } })"
                    >
                      已通过展示页
                    </Button>
                  </div>
                </div>

                <div
                  v-if="loadingMySubmissions && mySubmissions.length === 0"
                  class="space-y-2"
                >
                  <Skeleton class="h-12 w-full rounded-md" />
                </div>

                <div
                  v-else
                  class="space-y-2 max-h-60 overflow-y-auto scrollbar-thin pr-1"
                >
                  <div
                    v-for="item in mySubmissions"
                    :key="item.info.bvid"
                    class="flex items-center gap-2.5 p-2 rounded-md border border-border bg-muted/20 text-xs"
                  >
                    <img
                      v-if="item.video.cover"
                      :src="normalizeBiliCoverUrl(item.video.cover)"
                      :alt="item.video.title"
                      referrerpolicy="no-referrer"
                      class="w-16 aspect-video rounded-sm object-cover shrink-0 bg-muted"
                    />
                    <div class="min-w-0 flex-1 space-y-0.5">
                      <div class="flex items-center gap-1.5 min-w-0">
                        <Badge
                          :variant="submissionStatusVariant(item.info.status)"
                          size="xs"
                          class="shrink-0"
                        >
                          {{ submissionStatusLabel(item.info.status) }}
                        </Badge>
                        <a
                          :href="buildBiliVideoUrl(item.info.bvid, item.info.page)"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="font-medium text-foreground hover:text-primary truncate"
                        >
                          {{ item.video.title }}
                        </a>
                      </div>
                      <div
                        v-if="item.info.status === VideoStatus.Rejected && item.info.rejectReason"
                        class="text-[11px] text-destructive"
                      >
                        拒绝理由：{{ item.info.rejectReason }}
                      </div>
                    </div>

                    <Popconfirm
                      v-if="item.info.status === VideoStatus.Pending"
                      title="撤回该推荐？"
                      positive-text="撤回"
                      negative-text="取消"
                      @positive-click="handleWithdraw(item.info.bvid)"
                    >
                      <template #trigger>
                        <Button
                          size="xs"
                          variant="ghost"
                          class="text-muted-foreground hover:text-destructive shrink-0"
                          :loading="withdrawingBvid === item.info.bvid"
                        >
                          <RotateCcw class="size-3 mr-1" />
                          撤回
                        </Button>
                      </template>
                      撤回后可重新提交其他视频，确定撤回吗？
                    </Popconfirm>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <Card class="min-w-0 collect-on-surface w-full">
            <CardContent class="p-4 sm:p-6">
              <div
                v-if="submitted"
                class="py-8 flex flex-col items-center text-center gap-3"
              >
                <div class="size-12 rounded-full bg-emerald-500/10 text-emerald-500 flex-center">
                  <CheckCircle2 class="size-7" />
                </div>
                <h3 class="text-lg font-semibold">推荐成功</h3>
                <p class="text-xs text-muted-foreground">你的视频推荐已提交，等待主播审核后展示。</p>
                <div class="flex items-center gap-2 mt-2">
                  <Button @click="submitAnother">再推荐一个</Button>
                  <Button
                    variant="outline"
                    @click="router.push({ name: 'video-collect-list', params: { id: table.shortId } })"
                  >
                    查看展示页
                  </Button>
                </div>
              </div>

              <div
                v-else-if="isClosed"
                class="py-8 flex flex-col items-center text-center gap-3"
              >
                <h3 class="text-base font-semibold">征集已结束</h3>
                <p class="text-xs text-muted-foreground">当前不再接收新的视频推荐。</p>
                <Button
                  variant="outline"
                  @click="router.push({ name: 'video-collect-list', params: { id: table.shortId } })"
                >
                  查看征集结果
                </Button>
              </div>

              <div
                v-else-if="isNotStarted"
                class="py-8 flex flex-col items-center text-center gap-2"
              >
                <h3 class="text-base font-semibold">征集尚未开始</h3>
                <p class="text-xs text-muted-foreground">开放时间：{{ formatDateTime(table.startAt) }}</p>
              </div>

              <div
                v-else-if="isFull"
                class="py-8 flex flex-col items-center text-center gap-3"
              >
                <h3 class="text-base font-semibold">投稿名额已满</h3>
                <p class="text-xs text-muted-foreground">当前暂时无法提交新的视频。</p>
                <Button
                  variant="outline"
                  @click="router.push({ name: 'video-collect-list', params: { id: table.shortId } })"
                >
                  查看征集结果
                </Button>
              </div>

              <div
                v-else-if="!table.allowUnregisteredUser && !isBiliAuthed"
                class="py-8 flex flex-col items-center text-center gap-3"
              >
                <h3 class="text-base font-semibold">需要绑定 B 站账号</h3>
                <p class="text-xs text-muted-foreground">完成身份绑定后即可参与本次视频征集，认证完将自动返回此页。</p>
                <Button @click="router.push({ name: 'bili-auth', query: { redirect: route.fullPath } })">前往绑定</Button>
              </div>

              <form
                v-else
                class="space-y-4"
                @submit.prevent="addVideo"
              >
                <div class="submit-panel__heading flex items-start gap-2.5 pb-2 border-b border-border/60">
                  <CheckCircle2 class="size-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h2 class="text-sm font-semibold">推荐视频</h2>
                    <p class="text-xs text-muted-foreground">
                      {{ !isBiliAuthed && table.allowUnregisteredUser ? '无需登录也可投稿' : '支持 B 站完整链接、BV/AV 号与 b23.tv 短链' }}
                    </p>
                  </div>
                </div>

                <ul
                  class="submit-requirements text-xs space-y-1 text-muted-foreground list-disc list-inside p-2.5 rounded bg-muted/40"
                  aria-label="投稿要求"
                >
                  <li
                    v-for="requirement in submissionRequirements"
                    :key="requirement"
                  >
                    {{ requirement }}
                  </li>
                </ul>

                <FormField
                  label="视频链接 / BV 号 / 短链"
                  description="支持粘贴分 P 链接（?p=N）或 b23.tv 短链"
                  required
                >
                  <Input
                    v-model="addModel.video"
                    placeholder="https://www.bilibili.com/video/BV... 或 b23.tv/..."
                    size="default"
                  />
                </FormField>

                <!-- 实时视频预览卡 -->
                <div
                  v-if="previewLoading"
                  class="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-muted/30 text-xs text-muted-foreground"
                >
                  <Loader2 class="size-4 animate-spin shrink-0" />
                  <span>正在解析视频信息并校验规则...</span>
                </div>

                <div
                  v-else-if="previewError"
                  class="flex items-start gap-2 p-2.5 rounded-lg border border-destructive/40 bg-destructive/10 text-xs text-destructive"
                >
                  <AlertCircle class="size-4 shrink-0 mt-0.5" />
                  <span>{{ previewError }}</span>
                </div>

                <div
                  v-else-if="videoPreview"
                  class="p-2.5 rounded-lg border bg-muted/20 space-y-2"
                  :class="videoPreview.eligible ? 'border-emerald-500/40' : 'border-destructive/50'"
                >
                  <div class="flex gap-2.5 items-start">
                    <img
                      v-if="videoPreview.video.cover"
                      :src="normalizeBiliCoverUrl(videoPreview.video.cover)"
                      :alt="videoPreview.video.title"
                      referrerpolicy="no-referrer"
                      class="w-24 aspect-video rounded object-cover shrink-0 bg-muted"
                    />
                    <div class="min-w-0 flex-1 space-y-1 text-xs">
                      <a
                        :href="buildBiliVideoUrl(videoPreview.video.id, videoPreview.page)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="font-medium text-foreground hover:text-primary line-clamp-2 inline-flex items-start gap-1"
                      >
                        <span class="min-w-0">{{ videoPreview.video.title }}</span>
                        <ExternalLink class="size-3 shrink-0 mt-0.5 opacity-60" />
                      </a>
                      <div class="flex items-center flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                        <span>UP: {{ videoPreview.video.ownerName }}</span>
                        <span class="font-mono tabular-nums">{{ formatVideoDuration(videoPreview.video.length) }}</span>
                        <Badge
                          v-if="videoPreview.video.partitionName"
                          variant="outline"
                          size="xs"
                        >
                          {{ videoPreview.video.partitionName }}
                        </Badge>
                        <Badge
                          v-if="videoPreview.page > 1"
                          variant="secondary"
                          size="xs"
                        >
                          P{{ videoPreview.page }} / {{ videoPreview.pageCount }}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div
                    v-if="!videoPreview.eligible && videoPreview.ruleError"
                    class="flex items-start gap-1.5 text-[11px] text-destructive bg-destructive/10 px-2 py-1 rounded"
                  >
                    <AlertCircle class="size-3.5 shrink-0 mt-0.5" />
                    <span>{{ videoPreview.ruleError }}</span>
                  </div>
                  <div
                    v-else-if="videoPreview.alreadyExists"
                    class="text-[11px] text-muted-foreground bg-muted/60 px-2 py-1 rounded"
                  >
                    已有其他观众推荐过该视频，提交后将合并记录你的推荐理由。
                  </div>
                </div>

                <div
                  v-if="isBiliAuthed"
                  class="authenticated-user flex items-center gap-1.5 text-xs text-primary font-medium p-2 rounded bg-primary/5 border border-primary/20"
                >
                  <CheckCircle2 class="size-4 shrink-0" />
                  <span class="truncate">以 {{ addModel.name }}（UID {{ addModel.uId }}）推荐</span>
                </div>
                <div
                  v-else
                  class="identity-fields grid grid-cols-1 sm:grid-cols-2 gap-3"
                >
                  <FormField
                    :label="requiresIdentityForGuest ? '推荐人（与 UID 至少填一项）' : '推荐人'"
                    class="min-w-0"
                  >
                    <Input
                      v-model="addModel.name"
                      :placeholder="requiresIdentityForGuest ? '请填写昵称' : '选填'"
                      maxlength="50"
                      size="default"
                    />
                  </FormField>
                  <FormField
                    label="哔哩哔哩 UID"
                    class="min-w-0"
                  >
                    <NumberField
                      :model-value="addModel.uId != null ? String(addModel.uId) : ''"
                      :placeholder="requiresIdentityForGuest ? '或填写 UID' : '选填'"
                      size="default"
                      :min="1"
                      :show-buttons="false"
                      @update:model-value="addModel.uId = $event ? Number($event) : undefined"
                    />
                  </FormField>
                </div>

                <FormField
                  :label="table.requireDescription ? '推荐理由' : '推荐理由（选填）'"
                  :required="table.requireDescription"
                  :extra="`${(addModel.description ?? '').length}/200`"
                >
                  <Textarea
                    v-model="addModel.description"
                    :placeholder="table.requireDescription ? '请说明推荐这个视频的原因' : '可补充推荐原因或看点'"
                    maxlength="200"
                    rows="3"
                  />
                </FormField>

                <div class="turnstile flex justify-center py-1 overflow-x-auto max-w-full">
                  <CaptchaWidget
                    ref="turnstile"
                    v-model="token"
                  />
                </div>

                <Button
                  type="submit"
                  class="w-full"
                  :disabled="isLoading || !token || Boolean(videoPreview && !videoPreview.eligible)"
                >
                  {{ isLoading ? '提交中...' : '提交推荐' }}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </template>
  </VideoCollectPageShell>
</template>
