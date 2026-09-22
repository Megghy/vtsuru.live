<script setup lang="ts">
import { openUrl } from '@tauri-apps/plugin-opener'
import { Desktop24Filled, Live24Filled } from '@vicons/fluent'
import { NFlex, NIcon, NTabPane, NTabs, NTag } from 'naive-ui'
import { nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'

import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import FaceAuthModal from '@/apps/client/components/live-manage/FaceAuthModal.vue'
import LiveControlPanel from '@/apps/client/components/live-manage/LiveControlPanel.vue'
import LivePreflightPanel from '@/apps/client/components/live-manage/LivePreflightPanel.vue'
import LiveStreamInfo from '@/apps/client/components/live-manage/LiveStreamInfo.vue'
import ObsControlPanel from '@/apps/client/components/live-manage/ObsControlPanel.vue'
import type { CheckTarget } from '@/apps/client/components/live-manage/preflight'
import { useLiveControl } from '@/apps/client/composables/useLiveControl'
import { useLivePreflight } from '@/apps/client/composables/useLivePreflight'

const control = useLiveControl()
const preflight = useLivePreflight(control)
const activeTab = ref('control')
const settingsPanel = ref<HTMLElement>()
const router = useRouter()

async function navigateCheck(target: CheckTarget) {
  if (target === 'account') {
    await openUrl('https://vtsuru.live/manage')
    return
  }
  if (target === 'fetcher') {
    await router.push({ name: 'client-fetcher' })
    return
  }
  activeTab.value = target
  await nextTick()
  settingsPanel.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div class="live-manage-page">
    <NFlex
      vertical
      :size="14"
    >
      <!-- 标准页面标头 -->
      <ClientPageHeader
        title="直播管理"
        description="管理 B 站直播间标题、分区、封面与推流码，联动控制 OBS 本地推流"
      >
        <template #actions>
          <NTag
            :type="control.isLiving.value ? 'success' : 'default'"
            round
            :bordered="false"
          >
            <template #icon>
              <div
                class="status-dot"
                :class="{ 'status-dot--live': control.isLiving.value }"
              />
            </template>
            {{ control.isLiving.value ? '直播进行中' : '未开播' }}
          </NTag>
        </template>
      </ClientPageHeader>

      <LivePreflightPanel
        :checks="preflight.checks.value"
        :refreshing="preflight.refreshing.value"
        :error="preflight.error.value"
        :checked-at="preflight.checkedAt.value"
        @refresh="preflight.refresh"
        @navigate="navigateCheck"
      />
      <div ref="settingsPanel">
        <NTabs
          v-model:value="activeTab"
          type="segment"
          animated
          class="live-manage-tabs"
        >
          <NTabPane
            name="control"
            tab="直播控制"
          >
            <template #tab>
              <NFlex
                align="center"
                :size="6"
              >
                <NIcon :component="Live24Filled" />
                <span>直播控制</span>
              </NFlex>
            </template>

            <NFlex
              vertical
              :size="12"
              class="client-readable"
            >
              <LiveControlPanel :control="control" />
              <LiveStreamInfo :control="control" />
            </NFlex>
          </NTabPane>

          <NTabPane
            name="obs"
            tab="OBS 与统计"
          >
            <template #tab>
              <NFlex
                align="center"
                :size="6"
              >
                <NIcon :component="Desktop24Filled" />
                <span>OBS 与统计</span>
              </NFlex>
            </template>

            <div class="client-readable">
              <ObsControlPanel :control="control" />
            </div>
          </NTabPane>
        </NTabs>
      </div>
    </NFlex>

    <!-- 人脸认证弹窗 -->
    <FaceAuthModal :control="control" />
  </div>
</template>

<style scoped>
.live-manage-page {
  width: 100%;
}

.live-manage-tabs :deep(.n-tabs-rail) {
  max-width: 320px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: currentColor;
}

.status-dot--live {
  background-color: var(--vtsuru-success, #10b981);
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.3);
}
</style>
