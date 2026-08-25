<script setup lang="ts">
import { Bot24Regular } from '@vicons/fluent'
import { NButton, NConfigProvider, NIcon, useMessage } from 'naive-ui'
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'

import { useAccount } from '@/api/account'
import { BiliAuthCodeStatusType } from '@/api/api-models'
import AssistantModal from '@/apps/assistant/components/AssistantModal.vue'
import { useAssistantStore } from '@/apps/assistant/store/useAssistantStore'
import ManageAuthGate from '@/apps/manage/components/layout/ManageAuthGate.vue'

import '@/apps/manage/styles/manage-page.css'
import ManageContentGate from '@/apps/manage/components/layout/ManageContentGate.vue'
import ManageMusicPlayer from '@/apps/manage/components/layout/ManageMusicPlayer.vue'
import ManageSider from '@/apps/manage/components/layout/ManageSider.vue'
import ManageTopBar from '@/apps/manage/components/layout/ManageTopBar.vue'
import { selectedAPIKey } from '@/shared/config'
import { buildManageTokens, getThemeCssVars, getThemeOverrides } from '@/shared/config/theme'
import { isDarkMode } from '@/shared/utils'

const accountInfo = useAccount()
const message = useMessage()
const route = useRoute()
const assistant = useAssistantStore()
const manageTokens = computed(() => buildManageTokens(isDarkMode.value))
const manageCssVars = computed(() => getThemeCssVars(manageTokens.value))
const manageThemeOverrides = computed(() => getThemeOverrides(manageTokens.value))

function openAssistant() {
  assistant.open({
    routeName: route.name?.toString() ?? '',
    title: (route.meta?.title as string) ?? route.name?.toString() ?? '管理后台',
    path: route.path,
  })
}

onMounted(() => {
  if (selectedAPIKey.value !== 'main') {
    message.warning('你当前使用的是备用API节点, 可能会速度比较慢')
  }

  setTimeout(() => {
    if (accountInfo.value?.biliAuthCodeStatus == BiliAuthCodeStatusType.Inactive) {
      message.error('你的身份码已失效, 请及时更新', { duration: 5000, closable: true })
    }
  }, 500)
})
</script>

<template>
  <NConfigProvider :theme-overrides="manageThemeOverrides">
    <div
      class="manage-theme"
      :style="manageCssVars"
    >
      <div
        v-if="accountInfo.id"
        class="manage-shell"
      >
        <div class="manage-shell__body">
          <ManageSider :account-info="accountInfo" />

          <div class="manage-shell__main">
            <ManageTopBar :account-name="accountInfo?.name" />
            <div class="manage-shell__scroll">
              <div class="manage-shell__content">
                <ManageContentGate :account-info="accountInfo" />
              </div>
            </div>

            <ManageMusicPlayer />
          </div>
        </div>

        <NButton
          circle
          type="primary"
          size="large"
          class="assistant-fab"
          title="VTsuru 助手"
          @click="openAssistant"
        >
          <template #icon>
            <NIcon :component="Bot24Regular" />
          </template>
        </NButton>

        <AssistantModal />
      </div>

      <ManageAuthGate v-else />
    </div>
  </NConfigProvider>
</template>

<style scoped>
.assistant-fab {
  position: fixed;
  right: 20px;
  bottom: 84px;
  z-index: 1500;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
}

.manage-theme,
.manage-shell {
  height: 100vh;
  background: var(--vtsuru-bg);
}

.manage-shell {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.manage-shell__body {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.manage-shell__main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.manage-shell__scroll {
  flex: 1 1 0;
  min-height: 0;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

.manage-shell__content {
  padding: 0;
  min-width: 370px;
  box-sizing: border-box;
}

@media (max-width: 600px) {
  .manage-shell__content {
    min-width: 0;
  }

  .assistant-fab {
    right: 12px;
    bottom: 72px;
  }
}
</style>
