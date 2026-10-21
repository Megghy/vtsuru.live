<script setup lang="ts">
import { Bot24Regular } from '@vicons/fluent'
import { toast } from '@/shared/utils'
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isLoadingAccount, useAccount } from '@/api/account'
import { BiliAuthCodeStatusType } from '@/api/api-models'
import AssistantModal from '@/apps/assistant/components/AssistantModal.vue'
import { useAssistantStore } from '@/apps/assistant/store/useAssistantStore'
import ManageAuthGate from '@/apps/manage/components/layout/ManageAuthGate.vue'

import '@/apps/manage/styles/manage-page.css'
import ManageContentGate from '@/apps/manage/components/layout/ManageContentGate.vue'
import ManageMusicPlayer from '@/apps/manage/components/layout/ManageMusicPlayer.vue'
import ManageSider from '@/apps/manage/components/layout/ManageSider.vue'
import ManageTopBar from '@/apps/manage/components/layout/ManageTopBar.vue'
import ManageUserGate from '@/apps/manage/components/layout/ManageUserGate.vue'
import { useManageWorkspace } from '@/apps/manage/composables/useManageWorkspace'
import { currentAPIKey } from '@/shared/config'
import { Button } from '@/shared/ui/button'
import { Toaster } from '@/shared/ui/sonner'
import { useBiliAuth } from '@/store/useBiliAuth'

const accountInfo = useAccount()
const route = useRoute()
const router = useRouter()
const assistant = useAssistantStore()
const biliAuth = useBiliAuth()
const { workspace } = useManageWorkspace()

const showShell = computed(() => {
  if (isLoadingAccount.value) return false
  if (workspace.value === 'user' && !biliAuth.sessionLoaded) return false
  if (workspace.value === 'user') return accountInfo.value.id > 0 || biliAuth.isAuthed
  return accountInfo.value.id > 0
})

watch(
  () => accountInfo.value.id,
  (accountId, previousId) => {
    if (
      accountId > 0 &&
      !previousId &&
      workspace.value === 'streamer' &&
      route.name === 'manage-index' &&
      !accountInfo.value.isBiliVerified &&
      accountInfo.value.biliUserAuthInfo
    ) {
      void router.replace({ name: 'bili-user-points' })
    }
  },
)

function openAssistant() {
  assistant.open({
    routeName: route.name?.toString() ?? '',
    title: (route.meta?.title as string) ?? route.name?.toString() ?? '管理后台',
    path: route.path,
  })
}

onMounted(() => {
  if (currentAPIKey.value !== 'main') {
    toast.warning('你当前使用的是备用API节点, 可能会速度比较慢')
  }

  setTimeout(() => {
    if (accountInfo.value?.biliAuthCodeStatus == BiliAuthCodeStatusType.Inactive) {
      toast.error('你的身份码已失效, 请及时更新')
    }
  }, 500)
})
</script>

<template>
  <div class="manage-theme bg-background text-foreground h-screen w-full flex flex-col overflow-hidden">
    <div
      v-if="showShell"
      class="manage-shell flex-1 min-h-0 flex flex-col overflow-hidden"
    >
      <div class="manage-shell__body flex-1 min-h-0 flex overflow-hidden">
        <ManageSider :account-info="accountInfo" />

        <div class="manage-shell__main flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          <ManageTopBar :account-name="workspace === 'user' ? biliAuth.biliAuth.name : accountInfo?.name" />
          <div class="manage-shell__scroll flex-1 min-h-0 overflow-y-auto flex flex-col">
            <div class="manage-shell__content flex-1 w-full min-w-[370px] flex flex-col p-0 box-border">
              <ManageUserGate v-if="workspace === 'user'" />
              <ManageContentGate
                v-else
                :account-info="accountInfo"
              />
            </div>
          </div>

          <ManageMusicPlayer />
        </div>
      </div>

      <Button
        variant="brand"
        size="icon"
        class="assistant-fab fixed right-5 bottom-[84px] z-[1500] h-11 w-11 rounded-full shadow-lg"
        title="VTsuru 助手"
        @click="openAssistant"
      >
        <component
          :is="Bot24Regular"
          class="h-6 w-6"
        />
      </Button>

      <AssistantModal />
    </div>

    <ManageAuthGate v-else />
    <Toaster />
  </div>
</template>

<style scoped>
@media (max-width: 600px) {
  .manage-shell__content {
    min-width: 0 !important;
  }

  .assistant-fab {
    right: 12px !important;
    bottom: 72px !important;
  }
}
</style>
