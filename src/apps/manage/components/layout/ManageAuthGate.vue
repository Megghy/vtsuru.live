<script setup lang="ts">
import { BrowsersOutline } from '@vicons/ionicons5'
import {
  NAlert,
  NButton,
  NCard,
  NDivider,
  NFlex,
  NIcon,
  NLayoutContent,
  NSpin,
  NSpace,
  NText,
  useMessage,
} from 'naive-ui'
import { ref, watch } from 'vue'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'
import { isLoadingAccount } from '@/api/account'
import { selectedAPIKey } from '@/shared/config'
import { isDarkMode } from '@/shared/utils'

const message = useMessage()
const showAPISwitchDialog = ref(false)
let loadingTimer: number | null = null

watch(isLoadingAccount, (loading) => {
  if (loading) {
    showAPISwitchDialog.value = false
    loadingTimer = window.setTimeout(() => {
      if (isLoadingAccount.value && selectedAPIKey.value === 'main') {
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
}, { immediate: true })

function switchToBackupAPI() {
  selectedAPIKey.value = 'failover'
  message.info('已切换到备用API，正在重新加载...')
  showAPISwitchDialog.value = false
  setTimeout(() => location.reload(), 500)
}
</script>

<template>
  <NLayoutContent
    style="
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      width: 100vw;
      background: linear-gradient(135deg, rgba(250,250,250,0.8) 0%, rgba(240,240,245,0.9) 100%);
      padding: 0;
      margin: 0;
      box-sizing: border-box;
      position: fixed;
      top: 0;
      left: 0;
      overflow: auto;
    " :class="isDarkMode ? 'login-dark-bg' : ''"
  >
    <template v-if="!isLoadingAccount">
      <NCard class="login-card" :bordered="false">
        <template #header>
          <NFlex justify="center" align="center" style="padding: 12px 0;">
            <NText
              strong
              style="font-size: 1.8rem; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); background-image: linear-gradient(to right, #36d1dc, #5b86e5); -webkit-background-clip: text; -webkit-text-fill-color: transparent;"
            >
              VTSURU CENTER
            </NText>
          </NFlex>
        </template>

        <NSpace vertical size="large" style="padding: 8px 0;">
          <NFlex justify="center" align="center">
            <NText style="font-size: 16px; text-align: center;">
              请登录或注册后使用
            </NText>
          </NFlex>

          <NAlert type="info" style="border-radius: 8px;">
            <NFlex vertical align="center" size="small">
              <div style="text-align: center;">
                如果你不是主播且不发送棉花糖(提问)的话则不需要注册登录, 直接访问认证完成后给出的链接即可
              </div>
              <NFlex justify="center" style="width: 100%; margin-top: 8px;">
                <NButton type="primary" size="small" @click="$router.push({ name: 'bili-user' })">
                  <template #icon>
                    <NIcon :component="BrowsersOutline" />
                  </template>
                  前往 Bilibili 认证用户主页
                </NButton>
              </NFlex>
            </NFlex>
          </NAlert>

          <NDivider style="margin: 8px 0;" />

          <RegisterAndLogin />

          <NFlex justify="center">
            <NButton secondary tag="a" href="/" style="min-width: 100px;">
              回到主页
            </NButton>
          </NFlex>
        </NSpace>
      </NCard>
    </template>

    <template v-else>
      <NCard class="loading-card" :bordered="false">
        <NFlex vertical justify="center" align="center" style="padding: 20px 10px;">
          <NSpin :loading="isLoadingAccount" size="large">
            <NText>正在请求账户数据...</NText>
          </NSpin>
          <NAlert
            v-if="showAPISwitchDialog"
            type="warning"
            style="margin-top: 20px; max-width: 400px;"
            title="加载时间较长"
          >
            <NSpace vertical>
              <NText>当前API响应较慢，是否切换到备用API？</NText>
              <NFlex justify="end" :size="8">
                <NButton size="small" @click="showAPISwitchDialog = false">
                  继续等待
                </NButton>
                <NButton type="primary" size="small" @click="switchToBackupAPI">
                  切换到备用API
                </NButton>
              </NFlex>
            </NSpace>
          </NAlert>
        </NFlex>
      </NCard>
    </template>
  </NLayoutContent>
</template>

<style scoped>
.login-dark-bg {
  background: linear-gradient(135deg, rgba(30, 30, 35, 0.9) 0%, rgba(20, 20, 25, 0.95) 100%) !important;
}

.login-card {
  max-width: 520px;
  width: 90%;
  min-width: 300px;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  margin: 16px;
}

.loading-card {
  min-width: 280px;
  width: 90%;
  max-width: 400px;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  margin: 16px;
}

@media (max-width: 480px) {
  .login-card,
  .loading-card {
    width: 95%;
    margin: 8px;
  }
}
</style>

