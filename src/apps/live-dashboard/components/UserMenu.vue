<script setup lang="ts">
import {
  AlertTriangle,
  AtSign,
  Ban,
  BookmarkPlus,
  Cake,
  Check,
  Copy,
  CornerUpLeft,
  ExternalLink,
  Eye,
  EyeOff,
  Filter,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Star,
  UserRoundSearch,
} from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import { FunctionTypes } from '@/api/generated/model'
import { useFanPrivacy } from '@/shared/composables/useFanPrivacy'
import { isTauri } from '@/shared/config'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Textarea } from '@/shared/ui/textarea'
import { copyToClipboard, useMessage } from '@/shared/utils'

import { avatarUrl, formatClock, formatPrice, formatRelative } from '../core/format'
import { userKeyOf } from '../core/types'
import { useEventActions } from '../store/eventActions'
import { useDashboardUi } from '../store/ui'
import { useLiveDashboard } from '../store/useLiveDashboard'
import EventBadges from './EventBadges.vue'
import UserHistory from './UserHistory.vue'
import UserPoints from './UserPoints.vue'

const message = useMessage()
const dashboard = useLiveDashboard()
const ui = useDashboardUi()
const actions = useEventActions()
const account = useAccount()
const { privacyMode, togglePrivacyMode, formatBirthday, maskSensitiveText } = useFanPrivacy()
const pointEnabled = computed(() => account.value.settings.enableFunctions.includes(FunctionTypes.Point))

const menu = computed(() => ui.userMenu)
const event = computed(() => menu.value?.event)
const userKey = computed(() => (event.value ? userKeyOf(event.value) : ''))
const filtering = computed(() => !!userKey.value && dashboard.userFilter?.userKey === userKey.value)

const fanMeta = computed(() => (event.value ? dashboard.fans.getInlineMeta(event.value) : null))
const cloudProfile = computed(() => fanMeta.value?.profile)
const cloudActivity = computed(() => (event.value ? dashboard.fans.resolveActivity(event.value) : undefined))

const nicknameDraft = ref('')
const noteDraft = ref('')
const summarizing = ref(false)
const savingMemory = ref(false)
const togglingStar = ref(false)
const birthdayRevealed = ref(false)

watch(
  [userKey, cloudProfile],
  ([key, profile], [prevKey]) => {
    if (key !== prevKey) birthdayRevealed.value = false
    nicknameDraft.value = profile?.nickname ?? ''
    noteDraft.value = profile?.note || (key ? (dashboard.notes.get(key)?.note ?? '') : '')
  },
  { immediate: true },
)

const fullProfileHref = computed(() => {
  const e = event.value
  if (!e) return '/manage/fans'
  const ouid = cloudProfile.value?.canonicalOUId || e.ouid
  if (ouid) return `/manage/fans?ouid=${encodeURIComponent(ouid)}`
  if (e.uid > 0) return `/manage/fans?uid=${e.uid}`
  return '/manage/fans'
})

function close() {
  ui.userMenu = null
}

/** 点击其他用户名时由其自身切换菜单目标，不视为点击外部 */
function onClickOutside(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('[data-user-trigger]')) return
  close()
}

async function saveCloudQuickFields() {
  const e = event.value
  if (!e || (!e.ouid && e.uid <= 0)) return

  const nextNick = nicknameDraft.value.trim()
  const nextNote = noteDraft.value.trim()
  const prevNick = cloudProfile.value?.nickname ?? ''
  const prevNote = cloudProfile.value?.note || (dashboard.notes.get(userKey.value)?.note ?? '')

  if (nextNick === prevNick && nextNote === prevNote) return

  // 本地与云端双写，确保离线也有缓存
  await dashboard.notes.set(userKey.value, e.uname, nextNote)
  const saved = await dashboard.fans.quickSave(e, { nickname: nextNick, note: nextNote })
  if (saved) {
    message.success('粉丝称呼/备注已同步云端')
  }
}

async function handleRemember() {
  const e = event.value
  if (!e || savingMemory.value) return
  savingMemory.value = true
  try {
    await dashboard.fans.rememberEvent(e)
  } finally {
    savingMemory.value = false
  }
}

async function handleToggleStar() {
  const e = event.value
  if (!e || togglingStar.value) return
  togglingStar.value = true
  try {
    await dashboard.fans.toggleStar(e)
  } finally {
    togglingStar.value = false
  }
}

async function handleSummarize() {
  const e = event.value
  if (!e || summarizing.value) return
  summarizing.value = true
  try {
    await dashboard.fans.summarize(e)
  } finally {
    summarizing.value = false
  }
}

function toggleFilter() {
  const e = event.value!
  if (filtering.value) dashboard.backToContext()
  else dashboard.filterByUser(e, e.key)
  close()
}

function run(action: () => void) {
  action()
  close()
}

const popoverStyle = computed(() => {
  if (!menu.value) return {}
  const maxX = typeof window !== 'undefined' ? Math.max(8, window.innerWidth - 376) : menu.value.x
  const maxY = typeof window !== 'undefined' ? Math.max(8, window.innerHeight - 540) : menu.value.y
  return {
    left: `${Math.max(8, Math.min(menu.value.x, maxX))}px`,
    top: `${Math.max(8, Math.min(menu.value.y, maxY))}px`,
  }
})

onMounted(() => {
  window.addEventListener('click', onClickOutside)
})

onUnmounted(() => {
  window.removeEventListener('click', onClickOutside)
})
</script>

<template>
  <div
    v-if="menu && event"
    class="user-menu-popover fixed z-50 w-[364px] max-h-[82vh] overflow-y-auto scrollbar-thin rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-md"
    :style="popoverStyle"
    @click.stop
  >
    <div class="grid gap-2.5">
      <div class="flex gap-2.5 items-start">
        <img
          v-if="event.uface"
          class="size-11 rounded-full object-cover shrink-0"
          :src="avatarUrl(event.uface, 96)"
          referrerpolicy="no-referrer"
        />
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1 flex-wrap font-semibold text-sm leading-tight">
            <button
              v-if="event.ouid || event.uid > 0"
              type="button"
              class="inline-flex items-center justify-center rounded-sm hover:bg-accent p-0.5 transition-colors"
              :disabled="togglingStar"
              :title="cloudProfile?.isStarred ? '取消重点粉丝' : '设为重点粉丝'"
              @click="handleToggleStar"
            >
              <Star
                class="size-3.5"
                :class="cloudProfile?.isStarred ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground'"
              />
            </button>
            <span v-if="cloudProfile?.nickname" class="text-brand">{{ cloudProfile.nickname }}</span>
            <span :class="cloudProfile?.nickname ? 'text-xs text-muted-foreground font-normal' : ''">
              {{ event.uname || '匿名用户' }}
            </span>
            <EventBadges
              :event="event"
              show-medal
            />
          </div>
          <div class="flex items-center gap-2 flex-wrap mt-0.5 text-[11px] text-muted-foreground tabular-nums">
            <span v-if="event.uid > 0">UID {{ event.uid }}</span>
            <span v-if="cloudProfile?.pronunciation">读音: {{ cloudProfile.pronunciation }}</span>
            <button
              v-if="cloudProfile?.birthdayMonth && cloudProfile?.birthdayDay"
              type="button"
              class="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400 hover:underline"
              :title="privacyMode ? '已开启防露屏模式' : birthdayRevealed ? '点击隐藏生日' : '点击查看生日'"
              @click="birthdayRevealed = !birthdayRevealed"
            >
              <Cake class="size-3" />
              <span>{{ formatBirthday(cloudProfile.birthdayMonth, cloudProfile.birthdayDay, birthdayRevealed) }}</span>
              <EyeOff
                v-if="birthdayRevealed && !privacyMode"
                class="size-2.5 opacity-70"
              />
              <Eye
                v-else
                class="size-2.5 opacity-70"
              />
            </button>
            <span :title="dashboard.settings.absoluteTime ? formatRelative(event.time) : formatClock(event.time)">
              {{ dashboard.settings.absoluteTime ? formatClock(event.time) : formatRelative(event.time) }}
            </span>
          </div>
          <div
            v-if="cloudProfile?.tags?.length"
            class="flex flex-wrap gap-1 mt-1"
          >
            <Badge
              v-for="tag in cloudProfile.tags"
              :key="tag"
              variant="secondary"
              class="text-[11px] px-1.5 py-0"
            >
              {{ tag }}
            </Badge>
          </div>
        </div>
      </div>

      <!-- 跨场云端统计条 -->
      <div
        v-if="cloudProfile || cloudActivity"
        class="flex-between rounded-md bg-muted/60 px-2.5 py-1.5 text-[11px] text-muted-foreground tabular-nums"
      >
        <span>云端累计 {{ Math.max(cloudProfile?.liveCount ?? 0, cloudActivity?.liveCount ?? 0) }} 场</span>
        <span>
          消费 {{ privacyMode ? '¥••••' : formatPrice(Math.max(cloudProfile?.totalPrice ?? 0, cloudActivity?.totalPrice ?? 0)) }}
        </span>
        <span v-if="cloudProfile?.memoryCount">记忆 {{ cloudProfile.memoryCount }} 条</span>
      </div>

      <!-- 忌讳 / 雷区提醒 -->
      <div
        v-if="cloudProfile?.taboos"
        class="flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-300"
      >
        <AlertTriangle class="size-3.5 shrink-0 mt-0.5" />
        <span class="wrap-anywhere">
          {{ maskSensitiveText(cloudProfile.taboos, '已开启防露屏遮罩（忌讳提醒已隐藏）') }}
        </span>
      </div>

      <!-- AI 速览卡片 -->
      <div
        v-if="event.ouid || event.uid > 0"
        class="rounded-md border border-border bg-card/70 p-2 space-y-1.5"
      >
        <div class="flex-between gap-2">
          <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground">
            <Sparkles class="size-3.5 text-brand" />
            AI 粉丝印象
            <span
              v-if="cloudProfile?.aiStyle"
              class="font-normal text-muted-foreground"
              >· {{ cloudProfile.aiStyle }}</span
            >
          </span>
          <Button
            variant="ghost"
            size="xs"
            class="h-6 px-1.5 text-[11px]"
            :disabled="summarizing"
            @click="handleSummarize"
          >
            <Loader2
              v-if="summarizing"
              class="size-3 mr-1 animate-spin"
            />
            <Sparkles
              v-else
              class="size-3 mr-1"
            />
            {{ cloudProfile?.aiSummary ? '刷新' : '生成画像' }}
          </Button>
        </div>
        <p
          v-if="cloudProfile?.aiSummary"
          class="text-xs text-muted-foreground leading-relaxed wrap-anywhere"
        >
          {{ cloudProfile.aiSummary }}
        </p>
        <p
          v-else
          class="text-[11px] text-muted-foreground"
        >
          尚未生成 AI 画像，点击右侧即可基于本直播间历史弹幕与互动自动总结。
        </p>
      </div>

      <div class="flex flex-wrap gap-1">
        <Button
          v-if="event.ouid || event.uid > 0"
          variant="secondary"
          size="xs"
          as="a"
          :href="fullProfileHref"
          target="_blank"
        >
          <UserRoundSearch class="size-3.5 mr-1" />
          完整档案
        </Button>
        <Button
          v-if="event.ouid || event.uid > 0"
          variant="secondary"
          size="xs"
          :disabled="savingMemory"
          @click="handleRemember"
        >
          <BookmarkPlus class="size-3.5 mr-1" />
          记住这一条
        </Button>
        <Button
          v-if="isTauri() && event.uname"
          variant="secondary"
          size="xs"
          @click="run(() => ui.insertReplyTarget(event!.uname))"
        >
          <AtSign class="size-3.5 mr-1" />
          @TA 回复
        </Button>
        <Button
          variant="secondary"
          size="xs"
          @click="toggleFilter"
        >
          <component
            :is="filtering ? CornerUpLeft : Filter"
            class="size-3.5 mr-1"
          />
          {{ filtering ? '转至上下文' : '筛选该用户' }}
        </Button>
        <Button
          variant="secondary"
          size="xs"
          @click="run(() => dashboard.toggleRead(event!))"
        >
          <Check class="size-3.5 mr-1" />
          {{ dashboard.isRead(event) ? '标为未读' : '标为已读' }}
        </Button>
        <Button
          variant="secondary"
          size="xs"
          @click="run(() => (ui.imageTarget = event!))"
        >
          <ImageIcon class="size-3.5 mr-1" />
          保存图片
        </Button>
        <Button
          variant="secondary"
          size="xs"
          @click="run(() => copyToClipboard(event!.uname))"
        >
          <Copy class="size-3.5 mr-1" />
          复制昵称
        </Button>
        <Button
          v-if="event.uid > 0"
          variant="secondary"
          size="xs"
          as="a"
          :href="`https://space.bilibili.com/${event.uid}`"
          target="_blank"
        >
          <ExternalLink class="size-3.5 mr-1" />
          空间
        </Button>
        <Button
          v-if="event.ouid"
          :variant="actions.isBlocked(event) ? 'secondary' : 'destructive'"
          size="xs"
          @click="run(() => actions.toggleBlock(event!))"
        >
          <Ban class="size-3.5 mr-1" />
          {{ actions.isBlocked(event) ? '移出黑名单' : '拉黑' }}
        </Button>
      </div>

      <UserPoints
        v-if="pointEnabled && event.ouid"
        :event="event"
      />

      <!-- 快捷称呼 + 云端备注 -->
      <div class="grid gap-1.5">
        <Input
          v-if="event.ouid || event.uid > 0"
          v-model="nicknameDraft"
          placeholder="专属称呼（失焦自动同步云端，弹幕流优先显示）"
          @blur="saveCloudQuickFields"
          @keyup.enter="saveCloudQuickFields"
        />
        <div
          v-if="privacyMode"
          class="flex-between rounded-md border border-dashed border-border bg-muted/40 px-2.5 py-2 text-[11px] text-muted-foreground"
        >
          <span>防露屏模式已隐藏私密备注</span>
          <Button
            variant="ghost"
            size="xs"
            @click="togglePrivacyMode"
          >
            <Eye class="size-3 mr-1" />
            临时关闭
          </Button>
        </div>
        <Textarea
          v-else
          v-model="noteDraft"
          class="min-h-[42px] max-h-[96px]"
          placeholder="云端备注（失焦自动同步，跨设备保留；请勿填写手机号或住址）"
          @blur="saveCloudQuickFields"
        />
      </div>

      <UserHistory :event="event" />
    </div>
  </div>
</template>
