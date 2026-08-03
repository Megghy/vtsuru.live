<script setup lang="ts">
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
import { buildManageTokens, getThemeCssVars } from '@/shared/config/theme'
import { showToast } from '@/shared/services/toast'
import { isDarkMode } from '@/shared/utils'

const accountInfo = useAccount()
const route = useRoute()
const assistant = useAssistantStore()
const manageTokens = computed(() => buildManageTokens(isDarkMode.value))
const manageCssVars = computed(() => getThemeCssVars(manageTokens.value))

function openAssistant() {
  assistant.open({
    routeName: route.name?.toString() ?? '',
    title: (route.meta?.title as string) ?? route.name?.toString() ?? '管理后台',
    path: route.path,
  })
}

onMounted(() => {
  if (selectedAPIKey.value !== 'main') {
    showToast({ title: '当前使用备用 API 节点', description: '访问速度可能较慢', color: 'warning' })
  }

  setTimeout(() => {
    if (accountInfo.value?.biliAuthCodeStatus == BiliAuthCodeStatusType.Inactive) {
      showToast({ title: '身份码已失效', description: '请及时更新', color: 'error' })
    }
  }, 500)
})
</script>

<template>
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

        <UButton
          square
          color="primary"
          size="large"
          icon="i-lucide-bot"
          class="assistant-fab"
          title="VTsuru 助手"
          @click="openAssistant"
        />

        <AssistantModal />
      </div>

      <ManageAuthGate v-else />
  </div>
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
  height: 0;
  overflow-y: auto;
}

.manage-shell__content {
  padding: 0;
  min-width: 370px;
  box-sizing: border-box;
}
</style>
