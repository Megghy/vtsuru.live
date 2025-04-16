<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

// 组件属性定义
const props = defineProps<{
  // 可以根据需要添加属性
}>()

// 事件定义
const emit = defineEmits<{
  // 可以根据需要添加事件
}>()

// 组件挂载时的初始化
onMounted(() => {
  // 初始化逻辑
})
</script>

<template>
  <div class="point-sub-item-manage">
    <!-- 组件内容 -->
  </div>
</template>

<style scoped>
.point-sub-item-manage {
  width: 100%;
}
</style>