<script setup lang="ts">
import { useRouter } from 'vue-router'
import { NAlert, NButton } from 'naive-ui'

import { useBiliCookie } from '../store/useBiliCookie'

const props = withDefaults(defineProps<{
  variant?: 'home' | 'fetcher'
}>(), {
  variant: 'home',
})
const biliCookie = useBiliCookie()
const router = useRouter()

const goToFetcher = () => {
  router.push({ name: 'client-fetcher' })
}

const goToSettings = () => {
  router.push({ name: 'client-settings' })
}
</script>

<template>
  <NAlert
    v-if="biliCookie.hasBiliCookie && !biliCookie.isCookieValid"
    class="cookie-invalid-alert"
    type="error"
    :title="props.variant === 'home' ? '需重新登录 B 站账号' : 'EventFetcher 需要有效的 B 站 Cookie'"
    :show-icon="true"
    :bordered="false"
  >
    <div class="cookie-invalid-alert__content">
      <p>
        {{ props.variant === 'home'
          ? '检测到 B 站 Cookie 已失效，客户端功能将受限。'
          : '请尽快同步或重新登录 Cookie，以保证事件采集稳定运行。'
        }}
      </p>
      <p>
        如果已经部署 CookieCloud，请尝试重新同步；否则请重新扫码登录。
      </p>
      <div class="cookie-invalid-alert__actions">
        <NButton
          size="small"
          type="primary"
          @click="goToFetcher"
        >
          前往 EventFetcher
        </NButton>
        <NButton
          size="small"
          tertiary
          @click="goToSettings"
        >
          Cookie 设置
        </NButton>
      </div>
    </div>
  </NAlert>
</template>

<style scoped>
.cookie-invalid-alert {
  width: 100%;
  box-sizing: border-box;
}

.cookie-invalid-alert__content {
  font-size: 13px;
  line-height: 1.6;
  color: rgb(51 54 57 / 90%);
}

.cookie-invalid-alert__actions {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
