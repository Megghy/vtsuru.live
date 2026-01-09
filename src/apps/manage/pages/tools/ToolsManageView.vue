<script setup lang="ts">
import { NTabPane, NTabs } from 'naive-ui'
import ToolDynamicNineGrid from '@/apps/manage/pages/tools/ToolDynamicNineGrid.vue'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'

// 后续可能需要的逻辑
</script>

<template>
  <div class="tools-manage-view">
    <ManagePageHeader title="直播工具箱" subtitle="工具集合（旧入口）" />
    <NTabs type="line" animated>
      <NTabPane name="nine-grid" tab="动态九宫格生成器">
        <ToolDynamicNineGrid />
      </NTabPane>
      <!-- 更多工具可以在这里添加 -->
    </NTabs>
  </div>
</template>

<style scoped>
.tools-manage-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
