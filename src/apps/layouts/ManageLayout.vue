<script setup lang="ts">
import { NButton, NIcon, NScrollbar, useMessage } from 'naive-ui';
import { Bot24Regular } from '@vicons/fluent'
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAccount } from '@/api/account'
import { BiliAuthCodeStatusType } from '@/api/api-models'
import { selectedAPIKey } from '@/shared/config'
import '@/apps/manage/styles/manage-page.css'
import ManageAuthGate from '@/apps/manage/components/layout/ManageAuthGate.vue'
import ManageContentGate from '@/apps/manage/components/layout/ManageContentGate.vue'
import ManageMusicPlayer from '@/apps/manage/components/layout/ManageMusicPlayer.vue'
import ManageSider from '@/apps/manage/components/layout/ManageSider.vue'
import ManageTopBar from '@/apps/manage/components/layout/ManageTopBar.vue'
import AssistantModal from '@/apps/assistant/components/AssistantModal.vue'
import { useAssistantStore } from '@/apps/assistant/store/useAssistantStore'

const accountInfo = useAccount()
const message = useMessage()
const route = useRoute()
const assistant = useAssistantStore()

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
  <div v-if="accountInfo.id" class="manage-shell">
    <div class="manage-shell__body">
      <ManageSider :account-info="accountInfo" />

      <div class="manage-shell__main">
        <ManageTopBar :account-name="accountInfo?.name" />
        <NScrollbar class="manage-shell__scroll">
          <div class="manage-shell__content">
            <ManageContentGate :account-info="accountInfo" />
          </div>
        </NScrollbar>

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
</template>

<style scoped>
.assistant-fab {
  position: fixed;
  right: 20px;
  bottom: 84px;
  z-index: 1500;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
}

.manage-shell {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--n-body-color);
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
}

.manage-shell__scroll :deep(.n-scrollbar-container) {
  min-height: 100%;
}

.manage-shell__content {
  padding: 0;
  min-width: 370px;
  box-sizing: border-box;
}
</style>
