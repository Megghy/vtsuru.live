<script setup lang="ts">
import { ArrowSync20Regular, Sparkle24Regular } from '@vicons/fluent'
import { NIcon, NScrollbar, NSpin } from 'naive-ui'
import { nextTick, onMounted, ref, watch } from 'vue'
import { useAssistantStore } from '../store/useAssistantStore'
import AssistantComposer from './AssistantComposer.vue'
import AssistantMessageList from './AssistantMessageList.vue'

const store = useAssistantStore()
const scrollRef = ref<InstanceType<typeof NScrollbar> | null>(null)
const composerRef = ref<InstanceType<typeof AssistantComposer> | null>(null)

/** 预置操作池, 覆盖助手当前可用的各类能力, 每次随机抽 4 个展示 */
const SUGGESTION_POOL = [
  // 日程
  '帮我看看这周的直播日程',
  '下周三晚上8点加一场杂谈',
  '把这周末的直播都改到晚上9点',
  // 数据分析
  '最近30天的粉丝增长怎么样',
  '分析一下最近7天的直播数据',
  '这个月收益和上个月比如何',
  // 舰长 / 积分
  '看看我的舰长情况',
  '积分商城现在有哪些商品',
  '有没有待处理的积分兑换订单',
  '帮我上架一个积分新商品',
  // 提问箱
  '提问箱里还有哪些没回复的',
  '帮我起草一条提问箱回复',
  // 视频征集 / 歌单
  '发起一个本周视频征集',
  '我的歌单里有哪些日语歌',
  '帮我往歌单里加几首歌',
  // 联网
  '帮我查一下这首歌的歌手资料',
]

const suggestions = ref<string[]>([])

/** 从池中随机抽 4 个不重复的预置操作 */
function rollSuggestions() {
  suggestions.value = [...SUGGESTION_POOL]
    .sort(() => Math.random() - 0.5)
    .slice(0, 4)
}

onMounted(rollSuggestions)

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
