<script setup lang="ts">
import { NLayout, NLayoutContent, NScrollbar, useMessage } from 'naive-ui'
import { onMounted, ref } from 'vue'
import { useAccount } from '@/api/account'
import { BiliAuthCodeStatusType } from '@/api/api-models'
import { selectedAPIKey } from '@/shared/config'
import ManageAuthGate from '@/apps/manage/components/layout/ManageAuthGate.vue'
import ManageContentGate from '@/apps/manage/components/layout/ManageContentGate.vue'
import ManageMusicPlayer from '@/apps/manage/components/layout/ManageMusicPlayer.vue'
import ManageSider from '@/apps/manage/components/layout/ManageSider.vue'
import ManageTopBar from '@/apps/manage/components/layout/ManageTopBar.vue'

const accountInfo = useAccount()
const message = useMessage()

const playerHeight = ref(0)

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
  <NLayout v-if="accountInfo.id" style="height: 100vh">
    <ManageTopBar :account-name="accountInfo?.name" />

    <NLayout has-sider style="height: calc(100vh - var(--vtsuru-header-height))">
      <ManageSider :account-info="accountInfo" />

      <NLayout>
        <NScrollbar :style="`height: calc(100vh - var(--vtsuru-header-height) - ${playerHeight}px)`" :x-scrollable="true">
          <NLayoutContent
            content-style="margin: var(--vtsuru-content-padding); margin-right: calc(var(--vtsuru-content-padding) + 4px); padding-bottom: 32px;min-width: 370px"
          >
            <ManageContentGate :account-info="accountInfo" />
          </NLayoutContent>
        </NScrollbar>

        <ManageMusicPlayer @height-change="playerHeight = $event" />
      </NLayout>
    </NLayout>
  </NLayout>

  <ManageAuthGate v-else />
</template>
