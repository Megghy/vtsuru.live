<script setup lang="ts">
import { storeToRefs } from 'pinia'

import { useLiveEmoji } from '@/store/useLiveEmoji'

import CardStyleDanmakuItem from './CardStyleDanmakuItem.vue'
import type { BaseDanmakuItemProps } from './danmakuUtils'
import { useDanmakuUtils } from './danmakuUtils'
import TextStyleDanmakuItem from './TextStyleDanmakuItem.vue'

const props = defineProps<BaseDanmakuItemProps>()

// 使用工具函数获取基础计算属性
const { emojiData } = storeToRefs(useLiveEmoji())
const { typeClass } = useDanmakuUtils(props, emojiData)
</script>

<template>
  <div
    class="flex w-full p-0 bg-transparent"
    :class="[typeClass]"
    :data-disappear="item.disappearAt"
    :style="{
      fontSize: 'var(--dw-font-size)',
      color: 'var(--dw-text-color)',
    }"
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
