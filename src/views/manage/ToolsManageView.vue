<script setup lang="ts">
import { NH1, NTabPane, NTabs } from 'naive-ui'
import ToolDynamicNineGrid from '@/components/manage/tools/ToolDynamicNineGrid.vue'

// 后续可能需要的逻辑
</script>

<template>
  <div class="tools-manage-view p-4">
    <NH1>直播工具箱</NH1>
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
  max-width: 1200px;
  margin: 0 auto;
}
</style>
