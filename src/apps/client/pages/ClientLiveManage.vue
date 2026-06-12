<script setup lang="ts">
import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import LiveControlPanel from '@/apps/client/components/live-manage/LiveControlPanel.vue'
import LiveStreamInfo from '@/apps/client/components/live-manage/LiveStreamInfo.vue'
import ObsControlPanel from '@/apps/client/components/live-manage/ObsControlPanel.vue'
import FaceAuthModal from '@/apps/client/components/live-manage/FaceAuthModal.vue'
import { useLiveControl } from '@/apps/client/composables/useLiveControl'

const control = useLiveControl()
</script>

<template>
  <div class="live-manage-page">
    <NFlex
      vertical
      :size="12"
    >
      <!-- 页面标题 -->
      <NCard
        size="small"
        class="live-manage-card"
        bordered
      >
        <ClientPageHeader
          title="直播管理"
          description="使用 OBS 直接推流到 B 站官方服务器，管理直播间信息和封面"
        />
      </NCard>

      <NTabs
        type="line"
        animated
        default-value="control"
      >
        <NTabPane
          name="control"
          tab="直播控制"
        >
          <NFlex
            vertical
            :size="12"
          >
            <LiveControlPanel :control="control" />
            <LiveStreamInfo :control="control" />
          </NFlex>
        </NTabPane>

        <NTabPane
          name="obs"
          tab="OBS 与统计"
        >
          <ObsControlPanel :control="control" />
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
</style>
