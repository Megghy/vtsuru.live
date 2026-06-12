<script setup lang="ts">
import { useRouter } from 'vue-router'
import { NAlert, NButton } from 'naive-ui';
import { computed } from 'vue'
import { useBiliCookie } from '../store/useBiliCookie'

const props = withDefaults(defineProps<{
  variant?: 'home' | 'fetcher'
}>(), {
  variant: 'home',
})
const biliCookie = useBiliCookie()
const router = useRouter()

const alertConfig = computed(() => props.variant === 'home'
  ? {
      title: '需重新登录 B 站账号',
      message: '检测到 B 站 Cookie 已失效，客户端功能将受限。',
    }
  : {
      title: 'EventFetcher 需要有效的 B 站 Cookie',
      message: '请尽快同步或重新登录 Cookie，以保证事件采集稳定运行。',
    })

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
    :title="alertConfig.title"
    :show-icon="true"
    :bordered="false"
  >
    <div class="cookie-invalid-alert__content">
      <p>
        {{ alertConfig.message }}
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
  color: var(--n-text-color);
}

.cookie-invalid-alert__actions {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
