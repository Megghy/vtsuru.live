<script setup lang="ts">
import type { BaseDanmakuItemProps } from './danmakuUtils'
import { AVATAR_URL } from '@/shared/config'
import { useDanmakuWindow } from '../../store/useDanmakuWindow'
import { useDanmakuUtils } from './danmakuUtils'

// 继承基础属性
const props = defineProps<BaseDanmakuItemProps>()

// 使用工具函数获取所有计算属性
const emojiData = useDanmakuWindow().emojiData
const danmakuUtils = useDanmakuUtils(props, emojiData)

// 直接从工具函数获取计算属性，不再需要getBaseProp方法
const {
  showAvatar,
  typeLabel,
  guardColor,
  displayName,
  displayContent,
  giftDisplay,
  priceText,
  textModeColor,
  parsedMessage,
} = danmakuUtils
</script>

<template>
  <div
    class="danmaku-text-mode"
    :class="{ compact: setting.textStyleCompact }"
  >
    <!-- 头像 -->
    <img
      v-if="showAvatar && item?.uface"
      :src="item?.uface + (item.uface.startsWith(AVATAR_URL) ? '?size=64' : '@64w')"
      alt="avatar"
      class="avatar-text-mode"
      referrerpolicy="no-referrer"
    >

    <!-- 消息类型标签 -->
    <span
      v-if="setting.textStyleShowType && typeLabel"
      class="text-mode-type"
      :style="{ color: textModeColor }"
    >{{ typeLabel }}</span>

    <!-- 舰长标识 -->
    <span
      v-if="item.guard_level && item.guard_level > 0 && setting.showGuardIcon"
      class="guard-icon-text-mode"
      :style="{ backgroundColor: guardColor }"
    />

    <!-- 用户名 -->
    <span
      v-if="setting.showUsername"
      class="username-text-mode"
      :style="{ color: textModeColor }"
    >{{ displayName }}</span>

    <!-- 分隔符 -->
    <span
      v-if="setting.showUsername && displayContent"
      class="separator-text-mode"
    >{{ setting.textStyleNameSeparator }}</span>

    <NTooltip v-if="giftDisplay.hasMysteryBoxGift">
      <template #trigger>
        <span
          class="mystery-box-text-mode"
          :style="{ color: textModeColor }"
        >盲盒 ￥{{ giftDisplay.mysteryBoxPriceText }}</span>
      </template>
      <div class="mystery-box-text-tooltip">
        <div
          v-if="giftDisplay.mysteryBoxName"
          class="mystery-box-text-tooltip__row"
        >
          <span class="mystery-box-text-tooltip__label">来源</span>
          <span class="mystery-box-text-tooltip__value">{{ giftDisplay.mysteryBoxName }}</span>
        </div>
        <div
          v-if="giftDisplay.mysteryBoxPriceText"
          class="mystery-box-text-tooltip__row"
        >
          <span class="mystery-box-text-tooltip__label">盲盒价</span>
          <span class="mystery-box-text-tooltip__value">￥{{ giftDisplay.mysteryBoxPriceText }}</span>
        </div>
        <div
          v-if="giftDisplay.giftPriceText"
          class="mystery-box-text-tooltip__row"
        >
          <span class="mystery-box-text-tooltip__label">开出价</span>
          <span class="mystery-box-text-tooltip__value">￥{{ giftDisplay.giftPriceText }}</span>
        </div>
      </div>
    </NTooltip>

    <!-- 价格信息(如果有) -->
    <span
      v-if="priceText"
      class="price-text-mode"
      :style="{ color: textModeColor }"
    >{{ priceText }} </span>

    <!-- 消息内容 -->
    <template v-if="item.type === 0">
      <span
        v-if="!item.emoji && parsedMessage.length > 0"
        class="content-text-mode"
      >
        <template
          v-for="(segment, index) in parsedMessage"
          :key="index"
        >
          <span v-if="segment.type === 'text'">{{ segment.content }}</span>
          <img
            v-else-if="segment.type === 'emoji'"
            :src="`${segment.url}@64w`"
            :alt="segment.name"
            class="inline-emoji-text-mode"
            referrerpolicy="no-referrer"
          >
        </template>
      </span>
      <span
        v-else-if="item.emoji"
        class="content-text-mode"
      >
        <img
          :src="`${item.emoji}@64w`"
          alt="emoji"
          class="emoji-image-text-mode"
          referrerpolicy="no-referrer"
        >
      </span>
      <span
        v-else
        class="content-text-mode"
      >{{ displayContent }}</span>
    </template>
    <span
      v-else
      class="content-text-mode"
    >{{ displayContent }}</span>
  </div>
</template>

<style scoped>
/* --- 纯文本风格样式 --- */
.danmaku-text-mode {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  width: 100%;
  padding: 4px 8px;
  background-color: rgba(var(--dw-bg-color-rgb, 0, 0, 0), calc(0.6 * var(--dw-opacity, 1)));
  border-radius: var(--dw-border-radius);
  line-height: 1.4;
  gap: 2px;
  box-sizing: border-box; /* 确保padding不会增加元素的实际尺寸 */
  margin-bottom: 1px; /* 减少底部边距，防止溢出 */
}

.danmaku-text-mode.compact {
  padding: 2px 6px;
  line-height: 1.2;
}

.avatar-text-mode {
  border-radius: 50%;
  width: calc(var(--dw-font-size) * 1.5);
  height: calc(var(--dw-font-size) * 1.5);
  margin-right: 4px;
  flex-shrink: 0;
}

.text-mode-type {
  font-weight: bold;
  margin-right: 4px;
  flex-shrink: 0;
  opacity: 1; /* 确保文本完全不透明 */
}

.guard-icon-text-mode {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 4px;
  flex-shrink: 0;
}

.username-text-mode {
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
  flex-shrink: 0;
  opacity: 1; /* 确保文本完全不透明 */
}

.separator-text-mode {
  white-space: nowrap;
  margin-right: 4px;
  flex-shrink: 0;
  opacity: 1; /* 确保文本完全不透明 */
}

.price-text-mode {
  font-weight: bold;
  margin-right: 4px;
  flex-shrink: 0;
  opacity: 1; /* 确保文本完全不透明 */
}

.mystery-box-text-mode {
  display: inline-flex;
  align-items: center;
  padding: 0 6px;
  margin-right: 4px;
  border-radius: 999px;
  background: rgba(192, 120, 16, 0.14);
  font-weight: 700;
  font-size: 0.92em;
  cursor: help;
  opacity: 1;
}

.mystery-box-text-tooltip {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 160px;
}

.mystery-box-text-tooltip__row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.mystery-box-text-tooltip__label {
  color: var(--n-text-color-3);
}

.mystery-box-text-tooltip__value {
  text-align: right;
  word-break: break-all;
}

.content-text-mode {
  word-break: break-word;
  flex-grow: 1;
  opacity: 1; /* 确保文本完全不透明 */
}

.inline-emoji-text-mode {
  vertical-align: middle;
  height: calc(var(--dw-font-size) * 1.2);
  margin: 0 1px;
}

.emoji-image-text-mode {
  vertical-align: middle;
  height: var(--dw-emoji-size);
}
</style>
