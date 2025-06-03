<template>
  <div class="tools-manage-view p-4">
    <n-h1>直播工具箱</n-h1>
    <n-tabs type="line" animated>
      <n-tab-pane name="nine-grid" tab="动态九宫格生成器">
        <DynamicNineGridGenerator />
      </n-tab-pane>
      <!-- 更多工具可以在这里添加 -->
    </n-tabs>
  </div>
</template>

<script setup lang="ts">
import { NH1, NTabs, NTabPane } from 'naive-ui'
import DynamicNineGridGenerator from './tools/DynamicNineGridGenerator.vue'

// 后续可能需要的逻辑
</script>

<style scoped>
.tools-manage-view {
  max-width: 1200px;
  margin: 0 auto;
}
</style>