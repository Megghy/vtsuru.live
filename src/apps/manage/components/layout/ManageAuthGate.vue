<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isLoadingAccount } from '@/api/account'
import HomeEmojiBackdrop from '@/apps/web/components/HomeEmojiBackdrop.vue'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'
import { currentAPIKey, setSelectedAPIKey } from '@/shared/config'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { useBiliAuth } from '@/store/useBiliAuth'
import VtsuruLogo from '@/svgs/ic_vtuber.svg?component'

const route = useRoute()
const router = useRouter()
const biliAuth = useBiliAuth()
const showAPISwitchDialog = ref(false)
const showSiteLogin = ref(false)
const isUserWorkspace = computed(() => route.meta.workspace === 'user')
const pending = computed(() => isLoadingAccount.value || (isUserWorkspace.value && !biliAuth.sessionLoaded))
let loadingTimer: number | null = null

watch(
  pending,
  (loading) => {
    if (loading) {
      showAPISwitchDialog.value = false
      loadingTimer = window.setTimeout(() => {
        if (pending.value && currentAPIKey.value === 'main') {
          showAPISwitchDialog.value = true
        }
      }, 3000)
      return
    }

    if (loadingTimer) {
      clearTimeout(loadingTimer)
      loadingTimer = null
    }
    showAPISwitchDialog.value = false
  },
  { immediate: true },
)

async function switchToBackupAPI() {
  await setSelectedAPIKey('failover')
  showAPISwitchDialog.value = false
  location.reload()
}
</script>

<template>
  <main
    class="relative grid min-h-screen min-w-0 place-items-center box-border overflow-x-hidden py-12 px-5 isolation-isolate bg-background text-foreground max-[480px]:place-items-start max-[480px]:pt-6 max-[480px]:px-3 max-[480px]:pb-10"
  >
    <HomeEmojiBackdrop />

    <section
      v-if="!pending"
      class="relative z-1 w-[min(100%,520px)] min-w-0 grid gap-[18px]"
      aria-labelledby="auth-title"
    >
      <header class="text-center">
        <VtsuruLogo class="size-[72px] mx-auto text-[var(--brand)] max-[480px]:size-[58px]" />
        <p class="mt-3 mb-1.5 text-muted-foreground text-xs font-bold tracking-normal">VTSURU CENTER</p>
        <h1
          id="auth-title"
          class="m-0 text-foreground text-[28px] font-bold leading-tight tracking-tight"
        >
          {{ isUserWorkspace ? '查看积分和订单' : '登录或创建账号' }}
        </h1>
        <p class="mt-2 mb-0 text-muted-foreground text-sm leading-relaxed text-center">
          {{
            isUserWorkspace ? '用 Bilibili 发一条弹幕完成认证。不用注册本站账号。' : '主播使用本站账号管理直播工具。'
          }}
        </p>
      </header>

      <div
        v-if="isUserWorkspace"
        class="flex justify-center gap-2 flex-wrap"
      >
        <Button
          variant="brand"
          size="default"
          class="font-semibold"
          @click="router.push({ name: 'bili-auth' })"
        >
          开始认证
        </Button>
        <Button
          v-if="!showSiteLogin"
          variant="ghost"
          size="default"
          @click="showSiteLogin = true"
        >
          已有本站账号，登录
        </Button>
      </div>

      <div
        v-if="!isUserWorkspace || showSiteLogin"
        class="min-w-0 p-5 box-border border border-border rounded-lg bg-[color-mix(in_srgb,var(--popover)_94%,transparent)] shadow-[0_18px_52px_color-mix(in_srgb,var(--foreground)_10%,transparent)] backdrop-blur-md"
      >
        <RegisterAndLogin initial-tab="login" />
      </div>

      <Alert
        v-if="!isUserWorkspace"
        class="bg-muted/30 border-border"
      >
        <AlertTitle class="text-xs font-semibold">不是主播？</AlertTitle>
        <AlertDescription class="text-xs text-muted-foreground mt-1 space-y-2">
          <p>看积分和订单不用注册。用 Bilibili 发一条弹幕完成认证即可。</p>
          <div>
            <Button
              size="xs"
              variant="outline"
              @click="router.push({ name: 'bili-auth' })"
            >
              前往观众认证
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      <Button
        variant="outline"
        as-child
        class="min-w-28 mx-auto"
      >
        <a href="/">回到主页</a>
      </Button>
    </section>

    <section
      v-else
      class="relative z-1 w-[min(100%,520px)] min-w-0 grid justify-items-center gap-5 p-7 box-border border border-border rounded-lg bg-[color-mix(in_srgb,var(--popover)_94%,transparent)] shadow-[0_18px_52px_color-mix(in_srgb,var(--foreground)_10%,transparent)] backdrop-blur-md"
      aria-live="polite"
    >
      <div class="flex flex-col items-center gap-3 py-6">
        <div class="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
        <span class="text-xs text-muted-foreground">正在请求账户数据...</span>
      </div>

      <Alert
        v-if="showAPISwitchDialog"
        class="w-full border-warning/50 bg-warning/10 text-warning-foreground"
      >
        <AlertTitle class="text-xs font-semibold">加载时间较长</AlertTitle>
        <AlertDescription class="text-xs text-muted-foreground mt-1 space-y-2.5">
          <p>当前 API 响应较慢，是否切换到备用 API？</p>
          <div class="flex justify-end gap-2">
            <Button
              size="xs"
              variant="ghost"
              @click="showAPISwitchDialog = false"
            >
              继续等待
            </Button>
            <Button
              size="xs"
              variant="brand"
              @click="switchToBackupAPI"
            >
              切换到备用 API
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </section>
  </main>
</template>
