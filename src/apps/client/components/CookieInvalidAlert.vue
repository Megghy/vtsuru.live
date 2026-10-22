<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'

import { useBiliCookie } from '../store/useBiliCookie'

const props = withDefaults(
  defineProps<{
    variant?: 'home' | 'fetcher'
  }>(),
  {
    variant: 'home',
  },
)
const biliCookie = useBiliCookie()
const router = useRouter()

const alertConfig = computed(() =>
  props.variant === 'home'
    ? {
        title: '需重新登录 B 站账号',
        message: '检测到 B 站 Cookie 已失效，客户端功能将受限。',
      }
    : {
        title: 'EventFetcher 需要有效的 B 站 Cookie',
        message: '请尽快同步或重新登录 Cookie，以保证事件采集稳定运行。',
      },
)

const goToFetcher = () => {
  router.push({ name: 'client-fetcher' })
}

const goToSettings = () => {
  router.push({ name: 'client-settings' })
}
</script>

<template>
  <Alert
    v-if="biliCookie.hasBiliCookie && !biliCookie.isCookieValid"
    variant="destructive"
    class="cookie-invalid-alert"
  >
    <AlertTitle class="font-semibold">{{ alertConfig.title }}</AlertTitle>
    <AlertDescription class="cookie-invalid-alert__content mt-1">
      <p>{{ alertConfig.message }}</p>
      <p>如果已经部署 CookieCloud，请尝试重新同步；否则请重新扫码登录。</p>
      <div class="cookie-invalid-alert__actions mt-2 flex flex-wrap gap-2">
        <Button @click="goToFetcher"> 前往 EventFetcher </Button>
        <Button
          variant="outline"
          @click="goToSettings"
        >
          Cookie 设置
        </Button>
      </div>
    </AlertDescription>
  </Alert>
</template>

<style scoped>
.cookie-invalid-alert {
  width: 100%;
  box-sizing: border-box;
}

.cookie-invalid-alert__content {
  font-size: 13px;
  line-height: 1.6;
  color: var(--foreground);
}
</style>
