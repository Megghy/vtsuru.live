<script setup lang="ts">
import type { BaseDanmakuItemProps } from './components/danmaku/danmakuUtils'
import CardStyleDanmakuItem from './components/danmaku/CardStyleDanmakuItem.vue'
import { useDanmakuUtils } from './components/danmaku/danmakuUtils'
import TextStyleDanmakuItem from './components/danmaku/TextStyleDanmakuItem.vue'
import { useDanmakuWindow } from './store/useDanmakuWindow'

const props = defineProps<BaseDanmakuItemProps>()

// 使用工具函数获取基础计算属性
const emojiData = useDanmakuWindow().emojiData
const { typeClass } = useDanmakuUtils(props, emojiData)
</script>

<template>
  <div
    class="danmaku-item-content" :class="[typeClass]"
    :data-disappear="item.disappearAt"
  >
    <!-- 根据设置选择显示风格 -->
    <CardStyleDanmakuItem
      v-if="setting.displayStyle === 'card'"
      :item="item"
      :setting="setting"
    />

    <TextStyleDanmakuItem
      v-else-if="setting.displayStyle === 'text' || !setting.displayStyle"
      :item="item"
      :setting="setting"
    />
  </div>
</template>

<style scoped>
  /* 基础布局 */
  .danmaku-item-content {
    display: flex;
    width: 100%;
    overflow: hidden;
    will-change: transform, opacity;
    margin-bottom: var(--dw-item-spacing, 4px);
    padding: 0;
    background: none;
    border-radius: 0;
    box-shadow: none;
    min-height: 0;
    font-size: var(--dw-font-size);
    color: var(--dw-text-color);
  }
</style>
