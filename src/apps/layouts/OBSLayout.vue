<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { useAccount } from '@/api/account'
import type { AuthInfo } from '@/shared/services/DanmakuClients/OpenLiveClient'
import { useOBSNotification } from '@/store/useOBSNotification'
import { useWebFetcher } from '@/store/useWebFetcher'
import { Spin } from '@/shared/ui/spin'

const visible = ref(true)
const active = ref(true)
const webfetcher = useWebFetcher()
const accountInfo = useAccount()
const _obsNotification = useOBSNotification()

const code = accountInfo.value.id ? accountInfo.value.biliAuthCode : window.$route.query.code?.toString()
const openLiveAuth = accountInfo.value.id ? undefined : (window.$route.query as unknown as AuthInfo)

onMounted(async () => {
  if (accountInfo.value.id) {
    await webfetcher.Start()
  }

  // @ts-expect-error 这里获取不了
  if (window.obsstudio) {
    // @ts-expect-error 这里获取不了
    window.obsstudio.onVisibilityChange = function (visibility: boolean) {
      visible.value = visibility
    }
    // @ts-expect-error 这里获取不了
    window.obsstudio.onActiveChange = function (a: boolean) {
      active.value = a
    }
  }
})
</script>

<template>
  <div class="obs-container">
    <RouterView v-slot="{ Component }">
      <KeepAlive>
        <Suspense>
          <component
            :is="Component"
            :active
            :visible
            :code="code"
            :open-live-auth="openLiveAuth"
          />
          <template #fallback>
            <div class="flex-center w-full h-full min-h-[100px]">
              <Spin size="medium" />
            </div>
          </template>
        </Suspense>
      </KeepAlive>
    </RouterView>
  </div>
</template>

<style>
.obs-container {
  --obs-classic-card-bg: rgba(15, 15, 15, 0.16);
  --obs-classic-surface-bg: rgba(15, 15, 15, 0.2);
  --obs-classic-chip-bg: rgba(0, 0, 0, 0.12);
  --obs-classic-footer-bg: rgba(0, 0, 0, 0.16);
  --obs-classic-tag-bg: rgba(255, 255, 255, 0.08);
  height: 100vh;
  overflow: hidden;
  position: relative;
}

/* 确保OBS中不出现滚动条 */
body {
  overflow: hidden;
  margin: 0;
  padding: 0;
}
</style>
