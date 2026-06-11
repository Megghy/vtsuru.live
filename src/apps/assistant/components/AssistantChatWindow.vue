<script setup lang="ts">
import { ArrowSync20Regular, Sparkle24Regular, Alert24Regular } from '@vicons/fluent'
import { NIcon, NScrollbar, NSpin } from 'naive-ui'
import { nextTick, onMounted, ref, watch } from 'vue'
import { useAssistantStore } from '../store/useAssistantStore'
import { getDigest, type AssistantDigestItem } from '../api/assistant'
import AssistantComposer from './AssistantComposer.vue'
import AssistantMessageList from './AssistantMessageList.vue'

const store = useAssistantStore()
const scrollRef = ref<InstanceType<typeof NScrollbar> | null>(null)
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
interface Suggestion { text: string, cat: string }
const SUGGESTION_POOL: Suggestion[] = [
  // 日程
  { text: '帮我看看这周的直播日程', cat: 'schedule' },
  { text: '下周三晚上8点加一场杂谈', cat: 'schedule' },
  { text: '把这周末的直播都改到晚上9点', cat: 'schedule' },
  // 数据分析
  { text: '最近30天的粉丝增长怎么样', cat: 'analyze' },
  { text: '分析一下最近7天的直播数据', cat: 'analyze' },
  { text: '这个月收益和上个月比如何', cat: 'analyze' },
  { text: '复盘一下我最近一场直播', cat: 'analyze' },
  // 舰长 / 积分
  { text: '看看我的舰长情况', cat: 'point' },
  { text: '积分商城现在有哪些商品', cat: 'point' },
  { text: '有没有待处理的积分兑换订单', cat: 'point' },
  { text: '帮我上架一个积分新商品', cat: 'point' },
  // 提问箱
  { text: '提问箱里还有哪些没回复的', cat: 'qa' },
  { text: '帮我起草一条提问箱回复', cat: 'qa' },
  // 视频征集
  { text: '发起一个本周视频征集', cat: 'video' },
  // 歌单
  { text: '我的歌单里有哪些日语歌', cat: 'song' },
  { text: '帮我往歌单里加几首歌', cat: 'song' },
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
  musicRequest: 'song',
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
  const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5)
  const cat = preferredCategory()
  const picked: Suggestion[] = []

  if (cat) {
    picked.push(...shuffle(SUGGESTION_POOL.filter(s => s.cat === cat)).slice(0, 2))
  }
  const rest = shuffle(SUGGESTION_POOL.filter(s => !picked.includes(s)))
  picked.push(...rest.slice(0, 4 - picked.length))

  suggestions.value = shuffle(picked).map(s => s.text)
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
  () => store.messages.map(m =>
    `${m.id}:${m.text.length}:${m.usage?.totalTokens ?? 0}:${m.process.map(s => s.kind === 'reasoning' ? `r${s.text.length}` : `t${s.tool.id}:${s.tool.status}:${s.tool.summary?.length ?? 0}:${s.tool.error?.length ?? 0}`).join('|')}:${m.actions.length}`,
  ).join(),
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
  <div class="chat-window">
    <NScrollbar ref="scrollRef" class="chat-window__scroll" @scroll="onScroll">
      <AssistantMessageList
        v-if="store.messages.length"
        :messages="store.messages"
        :busy="store.sending"
        @retry="store.retry"
        @rerun="store.rerun"
        @edit-user="store.editAndRerun"
        @confirm="store.confirmAction"
        @reject="store.rejectActionById"
        @save="store.saveActionEdit"
        @schedule="store.scheduleActionById"
        @cancel-schedule="store.cancelScheduleById"
      />
      <div v-else-if="store.messagesLoading" class="chat-window__loading">
        <NSpin size="medium" />
      </div>
      <div v-else class="chat-window__welcome">
        <div class="chat-window__welcome-icon">
          <NIcon :component="Sparkle24Regular" size="26" />
        </div>
        <div class="chat-window__welcome-title">
          有什么可以帮你的?
        </div>
        <div class="chat-window__welcome-sub">
          用自然语言管理日程、查询数据, 或上传截图让我识别
        </div>
        <div v-if="digest.length" class="chat-window__digest">
          <button
            v-for="d in digest"
            :key="d.kind + d.text"
            type="button"
            class="chat-window__digest-item"
            :disabled="store.sending"
            @click="onPickSuggestion(d.prompt)"
          >
            <NIcon :component="Alert24Regular" size="15" />
            <span>{{ d.text }}</span>
          </button>
        </div>
        <div class="chat-window__suggestions">
          <button
            v-for="s in suggestions"
            :key="s"
            type="button"
            class="chat-window__chip"
            :disabled="store.sending"
            @click="onPickSuggestion(s)"
          >
            {{ s }}
          </button>
          <button
            type="button"
            class="chat-window__chip chat-window__chip--roll"
            :disabled="store.sending"
            title="换一批"
            @click="rollSuggestions"
          >
            <NIcon :component="ArrowSync20Regular" size="15" />
            换一批
          </button>
        </div>
      </div>
    </NScrollbar>

    <div class="chat-window__composer">
      <AssistantComposer ref="composerRef" :loading="store.sending" @send="onSend" @stop="store.abortPending" />
    </div>
  </div>
</template>

<style scoped>
.chat-window { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.chat-window__scroll { flex: 1 1 0; min-height: 0; }
.chat-window__loading {
  display: flex; align-items: center; justify-content: center;
  padding: 64px 16px;
}
.chat-window__composer {
  flex: 0 0 auto; padding-top: 10px; margin-top: 6px;
  border-top: 1px solid var(--n-border-color, rgba(128, 128, 128, 0.18));
}

.chat-window__welcome {
  display: flex; flex-direction: column; align-items: center;
  gap: 8px; padding: 48px 16px 24px; text-align: center;
}
.chat-window__welcome-icon {
  display: flex; align-items: center; justify-content: center;
  width: 52px; height: 52px; margin-bottom: 4px;
  border-radius: 16px;
  color: var(--vtsuru-brand, #23ade5);
  background: var(--vtsuru-brand-soft, rgba(35, 173, 229, 0.1));
}
.chat-window__welcome-title {
  font-size: 16px; font-weight: 600;
  color: var(--vtsuru-fg, var(--n-text-color));
}
.chat-window__welcome-sub {
  font-size: 13px; max-width: 360px; line-height: 1.5;
  color: var(--vtsuru-fg-muted, var(--n-text-color-3));
}
.chat-window__suggestions {
  display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;
  margin-top: 12px; max-width: 440px;
}
.chat-window__digest {
  display: flex; flex-direction: column; gap: 6px;
  margin-top: 14px; width: 100%; max-width: 360px;
}
.chat-window__digest-item {
  display: flex; align-items: center; gap: 8px;
  padding: 9px 12px; border-radius: 10px; text-align: left;
  border: 1px solid var(--vtsuru-warning-tint, rgba(240, 160, 32, 0.35));
  background: var(--vtsuru-warning-soft, rgba(240, 160, 32, 0.08));
  color: var(--vtsuru-fg, var(--n-text-color));
  font-size: 13px; cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}
.chat-window__digest-item:hover:not(:disabled) {
  background: var(--vtsuru-warning-soft-hover, rgba(240, 160, 32, 0.16));
}
.chat-window__digest-item:active:not(:disabled) { transform: scale(0.99); }
.chat-window__digest-item:disabled { opacity: 0.5; cursor: not-allowed; }
.chat-window__digest-item > span { flex: 1 1 0; min-width: 0; }
.chat-window__chip {
  padding: 7px 13px; border-radius: 999px;
  border: 1px solid var(--vtsuru-border, rgba(128, 128, 128, 0.2));
  background: var(--vtsuru-bg-muted, rgba(128, 128, 128, 0.05));
  color: var(--vtsuru-fg, var(--n-text-color));
  font-size: 13px; cursor: pointer;
  transition: border-color 0.15s, background 0.15s, transform 0.1s;
}
.chat-window__chip:hover:not(:disabled) {
  border-color: var(--vtsuru-brand-tint, rgba(35, 173, 229, 0.5));
  background: var(--vtsuru-brand-soft, rgba(35, 173, 229, 0.08));
}
.chat-window__chip:active:not(:disabled) { transform: scale(0.97); }
.chat-window__chip:disabled { opacity: 0.5; cursor: not-allowed; }
.chat-window__chip--roll {
  display: inline-flex; align-items: center; gap: 4px;
  color: var(--vtsuru-fg-muted, var(--n-text-color-3));
  border-style: dashed;
}
</style>
