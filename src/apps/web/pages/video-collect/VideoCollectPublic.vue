<script setup lang="ts">
import { CheckmarkCircle24Regular, Clock24Regular, Person24Regular, Video24Regular } from '@vicons/fluent'
import { useNow } from '@vueuse/core'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { VideoCollectDetail, VideoCollectTable } from '@/api/api-models'
import { DuplicateVideoPolicy } from '@/api/api-models'
import { getApiVideoCollectGet, postApiVideoCollectAdd } from '@/api/generated/video-collect/video-collect'
import CaptchaWidget from '@/apps/user/components/CaptchaWidget.vue'
import { refreshCaptcha, requestWithCaptchaRetry } from '@/shared/captcha'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Progress } from '@/shared/ui/progress'
import { Textarea } from '@/shared/ui/textarea'
import { toast } from '@/shared/utils'
import { useBiliAuth } from '@/store/useBiliAuth'

import VideoCollectPageShell from './VideoCollectPageShell.vue'

interface AddVideoModel {
  id: string
  video: string
  name?: string
  uid?: number
  description?: string
}

const route = useRoute()
const router = useRouter()
const biliAuth = useBiliAuth()
const now = useNow({ interval: 1000 })

const table = ref<VideoCollectTable | null>()
const turnstile = ref<InstanceType<typeof CaptchaWidget>>()
const token = ref('')
const isLoading = ref(false)
const isPageLoading = ref(false)
const submitted = ref(false)
const addModel = ref<AddVideoModel>({ id: '', video: '' })

const isBiliAuthed = computed(() => biliAuth.isAuthed && Boolean(biliAuth.biliAuth?.userId))
const isClosed = computed(() => !table.value || table.value.isFinish || table.value.endAt <= now.value.getTime())
const isNotStarted = computed(() => Boolean(table.value && table.value.startAt > now.value.getTime()))
const isFull = computed(() => Boolean(table.value && table.value.videoCount >= table.value.maxVideoCount))
const collectionStatus = computed(() => {
  if (isClosed.value) return '已结束'
  if (isNotStarted.value) return '未开始'
  if (isFull.value) return '名额已满'
  return '进行中'
})
const countdownLabel = computed(() => {
  if (!table.value || isClosed.value || isFull.value) return ''

  const target = isNotStarted.value ? table.value.startAt : table.value.endAt
  const totalSeconds = Math.max(0, Math.ceil((target - now.value.getTime()) / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)

  if (days > 0) return `${isNotStarted.value ? '距开始' : '距截止'}还有 ${days} 天${hours ? ` ${hours} 小时` : ''}`

  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${isNotStarted.value ? '距开始' : '距截止'}还有 ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})
const capacityPercentage = computed(() => {
  if (!table.value) return 0
  return Math.min(100, Math.round((table.value.videoCount / table.value.maxVideoCount) * 100))
})
const submissionRequirements = computed(() => {
  if (!table.value) return []

  const requirements: string[] = []
  const minMinutes = table.value.minVideoDuration ? Math.ceil(table.value.minVideoDuration / 60) : 0
  const maxMinutes = table.value.maxVideoDuration ? Math.ceil(table.value.maxVideoDuration / 60) : 0

  if (minMinutes && maxMinutes) requirements.push(`视频时长 ${minMinutes}–${maxMinutes} 分钟`)
  else if (minMinutes) requirements.push(`视频不少于 ${minMinutes} 分钟`)
  else if (maxMinutes) requirements.push(`视频不超过 ${maxMinutes} 分钟`)

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
    const d = new Date(ts > 1e11 ? ts : ts * 1000)
    return d.toLocaleString('zh-CN', {
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

await loadTable()
watch(() => route.params.id, loadTable)
watch(
  () => biliAuth.biliAuth,
  (auth) => {
    if (!auth?.userId) return
    addModel.value.name = auth.name
    addModel.value.uid = Number(auth.userId)
  },
  { immediate: true },
)

function currentId() {
  const id = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
  if (!id) throw new Error('缺少征集 ID')
  return id
}

async function loadTable() {
  isPageLoading.value = true
  try {
    const response = (await getApiVideoCollectGet({
      id: currentId(),
    })) as unknown as {
      code: number
      message?: string
      data: VideoCollectDetail
    }
    table.value =
      response.code === 200
        ? { ...response.data.table, allowedPartitions: [...(response.data.table.allowedPartitions ?? [])] }
        : null
    if (response.code !== 200 && response.code !== 404) throw new Error(response.message)
  } catch (error) {
    console.error('获取视频征集失败', error)
    table.value = null
    toast.error(error instanceof Error ? error.message : '获取失败')
  } finally {
    isPageLoading.value = false
  }
}

async function addVideo() {
  if (!addModel.value.video || !/BV[0-9A-Za-z]{10}/.test(addModel.value.video.trim())) {
    toast.error('请输入有效的哔哩哔哩视频链接或 BV 号')
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
  const payload = { ...addModel.value, id: table.value?.id ?? currentId() }

  try {
    const response = await requestWithCaptchaRetry({
      getToken: () => token.value,
      refresh: () => refreshCaptcha(turnstile.value),
      request: async (captchaToken) => {
        const headers: Record<string, string> = { Turnstile: captchaToken }
        if (isBiliAuthed.value) {
          const authHeaders = await biliAuth.getBiliAuthHeaders()
          for (const [k, v] of authHeaders) {
            headers[k] = v
          }
        }
        return postApiVideoCollectAdd(payload as any, {
          headers,
        }) as any
      },
    })
    if (response.code !== 200) throw new Error(response.message)

    submitted.value = true
    addModel.value.video = ''
    addModel.value.description = ''
    await loadTable()
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

onUnmounted(() => turnstile.value?.remove())
</script>

<template>
  <VideoCollectPageShell :table="table">
    <template #default>
      <main class="grid min-h-screen min-h-[100svh] py-10 px-4 box-border place-items-center">
        <div
          v-if="table === null && !isPageLoading"
          class="text-center py-20 space-y-3"
        >
          <h2 class="text-2xl font-bold">视频征集不存在</h2>
          <p class="text-sm text-muted-foreground">链接可能有误，或该征集已被删除。</p>
        </div>

        <div
          v-else-if="table"
          class="grid grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)] max-[768px]:grid-cols-1 max-[768px]:gap-8 gap-[clamp(28px,6vw,72px)] items-center w-[min(100%,1040px)] max-w-[var(--vtsuru-page-max-width,1040px)] min-w-0"
        >
          <section class="min-w-0">
            <div
              class="min-w-0"
              :style="{
                color: 'var(--vtsuru-page-text)',
                '--foreground': 'var(--vtsuru-page-text)',
                '--muted-foreground': 'var(--vtsuru-page-text-muted)',
              }"
            >
              <button
                type="button"
                class="owner-link flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition cursor-pointer"
                @click="router.push({ name: 'user-index', params: { id: table.owner.name } })"
              >
                <component
                  :is="Person24Regular"
                  class="size-4"
                />
                {{ table.owner.name }} 的视频征集
              </button>
              <div class="collect-title-row flex items-center gap-3 mt-2">
                <h1 class="text-2xl font-bold tracking-tight min-w-0">{{ table.name }}</h1>
                <Badge
                  :variant="collectionStatus === '进行中' ? 'default' : 'secondary'"
                  class="text-xs"
                >
                  {{ collectionStatus }}
                </Badge>
              </div>
              <p class="collect-description text-sm text-muted-foreground mt-3 leading-relaxed">
                {{ table.description || '未填写征集说明' }}
              </p>
            </div>

            <div
              class="collect-meta grid grid-cols-1 sm:grid-cols-3 gap-3 my-6 p-4 rounded-xl border border-border bg-card text-xs"
            >
              <div class="space-y-1">
                <div class="flex items-center gap-1.5 text-muted-foreground">
                  <component
                    :is="Clock24Regular"
                    class="size-3.5"
                  />
                  <span>开放时间</span>
                </div>
                <div class="font-medium font-mono text-foreground">
                  {{ formatDateTime(table.startAt) }}
                </div>
                <div
                  v-if="isNotStarted && countdownLabel"
                  class="collect-countdown text-[11px] text-primary"
                >
                  {{ countdownLabel }}
                </div>
              </div>
              <div class="space-y-1">
                <div class="flex items-center gap-1.5 text-muted-foreground">
                  <component
                    :is="Clock24Regular"
                    class="size-3.5"
                  />
                  <span>截止时间</span>
                </div>
                <div class="font-medium font-mono text-foreground">
                  {{ formatDateTime(table.endAt) }}
                </div>
                <div
                  v-if="!isNotStarted && countdownLabel"
                  class="collect-countdown text-[11px] text-primary"
                >
                  {{ countdownLabel }}
                </div>
              </div>
              <div class="space-y-1">
                <div class="flex items-center gap-1.5 text-muted-foreground">
                  <component
                    :is="Video24Regular"
                    class="size-3.5"
                  />
                  <span>已收集</span>
                </div>
                <div class="font-medium font-mono text-foreground">
                  {{ table.videoCount }} / {{ table.maxVideoCount }}
                </div>
              </div>
            </div>
            <Progress
              :model-value="capacityPercentage"
              class="h-2"
            />
          </section>

          <Card class="min-w-0 collect-on-surface shadow-sm">
            <CardContent class="p-6">
              <div
                v-if="submitted"
                class="py-8 flex flex-col items-center text-center gap-3"
              >
                <div class="size-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <component
                    :is="CheckmarkCircle24Regular"
                    class="size-7"
                  />
                </div>
                <h3 class="text-lg font-semibold">推荐成功</h3>
                <p class="text-xs text-muted-foreground">你的视频推荐已经提交。</p>
                <Button
                  class="mt-2"
                  @click="submitAnother"
                >
                  再推荐一个
                </Button>
              </div>

              <div
                v-else-if="isClosed"
                class="py-8 flex flex-col items-center text-center gap-2"
              >
                <h3 class="text-base font-semibold">征集已结束</h3>
                <p class="text-xs text-muted-foreground">当前不再接收新的视频推荐。</p>
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
                class="py-8 flex flex-col items-center text-center gap-2"
              >
                <h3 class="text-base font-semibold">投稿名额已满</h3>
                <p class="text-xs text-muted-foreground">当前暂时无法提交新的视频。</p>
              </div>

              <div
                v-else-if="!table.allowUnregisteredUser && !isBiliAuthed"
                class="py-8 flex flex-col items-center text-center gap-3"
              >
                <h3 class="text-base font-semibold">需要绑定 B 站账号</h3>
                <p class="text-xs text-muted-foreground">完成身份绑定后即可参与本次视频征集。</p>
                <Button @click="router.push({ name: 'bili-auth' })"> 前往绑定 </Button>
              </div>

              <form
                v-else
                class="space-y-4"
                @submit.prevent="addVideo"
              >
                <div class="submit-panel__heading flex items-start gap-2.5 pb-2 border-b border-border/60">
                  <component
                    :is="CheckmarkCircle24Regular"
                    class="size-5 text-primary shrink-0 mt-0.5"
                  />
                  <div>
                    <h2 class="text-sm font-semibold">推荐视频</h2>
                    <p class="text-xs text-muted-foreground">
                      {{ !isBiliAuthed && table.allowUnregisteredUser ? '无需登录也可投稿' : '填写哔哩哔哩视频信息' }}
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

                <div class="space-y-1.5">
                  <label class="text-xs font-medium text-foreground">视频链接或 BV 号</label>
                  <Input
                    v-model="addModel.video"
                    placeholder="https://www.bilibili.com/video/BV..."
                    class="h-9"
                  />
                </div>

                <div
                  v-if="isBiliAuthed"
                  class="authenticated-user flex items-center gap-1.5 text-xs text-primary font-medium p-2 rounded bg-primary/5 border border-primary/20"
                >
                  <component
                    :is="CheckmarkCircle24Regular"
                    class="size-4"
                  />
                  <span>以 {{ addModel.name }}（UID {{ addModel.uid }}）推荐</span>
                </div>
                <div
                  v-else
                  class="identity-fields grid grid-cols-2 gap-3"
                >
                  <div class="space-y-1.5">
                    <label class="text-xs font-medium text-foreground">推荐人</label>
                    <Input
                      v-model="addModel.name"
                      placeholder="选填"
                      maxlength="50"
                      class="h-9"
                    />
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-xs font-medium text-foreground">哔哩哔哩 UID</label>
                    <Input
                      :model-value="addModel.uid != null ? String(addModel.uid) : ''"
                      type="number"
                      placeholder="选填"
                      class="h-9"
                      @update:model-value="addModel.uid = $event ? Number($event) : undefined"
                    />
                  </div>
                </div>

                <div class="space-y-1.5">
                  <label class="text-xs font-medium text-foreground">
                    {{ table.requireDescription ? '推荐理由' : '推荐理由（选填）' }}
                  </label>
                  <Textarea
                    v-model="addModel.description"
                    :placeholder="table.requireDescription ? '请说明推荐这个视频的原因' : '可补充推荐原因或看点'"
                    maxlength="200"
                    rows="3"
                    class="text-xs"
                  />
                </div>

                <CaptchaWidget
                  ref="turnstile"
                  v-model="token"
                  class="turnstile flex justify-center py-1"
                />

                <Button
                  type="submit"
                  class="w-full"
                  :disabled="isLoading || !token"
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

