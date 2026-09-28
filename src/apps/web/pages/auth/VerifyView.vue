<script setup lang="ts">
import {
  ArrowRight24Regular,
  CheckmarkCircle24Regular,
  DismissCircle24Regular,
  Mail24Regular,
} from '@vicons/fluent'
import { NButton, NIcon, NSpin } from 'naive-ui'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ACCOUNT } from '@/api/account'
import type { AccountInfo } from '@/api/api-models'
import { cookie } from '@/api/auth'
import { QueryGetAPI } from '@/api/query'
import { ACCOUNT_API_URL } from '@/shared/config'

type Phase = 'checking' | 'success' | 'need-login' | 'error'
const PHASES: readonly Phase[] = ['checking', 'success', 'need-login', 'error']

const route = useRoute()
const router = useRouter()
const phase = ref<Phase>('checking')
const detail = ref('')
const accountName = ref('')
let redirectTimer: ReturnType<typeof setTimeout> | undefined

function queryText(name: string) {
  const v = route.query[name]
  const raw = Array.isArray(v) ? v[0] : v
  return raw == null ? undefined : String(raw)
}

const target = computed(() => queryText('target') ?? '')
const preview = computed<Phase | null>(() => {
  if (!('preview' in route.query)) return null
  const raw = queryText('preview') ?? ''
  return PHASES.includes(raw as Phase) ? (raw as Phase) : 'success'
})

const copy = computed(() => {
  switch (phase.value) {
    case 'checking':
      return { kicker: '邮箱验证', title: '正在确认验证链接', summary: '请稍候，正在完成邮箱验证。' }
    case 'success':
      return {
        kicker: '验证完成',
        title: '邮箱已验证',
        summary: accountName.value ? `${accountName.value}，可以进入主播后台了。` : '可以进入主播后台了。',
      }
    case 'need-login':
      return { kicker: '验证完成', title: '邮箱已验证', summary: '请登录后进入主播后台。' }
    default:
      return { kicker: '无法验证', title: '验证没有完成', summary: detail.value || '链接无效或已过期，请回到后台重新发送验证邮件。' }
  }
})

function goManage() {
  void router.replace('/manage')
}

function goHome() {
  void router.replace({ name: 'index' })
}

async function verify() {
  if (!target.value) {
    phase.value = 'error'
    detail.value = '链接缺少验证参数，请使用邮件中的完整链接。'
    return
  }

  try {
    const data = await QueryGetAPI<AccountInfo>(`${ACCOUNT_API_URL}verify`, { target: target.value })
    if (data.code === 200) {
      accountName.value = data.data.name
      if (cookie.value?.cookie) {
        ACCOUNT.value = data.data
        phase.value = 'success'
        redirectTimer = setTimeout(goManage, 1200)
      } else {
        phase.value = 'need-login'
      }
      return
    }
    if (data.code === 400 && data.message?.includes('已被认证')) {
      phase.value = cookie.value?.cookie ? 'success' : 'need-login'
      detail.value = data.message
      if (phase.value === 'success') redirectTimer = setTimeout(goManage, 1200)
      return
    }
    phase.value = 'error'
    detail.value = data.message || '验证失败'
  } catch (error) {
    phase.value = 'error'
    detail.value = error instanceof Error ? error.message : '验证失败，请稍后重试'
  }
}

watch(
  preview,
  (mode) => {
    if (!mode) return
    clearTimeout(redirectTimer)
    accountName.value = '预览用户'
    detail.value = '链接无效或已过期，请回到后台重新发送验证邮件。'
    phase.value = mode
  },
  { immediate: true },
)

onMounted(() => {
  if (preview.value) return
  void verify()
})

onUnmounted(() => {
  clearTimeout(redirectTimer)
})
</script>

<template>
  <main class="verify-page">
    <section class="verify-card">
      <div
        class="verify-icon"
        :class="`verify-icon--${phase}`"
      >
        <NSpin
          v-if="phase === 'checking'"
          size="small"
        />
        <NIcon
          v-else
          :component="phase === 'error' ? DismissCircle24Regular : CheckmarkCircle24Regular"
          :size="28"
        />
      </div>
      <p class="verify-kicker">
        {{ copy.kicker }}
      </p>
      <h1>{{ copy.title }}</h1>
      <p class="verify-summary">
        {{ copy.summary }}
      </p>
      <div class="verify-actions">
        <NButton
          v-if="phase === 'success'"
          type="primary"
          block
          @click="goManage"
        >
          进入主播后台
          <template #icon>
            <NIcon :component="ArrowRight24Regular" />
          </template>
        </NButton>
        <NButton
          v-else-if="phase === 'need-login'"
          type="primary"
          block
          @click="goHome"
        >
          去登录
        </NButton>
        <template v-else-if="phase === 'error'">
          <NButton
            type="primary"
            block
            @click="goHome"
          >
            返回首页
          </NButton>
          <NButton
            block
            @click="goManage"
          >
            打开主播后台
          </NButton>
        </template>
      </div>
      <p
        v-if="phase === 'checking'"
        class="verify-hint"
      >
        <NIcon :component="Mail24Regular" />
        来自验证邮件的一次性链接
      </p>
    </section>
  </main>
</template>

<style scoped>
.verify-page {
  display: grid;
  min-height: 100svh;
  padding: 32px 16px;
  background: var(--vtsuru-bg-muted);
  place-items: center;
}

.verify-card {
  display: grid;
  width: min(100%, 420px);
  padding: 32px 28px 28px;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  background: var(--vtsuru-bg-elevated);
  justify-items: center;
  text-align: center;
  gap: 8px;
}

.verify-icon {
  display: grid;
  width: 52px;
  height: 52px;
  margin-bottom: 8px;
  border-radius: 12px;
  place-items: center;
}

.verify-icon--checking {
  color: var(--vtsuru-brand);
  background: var(--vtsuru-brand-soft);
}

.verify-icon--success,
.verify-icon--need-login {
  color: var(--vtsuru-success);
  background: var(--vtsuru-success-soft);
}

.verify-icon--error {
  color: var(--vtsuru-error);
  background: var(--vtsuru-error-soft);
}

.verify-kicker {
  margin: 0;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

h1 {
  margin: 0;
  color: var(--vtsuru-fg);
  font-size: 22px;
  font-weight: 600;
  line-height: 1.3;
}

.verify-summary {
  margin: 0 0 12px;
  color: var(--vtsuru-fg-muted);
  font-size: 14px;
  line-height: 1.6;
}

.verify-actions {
  display: grid;
  width: 100%;
  gap: 8px;
}

.verify-hint {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  margin: 8px 0 0;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}
</style>
