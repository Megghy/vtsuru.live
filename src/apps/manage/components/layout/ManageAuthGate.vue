<script setup lang="ts">
import { BrowsersOutline } from '@vicons/ionicons5'
import {
  NAlert, NButton, NCard, NDivider, NFlex, NIcon, NLayoutContent, NSpin, NText, useMessage, useThemeVars } from 'naive-ui';
import { ref, watch } from 'vue'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'
import { isLoadingAccount } from '@/api/account'
import { selectedAPIKey } from '@/shared/config'

const message = useMessage()
const themeVars = useThemeVars()
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
    :style="{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      width: '100vw',
      backgroundColor: themeVars.bodyColor,
      padding: 0,
      margin: 0,
      boxSizing: 'border-box',
      position: 'fixed',
      top: 0,
      left: 0,
      overflow: 'auto',
    }"
  >
    <template v-if="!isLoadingAccount">
      <NCard class="login-card" :bordered="false">
        <template #header>
          <NFlex justify="center" align="center" style="padding: 12px 0;">
            <NText
              strong
              style="font-size: 1.8rem;"
            >
              VTSURU CENTER
            </NText>
          </NFlex>
        </template>

        <NFlex vertical size="large" style="padding: 8px 0;">
          <NFlex justify="center" align="center">
            <NText style="font-size: 16px; text-align: center;">
              请登录或注册后使用
            </NText>
          </NFlex>

          <NAlert type="info">
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
        </NFlex>
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
            <NFlex vertical>
              <NText>当前API响应较慢，是否切换到备用API？</NText>
              <NFlex justify="end" :size="8">
                <NButton size="small" @click="showAPISwitchDialog = false">
                  继续等待
                </NButton>
                <NButton type="primary" size="small" @click="switchToBackupAPI">
                  切换到备用API
                </NButton>
              </NFlex>
            </NFlex>
          </NAlert>
        </NFlex>
      </NCard>
    </template>
  </NLayoutContent>
</template>

<style scoped>
.login-card {
  max-width: 520px;
  width: 90%;
  min-width: 300px;
  margin: 16px;
}

.loading-card {
  min-width: 280px;
  width: 90%;
  max-width: 400px;
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
