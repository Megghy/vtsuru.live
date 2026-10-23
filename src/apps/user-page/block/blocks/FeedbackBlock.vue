<script setup lang="ts">
import { ChatbubbleOutline, OpenOutline } from '@vicons/ionicons5'
import { computed } from 'vue'

import type { ResponseUserInfo } from '@/api/generated/model'
import QuestionBoxView from '@/apps/user/pages/QuestionBoxView.vue'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'

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
  defaultTag?: string
  showPublicQuestions: boolean
}

const props = defineProps<{ blockProps: unknown; userInfo?: ResponseUserInfo | undefined; biliInfo?: unknown }>()

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
    defaultTag:
      isBlockPropertyAvailable('feedback', o, 'defaultTag') && typeof o.defaultTag === 'string' ? o.defaultTag : '',
    showPublicQuestions:
      isBlockPropertyAvailable('feedback', o, 'showPublicQuestions') && typeof o.showPublicQuestions === 'boolean'
        ? o.showPublicQuestions
        : true,
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
      <div class="flex items-center gap-2">
        <component
          :is="ChatbubbleOutline"
          class="size-4.5 text-muted-foreground"
        />
        <span class="font-medium text-sm">{{ cfg.title }}</span>
      </div>
    </template>

    <div class="py-1">
      <template v-if="canEmbedInternalQuestionBox">
        <QuestionBoxView
          v-if="props.userInfo"
          :user-info="props.userInfo"
          :embedded="true"
          :default-tag="cfg.defaultTag"
          :show-public-questions="cfg.showPublicQuestions"
        />
        <Alert
          v-else
          class="text-xs py-2"
        >
          <AlertDescription> 未加载到用户信息，无法展示站内提问箱 </AlertDescription>
        </Alert>
      </template>

      <template v-else>
        <div
          v-if="cfg.description"
          class="block mb-3 whitespace-pre-wrap leading-relaxed text-muted-foreground"
        >
          {{ cfg.description }}
        </div>

        <Alert
          v-if="!url"
          class="text-xs py-2"
        >
          <AlertDescription> 未配置跳转链接 </AlertDescription>
        </Alert>

        <template v-else>
          <div class="action-row flex items-center gap-3 mb-4">
            <Button
              as="a"
              variant="outline"
              target="_blank"
              rel="noopener noreferrer"
              :href="url"
              class="open-btn font-semibold"
            >
              <component
                :is="OpenOutline"
                class="size-3.5 mr-1.5"
              />
              {{ cfg.buttonText }}
            </Button>
            <span class="url-hint text-xs text-muted-foreground truncate flex-1">
              {{ url }}
            </span>
          </div>

          <div
            v-if="feedbackEmbed"
            class="w-full overflow-hidden border border-border rounded-[var(--radius)] bg-muted [&_iframe]:block [&_iframe]:w-full [&_iframe]:border-0"
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
          <Alert
            v-else-if="externalEmbedRejected"
            class="embed-notice text-xs py-2"
          >
            <AlertDescription> 该来源暂不支持安全内嵌，请使用上方按钮访问 </AlertDescription>
          </Alert>
        </template>
      </template>
    </div>
  </BlockCard>
</template>
