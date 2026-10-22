<script setup lang="ts">
import { Alert24Regular, ArrowSync20Regular, Sparkle24Regular } from '@vicons/fluent'
import { nextTick, onMounted, ref, watch } from 'vue'

import { Spin } from '@/shared/ui/spin'

import type { AssistantDigestItem } from '../api/assistant'
import { getDigest } from '../api/assistant'
import { useAssistantStore } from '../store/useAssistantStore'
import AssistantComposer from './AssistantComposer.vue'
import AssistantMessageList from './AssistantMessageList.vue'

const store = useAssistantStore()
const scrollRef = ref<HTMLDivElement | null>(null)
const composerRef = ref<InstanceType<typeof AssistantComposer> | null>(null)

/** 主动建议提示 (后台待办概览), 仅在欢迎页拉取一次 */
const digest = ref<AssistantDigestItem[]>([])
async function loadDigest() {
  try {
    digest.value = await getDigest()
  } catch (e) {
    console.warn('[assistant] 加载建议提示失败', e)
  }
}

/** 预置操作池: 每条带分类标签, 用于按当前页面加权抽样 */
interface Suggestion {
  text: string
  cat: string
}
const SUGGESTION_POOL: Suggestion[] = [
  // 日程
  { text: '帮我看看这周的直播日程', cat: 'schedule' },
  { text: '下周三晚上8点加一场杂谈', cat: 'schedule' },
  { text: '把这周末的直播都改到晚上9点', cat: 'schedule' },
  { text: '看看这周的日程, 帮我补一场直播', cat: 'schedule' },
  // 数据分析
  { text: '最近30天的粉丝增长怎么样', cat: 'analyze' },
  { text: '分析一下最近7天的直播数据', cat: 'analyze' },
  { text: '这个月收益和上个月比如何', cat: 'analyze' },
  { text: '复盘一下我最近一场直播', cat: 'analyze' },
  { text: '谁给我打赏最多', cat: 'analyze' },
  { text: '查一下最近几天大家发了什么弹幕', cat: 'analyze' },
  // 舰长 / 积分
  { text: '看看我的舰长情况', cat: 'point' },
  { text: '积分商城现在有哪些商品', cat: 'point' },
  { text: '有没有待处理的积分兑换订单', cat: 'point' },
  { text: '有哪些待发货的积分订单', cat: 'point' },
  { text: '看看观众的积分排行榜', cat: 'point' },
  { text: '帮我上架一个积分新商品', cat: 'point' },
  // 提问箱
  { text: '提问箱里还有哪些没回复的', cat: 'qa' },
  { text: '帮我起草一条提问箱回复', cat: 'qa' },
  // 视频征集
  { text: '发起一个本周视频征集', cat: 'video' },
  { text: '看看视频征集收到哪些投稿', cat: 'video' },
  { text: '关闭这周的视频征集', cat: 'video' },
  // 歌单
  { text: '我的歌单里有哪些日语歌', cat: 'song' },
  { text: '帮我往歌单里加几首歌', cat: 'song' },
  // 上舰记录
  { text: '看看最近的上舰记录', cat: 'guard' },
  { text: '帮我补录一条舰长上舰', cat: 'guard' },
  // 点歌队列
  { text: '现在点歌队列有什么', cat: 'request' },
  { text: '今天唱了哪些歌', cat: 'request' },
  // 展示页
  { text: '我的主页上有哪些区块', cat: 'page' },
  { text: '怎么把直播信息加到主页', cat: 'page' },
  // 设置
  { text: '把签到基础积分调大一点', cat: 'setting' },
  { text: '给点歌设置加个冷却时间', cat: 'setting' },
  { text: '帮我开启直播抽奖功能', cat: 'setting' },
  // 联网
  { text: '帮我查一下这首歌的歌手资料', cat: 'web' },
]

/** 路由名 (片段匹配) -> 偏好的建议分类。命中的分类会被优先展示 */
const ROUTE_CATEGORY: Record<string, string> = {
  schedule: 'schedule',
  analyze: 'analyze',
  liveDetail: 'analyze',
  live: 'analyze',
  point: 'point',
  questionBox: 'qa',
  videoCollect: 'video',
  songList: 'song',
  musicRequest: 'request',
  liveRequest: 'request',
  event: 'guard',
  userPageBuilder: 'page',
}

/** 根据当前页面路由名找出偏好分类 (无匹配返回 null) */
function preferredCategory(): string | null {
  const name = store.context.routeName ?? ''
  for (const key in ROUTE_CATEGORY) {
    if (name.includes(key)) return ROUTE_CATEGORY[key]
  }
  return null
}

const suggestions = ref<string[]>([])

/**
 * 抽 4 条建议: 当前页面相关分类的建议优先 (最多占 2 条), 其余随机补足, 整体打散。
 */
function rollSuggestions() {
  function shuffle<T>(arr: T[]): T[] {
    return [...arr].toSorted(() => Math.random() - 0.5)
  }
  const cat = preferredCategory()
  const picked: Suggestion[] = []

  if (cat) {
    picked.push(...shuffle(SUGGESTION_POOL.filter((s) => s.cat === cat)).slice(0, 2))
  }
  const rest = shuffle(SUGGESTION_POOL.filter((s) => !picked.includes(s)))
  picked.push(...rest.slice(0, 4 - picked.length))

  suggestions.value = shuffle(picked).map((s) => s.text)
}

onMounted(() => {
  rollSuggestions()
  loadDigest()
})
// 切换页面 (上下文变化) 时重抽, 让建议跟随当前页面
watch(() => store.context.routeName, rollSuggestions)

/** 贴底跟随: 用户在底部附近时流式输出才自动滚动; 一旦上滚查看 (如审批卡片) 即脱离, 不再强拉 */
const stick = ref(true)
const STICK_THRESHOLD = 80

function onScroll(e: Event) {
  const el = e.target as HTMLElement
  stick.value = el.scrollHeight - el.scrollTop - el.clientHeight <= STICK_THRESHOLD
}

async function scrollToBottom() {
  await nextTick()
  if (!stick.value) return
  scrollRef.value?.scrollTo({ top: 999999, behavior: 'smooth' })
}

watch(
  () =>
    store.messages
      .map(
        (m) =>
          `${m.id}:${m.text.length}:${m.usage?.totalTokens ?? 0}:${m.process.map((s) => (s.kind === 'reasoning' ? `r${s.text.length}` : `t${s.tool.id}:${s.tool.status}:${s.tool.summary?.length ?? 0}:${s.tool.error?.length ?? 0}`)).join('|')}:${m.actions.length}`,
      )
      .join(),
  scrollToBottom,
)

function onSend(text: string, images: string[]) {
  // 用户主动发送, 重新贴底跟随本轮输出
  stick.value = true
  store.send(text, images)
}

/** 点击预置操作: 仅填入输入框, 不直接发送 */
function onPickSuggestion(text: string) {
  composerRef.value?.fill(text)
}
</script>

<template>
  <div class="flex flex-col h-full min-h-0">
    <div
      ref="scrollRef"
      class="flex-1 min-h-0 overflow-y-auto"
      @scroll="onScroll"
    >
      <AssistantMessageList
        v-if="store.messages.length"
        :messages="store.messages"
        :busy="store.sending"
        @retry="store.retry"
        @rerun="store.rerun"
        @edit-user="store.editAndRerun"
        @confirm="store.confirmAction"
        @confirm-all="store.confirmAllActions"
        @reject="store.rejectActionById"
        @save="store.saveActionEdit"
        @schedule="store.scheduleActionById"
        @cancel-schedule="store.cancelScheduleById"
      />
      <div
        v-else-if="store.messagesLoading"
        class="flex-center py-16 px-4"
      >
        <Spin />
      </div>
      <div
        v-else
        class="flex flex-col items-center gap-2 pt-12 px-4 pb-6 text-center"
      >
        <div class="flex-center size-12 rounded-xl bg-[var(--brand-soft,rgba(35,173,229,0.12))] text-[var(--brand,#23ade5)] mb-1">
          <component
            :is="Sparkle24Regular"
            class="size-6 text-primary"
          />
        </div>
        <div class="text-base font-semibold text-foreground">有什么可以帮你的?</div>
        <div class="text-[13px] text-muted-foreground max-w-[380px]">用自然语言管理日程、查询数据, 或上传截图让我识别</div>
        <div
          v-if="digest.length"
          class="flex flex-col gap-1.5 w-full max-w-[440px] mt-2"
        >
          <button
            v-for="d in digest"
            :key="d.kind + d.text"
            type="button"
            class="flex items-center gap-2 py-2 px-3 rounded-lg bg-muted border border-border text-foreground text-xs text-left cursor-pointer transition hover:enabled:border-[var(--brand)] hover:enabled:bg-[var(--brand-soft)]"
            :disabled="store.sending"
            @click="onPickSuggestion(d.prompt)"
          >
            <component
              :is="Alert24Regular"
              class="size-3.5 text-amber-500 shrink-0"
            />
            <span>{{ d.text }}</span>
          </button>
        </div>
        <div class="flex flex-wrap gap-2 justify-center max-w-[520px] mt-3">
          <button
            v-for="s in suggestions"
            :key="s"
            type="button"
            class="py-1.5 px-3 rounded-2xl bg-muted border border-border text-foreground text-xs cursor-pointer transition hover:enabled:border-[var(--brand)] hover:enabled:text-[var(--brand)]"
            :disabled="store.sending"
            @click="onPickSuggestion(s)"
          >
            {{ s }}
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-1 py-1.5 px-3 rounded-2xl bg-muted border border-border text-muted-foreground text-xs cursor-pointer transition hover:enabled:text-foreground hover:enabled:border-[var(--brand)]"
            :disabled="store.sending"
            title="换一批"
            @click="rollSuggestions"
          >
            <component
              :is="ArrowSync20Regular"
              class="size-3.5"
            />
            换一批
          </button>
        </div>
      </div>
    </div>

    <div class="shrink-0 pt-2.5 mt-1.5 border-t border-border">
      <AssistantComposer
        ref="composerRef"
        :loading="store.sending"
        @send="onSend"
        @stop="store.abortPending"
      />
    </div>
  </div>
</template>

