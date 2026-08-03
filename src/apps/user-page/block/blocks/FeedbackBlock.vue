<script setup lang="ts">
import { ChatbubbleOutline, OpenOutline } from '@vicons/ionicons5'
import { computed } from 'vue'

import type { UserInfo } from '@/api/api-models'
import QuestionBoxView from '@/apps/user/pages/QuestionBoxView.vue'

import BlockCard from '../BlockCard.vue'
import { parseFeedbackEmbedUrl } from '../embed'
import { isBlockPropertyAvailable } from '../propertyCapabilities'

interface BlockConfig {
  title?: string
  description?: string
  url?: string
  buttonText?: string
  embed?: boolean
  embedMode?: 'questionBox' | 'iframe'
  height?: number
  framed?: boolean
  backgrounded?: boolean
}

const props = defineProps<{ blockProps: unknown; userInfo?: UserInfo | undefined; biliInfo?: unknown }>()

const cfg = computed<BlockConfig>(() => {
  const o =
    props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
      ? (props.blockProps as any)
      : {}
  const height = Number(o.height)
  return {
    title: isBlockPropertyAvailable('feedback', o, 'title') && typeof o.title === 'string' ? o.title : '留言 / 提问',
    description:
      isBlockPropertyAvailable('feedback', o, 'description') && typeof o.description === 'string' ? o.description : '',
    url: isBlockPropertyAvailable('feedback', o, 'url') && typeof o.url === 'string' ? o.url : '',
    buttonText:
      isBlockPropertyAvailable('feedback', o, 'buttonText') && typeof o.buttonText === 'string'
        ? o.buttonText
        : '前去留言',
    embed: typeof o.embed === 'boolean' ? o.embed : false,
    embedMode: o.embedMode === 'questionBox' || o.embedMode === 'iframe' ? o.embedMode : undefined,
    height:
      isBlockPropertyAvailable('feedback', o, 'height') && Number.isFinite(height)
        ? Math.min(1200, Math.max(200, height))
        : 520,
    framed: typeof o.framed === 'boolean' ? o.framed : true,
    backgrounded: typeof o.backgrounded === 'boolean' ? o.backgrounded : true,
  }
})

const url = computed(() => (cfg.value.url ?? '').trim())

function isInternalQuestionBoxUrl(raw: string): boolean {
  if (!raw.trim()) return false
  try {
    const u =
      raw.startsWith('http://') || raw.startsWith('https://') ? new URL(raw) : new URL(raw, window.location.origin)

    const host = u.hostname.toLowerCase()
    const currentHost = window.location.hostname.toLowerCase()
    const isTrustedHost =
      host === currentHost || host === 'vtsuru.live' || host === 'vtsuru.suki.club' || host === 'localhost'
    if (!isTrustedHost) return false

    const path = u.pathname.replace(/\/+$/, '')
    return path === '/question-box' || path.endsWith('/question-box')
  } catch {
    return false
  }
}

const embedMode = computed<'questionBox' | 'iframe'>(() => {
  if (cfg.value.embedMode === 'questionBox' || cfg.value.embedMode === 'iframe') return cfg.value.embedMode
  if (!url.value.length) return 'questionBox'
  if (isInternalQuestionBoxUrl(url.value)) return 'questionBox'
  return 'iframe'
})

const canEmbedInternalQuestionBox = computed(() => cfg.value.embed && embedMode.value === 'questionBox')
const feedbackEmbed = computed(() => {
  if (!cfg.value.embed || embedMode.value !== 'iframe') return null
  try {
    return parseFeedbackEmbedUrl(url.value)
  } catch {
    return null
  }
})
const externalEmbedRejected = computed(() => cfg.value.embed && embedMode.value === 'iframe' && !feedbackEmbed.value)
</script>

<template>
  <BlockCard
    class="feedback-card"
    :framed="cfg.framed"
    :backgrounded="cfg.backgrounded"
  >
    <template
      v-if="!canEmbedInternalQuestionBox"
      #header
    >
      <div
        align="center"
        style="gap: 8px"
      >
        <span
          size="18"
          depth="2"
        >
          <ChatbubbleOutline />
        </span>
        <span>{{ cfg.title }}</span>
      </div>
    </template>

    <div class="feedback-body">
      <template v-if="canEmbedInternalQuestionBox">
        <QuestionBoxView
          v-if="props.userInfo"
          :user-info="props.userInfo"
          embedded
        />
        <UAlert
          v-else
          color="info"
          style="border-radius: var(--vtsuru-page-radius)"
          ><template #description> 未加载到用户信息，无法展示站内提问箱 </template></UAlert
        >
      </template>

      <template v-else>
        <div
          v-if="cfg.description"
          class="feedback-desc"
        >
          {{ cfg.description }}
        </div>

        <UAlert
          v-if="!url"
          color="info"
          style="border-radius: var(--vtsuru-page-radius)"
          ><template #description> 未配置跳转链接 </template></UAlert
        >

        <template v-else>
          <div class="action-row">
            <UButton
              color="primary"
              variant="soft"
              target="_blank"
              rel="noopener noreferrer"
              :href="url"
              class="open-btn"
            >
              <template #leading>
                <span><OpenOutline /></span>
              </template>
              {{ cfg.buttonText }}
            </UButton>
            <span class="url-hint">
              {{ url }}
            </span>
          </div>

          <div
            v-if="feedbackEmbed"
            class="iframe-container"
          >
            <iframe
              :src="feedbackEmbed.src"
              :height="cfg.height"
              :title="feedbackEmbed.title"
              :allow="feedbackEmbed.allow"
              :sandbox="feedbackEmbed.sandbox"
              :referrerpolicy="feedbackEmbed.referrerPolicy"
              loading="lazy"
            />
          </div>
          <UAlert
            v-else-if="externalEmbedRejected"
            color="info"
            class="embed-notice"
            ><template #description> 该来源暂不支持安全内嵌，请使用上方按钮访问 </template></UAlert
          >
        </template>
      </template>
    </div>
  </BlockCard>
</template>

<style scoped>
.feedback-body {
  padding: 4px 0;
}

.feedback-desc {
  display: block;
  margin-bottom: 12px;
  white-space: pre-wrap;
  line-height: 1.6;
  color: var(--vtsuru-fg-muted);
}

.action-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.open-btn {
  border-radius: var(--vtsuru-page-radius);
  font-weight: 600;
}

.url-hint {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  color: var(--vtsuru-fg-muted);
}

.embed-notice {
  border-radius: var(--vtsuru-page-radius);
}
.iframe-container {
  width: 100%;
  overflow: hidden;
  border: var(--vtsuru-page-border-width) var(--vtsuru-page-border-style) var(--vtsuru-border);
  border-radius: var(--vtsuru-page-radius);
  background: var(--vtsuru-bg-muted);
}
.iframe-container iframe {
  display: block;
  width: 100%;
  border: 0;
}
</style>
