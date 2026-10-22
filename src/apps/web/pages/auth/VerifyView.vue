<script setup lang="ts">
import { ArrowRight24Regular, CheckmarkCircle24Regular, DismissCircle24Regular, Mail24Regular } from '@vicons/fluent'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ACCOUNT, GetSelfAccount } from '@/api/account'
import { cookie } from '@/api/auth'
import { getApiAccountVerify } from '@/api/generated/account/account'
import { Button } from '@/shared/ui/button'
import { Spin } from '@/shared/ui/spin'

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
      return {
        kicker: '无法验证',
        title: '验证没有完成',
        summary: detail.value || '链接无效或已过期，请回到后台重新发送验证邮件。',
      }
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
    const data = await getApiAccountVerify({ target: target.value })
    if (data.code === 200) {
      if (cookie.value?.cookie) {
        await GetSelfAccount()
        accountName.value = ACCOUNT.value.name ?? ''
        phase.value = 'success'
        redirectTimer = setTimeout(goManage, 1200)
      } else {
        phase.value = 'need-login'
      }
      return
    }
    phase.value = 'error'
    detail.value = data.message || '链接无效或已过期，请回到后台重新发送验证邮件。'
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
  <main class="grid min-h-svh py-8 px-4 bg-muted place-items-center">
    <section class="grid w-full max-w-[420px] pt-8 px-7 pb-7 border border-border rounded-[var(--radius)] bg-popover justify-items-center text-center gap-2">
      <div
        class="grid size-[52px] mb-2 rounded-xl place-items-center"
        :class="{
          'text-[var(--brand)] bg-[var(--brand-soft)]': phase === 'checking',
          'text-[var(--vtsuru-success)] bg-[var(--vtsuru-success-soft)]': phase === 'success' || phase === 'need-login',
          'text-[var(--vtsuru-error)] bg-[var(--vtsuru-error-soft)]': phase === 'error',
        }"
      >
        <Spin
          v-if="phase === 'checking'"
          class="size-6"
        />
        <component
          :is="phase === 'error' ? DismissCircle24Regular : CheckmarkCircle24Regular"
          v-else
          class="size-7"
        />
      </div>
      <p class="m-0 text-muted-foreground text-xs">
        {{ copy.kicker }}
      </p>
      <h1 class="m-0 text-foreground text-[22px] font-semibold leading-tight">{{ copy.title }}</h1>
      <p class="m-0 mb-3 text-muted-foreground text-sm leading-relaxed">
        {{ copy.summary }}
      </p>
      <div class="grid w-full gap-2">
        <Button
          v-if="phase === 'success'"
          class="w-full flex items-center justify-center gap-2"
          @click="goManage"
        >
          进入主播后台
          <component
            :is="ArrowRight24Regular"
            class="size-4"
          />
        </Button>
        <Button
          v-else-if="phase === 'need-login'"
          class="w-full"
          @click="goHome"
        >
          去登录
        </Button>
        <template v-else-if="phase === 'error'">
          <Button
            class="w-full"
            @click="goHome"
          >
            返回首页
          </Button>
          <Button
            variant="outline"
            class="w-full"
            @click="goManage"
          >
            打开主播后台
          </Button>
        </template>
      </div>
      <p
        v-if="phase === 'checking'"
        class="inline-flex gap-1.5 items-center mt-2 text-muted-foreground text-xs"
      >
        <component
          :is="Mail24Regular"
          class="size-4"
        />
        来自验证邮件的一次性链接
      </p>
    </section>
  </main>
</template>
