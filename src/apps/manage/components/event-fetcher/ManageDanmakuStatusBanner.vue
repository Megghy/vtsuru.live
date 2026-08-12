<script setup lang="ts">
import { NAlert, NButton, NFlex, NTag, NText } from 'naive-ui'
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { useAccount } from '@/api/account'
import { BiliAuthCodeStatusType } from '@/api/api-models'
import { useDanmakuClient } from '@/store/useDanmakuClient'

const accountInfo = useAccount()
const router = useRouter()
const client = useDanmakuClient()

const authCodeLabel = computed(() => {
  switch (accountInfo.value?.biliAuthCodeStatus) {
    case BiliAuthCodeStatusType.Active:
      return '身份码有效'
    case BiliAuthCodeStatusType.Inactive:
      return '身份码需更新'
    case BiliAuthCodeStatusType.Notfound:
      return '身份码未绑定'
    default:
      return '身份码状态未知'
  }
})

const authCodeType = computed(() => {
  switch (accountInfo.value?.biliAuthCodeStatus) {
    case BiliAuthCodeStatusType.Active:
      return 'success' as const
    case BiliAuthCodeStatusType.Inactive:
      return 'error' as const
    default:
      return 'warning' as const
  }
})

const needsBind = computed(() => !accountInfo.value?.isBiliVerified)
const needsCodeUpdate = computed(
  () =>
    accountInfo.value?.isBiliVerified &&
    accountInfo.value?.biliAuthCodeStatus !== BiliAuthCodeStatusType.Active,
)

onMounted(() => {
  // 尽量拉起 openlive 连接态，便于展示；已连接时 no-op
  void client.ensureOpenlive().catch(() => undefined)
})

function goPanel() {
  void router.push({ name: 'manage-index', query: { tab: 'info' } })
}
</script>

<template>
  <div class="danmaku-status-banner">
    <NAlert
      v-if="needsBind"
      type="warning"
      size="small"
      :bordered="false"
    >
      <NFlex
        align="center"
        justify="space-between"
        wrap
        :size="8"
      >
        <NText>弹幕相关功能需要先绑定 Bilibili 主播账号。</NText>
        <NButton
          size="tiny"
          type="warning"
          secondary
          @click="goPanel"
        >
          前往面板绑定
        </NButton>
      </NFlex>
    </NAlert>

    <NAlert
      v-else-if="needsCodeUpdate"
      type="error"
      size="small"
      :bordered="false"
    >
      <NFlex
        align="center"
        justify="space-between"
        wrap
        :size="8"
      >
        <NText>身份码状态异常（{{ authCodeLabel }}），实时弹幕可能无法正常工作。</NText>
        <NButton
          size="tiny"
          type="error"
          secondary
          @click="goPanel"
        >
          更新身份码
        </NButton>
      </NFlex>
    </NAlert>

    <NFlex
      v-else
      class="danmaku-status-banner__ok"
      align="center"
      wrap
      :size="8"
    >
      <NTag
        size="small"
        :type="authCodeType"
        :bordered="false"
      >
        {{ authCodeLabel }}
      </NTag>
      <NTag
        size="small"
        :type="client.connected ? 'success' : 'warning'"
        :bordered="false"
      >
        {{ client.connectionStatus }}
      </NTag>
      <NText
        v-if="client.reconnectCount > 0"
        depth="3"
        style="font-size: 12px"
      >
        重连 {{ client.reconnectCount }} 次
      </NText>
      <NText
        depth="3"
        style="font-size: 12px"
      >
        后台标签页会限制定时器与 WebSocket，建议保持页面前台或使用 EventFetcher。
      </NText>
    </NFlex>
  </div>
</template>

<style scoped>
.danmaku-status-banner {
  margin-bottom: 10px;
}

.danmaku-status-banner__ok {
  padding: 8px 10px;
  border: 1px solid var(--vtsuru-border);
  border-radius: 10px;
  background: var(--vtsuru-bg-muted);
}
</style>
