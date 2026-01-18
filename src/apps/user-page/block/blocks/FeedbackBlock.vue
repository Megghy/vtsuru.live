<script setup lang="ts">
import type { UserInfo } from '@/api/api-models'
import { NAlert, NButton, NFlex, NText, NIcon } from 'naive-ui';
import { computed } from 'vue'
import { ChatbubbleOutline, OpenOutline } from '@vicons/ionicons5'
import BlockCard from '../BlockCard.vue'
import QuestionBoxView from '@/apps/user/pages/QuestionBoxView.vue'

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

const props = defineProps<{ blockProps: unknown, userInfo?: UserInfo | undefined, biliInfo?: unknown }>()

const cfg = computed<BlockConfig>(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  const height = Number(o.height)
  return {
    title: typeof o.title === 'string' ? o.title : '留言 / 提问',
    description: typeof o.description === 'string' ? o.description : '',
    url: typeof o.url === 'string' ? o.url : '',
    buttonText: typeof o.buttonText === 'string' ? o.buttonText : '前去留言',
    embed: typeof o.embed === 'boolean' ? o.embed : false,
    embedMode: (o.embedMode === 'questionBox' || o.embedMode === 'iframe') ? o.embedMode : undefined,
    height: Number.isFinite(height) ? Math.min(1200, Math.max(200, height)) : 520,
    framed: typeof o.framed === 'boolean' ? o.framed : true,
    backgrounded: typeof o.backgrounded === 'boolean' ? o.backgrounded : true,
  }
})

const url = computed(() => (cfg.value.url ?? '').trim())

function isInternalQuestionBoxUrl(raw: string): boolean {
  if (!raw.trim()) return false
  try {
    const u = raw.startsWith('http://') || raw.startsWith('https://')
      ? new URL(raw)
      : new URL(raw, window.location.origin)

    const host = u.hostname.toLowerCase()
    const currentHost = window.location.hostname.toLowerCase()
    const isTrustedHost = host === currentHost || host === 'vtsuru.live' || host === 'vtsuru.suki.club' || host === 'localhost'
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
const canEmbedIframe = computed(() => cfg.value.embed && embedMode.value === 'iframe' && url.value.startsWith('https://'))
</script>

<template>
  <BlockCard class="feedback-card" :framed="cfg.framed" :backgrounded="cfg.backgrounded">
    <template v-if="!canEmbedInternalQuestionBox" #header>
      <NFlex align="center" style="gap: 8px">
        <NIcon size="18" depth="2">
          <ChatbubbleOutline />
        </NIcon>
        <span>{{ cfg.title }}</span>
      </NFlex>
    </template>

    <div class="feedback-body">
      <template v-if="canEmbedInternalQuestionBox">
        <QuestionBoxView v-if="props.userInfo" :user-info="props.userInfo" />
        <NAlert v-else type="info" :show-icon="false" style="border-radius: var(--vtsuru-page-radius)">
          未加载到用户信息，无法展示站内提问箱
        </NAlert>
      </template>

      <template v-else>
        <NText v-if="cfg.description" depth="3" class="feedback-desc">
          {{ cfg.description }}
        </NText>

        <NAlert v-if="!url" type="info" :show-icon="false" style="border-radius: var(--vtsuru-page-radius)">
          未配置跳转链接
        </NAlert>

        <template v-else>
          <div class="action-row">
            <NButton
              type="primary"
              secondary
              tag="a"
              target="_blank"
              rel="noopener noreferrer"
              :href="url"
              class="open-btn"
            >
              <template #icon>
                <NIcon><OpenOutline /></NIcon>
              </template>
              {{ cfg.buttonText }}
            </NButton>
            <NText depth="3" class="url-hint">
              {{ url }}
            </NText>
          </div>

          <div v-if="canEmbedIframe" class="iframe-container">
            <iframe
              :src="url"
              :height="cfg.height"
              loading="lazy"
              referrerpolicy="no-referrer"
            />
          </div>
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
}

.iframe-container {
  width: 100%;
  border: 1px solid var(--n-divider-color);
  border-radius: var(--vtsuru-page-radius);
  overflow: hidden;
  background: var(--n-action-color);
}

.iframe-container iframe {
  width: 100%;
  border: none;
  display: block;
}
</style>
