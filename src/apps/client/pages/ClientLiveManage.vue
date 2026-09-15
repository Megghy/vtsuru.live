<script setup lang="ts">
import { Desktop24Filled, Live24Filled } from '@vicons/fluent'
import { NFlex, NIcon, NTabPane, NTabs, NTag } from 'naive-ui'
import { h } from 'vue'

import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import FaceAuthModal from '@/apps/client/components/live-manage/FaceAuthModal.vue'
import LiveControlPanel from '@/apps/client/components/live-manage/LiveControlPanel.vue'
import LiveStreamInfo from '@/apps/client/components/live-manage/LiveStreamInfo.vue'
import ObsControlPanel from '@/apps/client/components/live-manage/ObsControlPanel.vue'
import { useLiveControl } from '@/apps/client/composables/useLiveControl'

const control = useLiveControl()
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

      <!-- 统一 Segmented 分段导航 -->
      <NTabs
        type="segment"
        animated
        default-value="control"
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
