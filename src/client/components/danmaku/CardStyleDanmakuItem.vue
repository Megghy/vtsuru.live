<script setup lang="ts">
import type { BaseDanmakuItemProps } from './danmakuUtils'
import { VehicleShip24Filled } from '@vicons/fluent'
import { EventDataTypes } from '@/api/api-models'
import { AVATAR_URL } from '@/data/constants'
import { useDanmakuWindow } from '../../store/useDanmakuWindow'
import { useDanmakuUtils } from './danmakuUtils'

// 继承基础属性
const props = defineProps<BaseDanmakuItemProps>()

// 使用工具函数获取所有计算属性
const emojiData = useDanmakuWindow().emojiData
const danmakuUtils = useDanmakuUtils(props, emojiData)

// 直接从工具函数获取计算属性，不再需要getBaseProp方法
const {
  typeClass,
  guardLevelClass,
  showAvatar,
  guardColor,
  scColorClass,
  parsedMessage,
  medalColor,
} = danmakuUtils
</script>

<template>
  <!-- 卡片样式：SC、礼物、上舰 -->
  <template
    v-if="item.type === EventDataTypes.SC || item.type === EventDataTypes.Gift || item.type === EventDataTypes.Guard"
  >
    <div
      class="danmaku-card"
      :class="[typeClass, guardLevelClass]"
    >
      <div class="card-header">
        <img
          v-if="showAvatar && item?.uface"
          :src="item?.uface + (item.uface.startsWith(AVATAR_URL) ? '?size=64' : '@64w')"
          alt="avatar"
          class="avatar"
          referrerpolicy="no-referrer"
        >
        <span
          class="username"
          :style="{ color: item.type === EventDataTypes.SC ? '#222' : '#fff' }"
        >
          {{ item?.uname || '匿名用户' }}
        </span>
        <!-- 卡片右侧徽章 -->
        <template v-if="item.type === EventDataTypes.SC">
          <span
            class="sc-badge"
            :class="scColorClass"
          >
            ￥{{ item?.price || 0 }}
          </span>
        </template>
        <template v-else-if="item.type === EventDataTypes.Gift">
          <span
            class="gift-badge"
            :isPay="item?.price > 0"
          >
            {{ item?.num || 1 }} × {{ item?.msg }}
            <span
              v-if="item?.price"
              class="gift-price"
            >￥{{ (item.price || 0).toFixed(1) }}</span>
          </span>
        </template>
        <template v-else-if="item.type === EventDataTypes.Guard">
          <span
            class="guard-badge"
            :style="{ backgroundColor: guardColor }"
          >
            {{ item?.guard_level === 1 ? '总督' : item?.guard_level === 2 ? '提督' : '舰长' }}
            <span
              v-if="item?.num && item?.num > 1"
              class="guard-num"
            >x{{ item?.num }}</span>
          </span>
        </template>
      </div>
      <div
        v-if="item.type === EventDataTypes.SC && item?.msg"
        class="card-content"
      >
        <span class="sc-content">{{ item?.msg }}</span>
      </div>
    </div>
  </template>

  <!-- 普通消息/入场消息：改为卡片样式以保持一致性 -->
  <template v-else>
    <div class="danmaku-card message-card">
      <div class="card-header">
        <img
          v-if="showAvatar && item?.uface"
          :src="item?.uface + (item.uface.startsWith(AVATAR_URL) ? '?size=64' : '@64w')"
          alt="avatar"
          class="avatar"
          referrerpolicy="no-referrer"
        >
        <span
          class="username"
          :style="{ color: '#fff' }"
        >
          {{ item?.uname || '匿名用户' }}
        </span>
        <span
          v-if="item.guard_level && item.guard_level > 0"
          class="guard-icon"
          :style="{ backgroundColor: guardColor }"
        >
          <NIcon
            :component="VehicleShip24Filled"
            size="12"
          />
        </span>
        <!-- 添加粉丝勋章显示 -->
        <span
          v-if="setting.showFansMedal && item.fans_medal_wearing_status && item.fans_medal_level > 0"
          class="fans-medal"
          :style="{ backgroundColor: medalColor }"
        >
          <span class="medal-name">{{ item.fans_medal_name }}</span>
          <span
            class="medal-level"
            :style="{ backgroundColor: `${medalColor}CC` }"
          >{{ item.fans_medal_level }}</span>
        </span>
        <template v-if="item.type === EventDataTypes.Enter">
          <span class="enter-badge">进入了直播间</span>
        </template>
        <template v-else-if="item.type === EventDataTypes.Like">
          <span class="like-badge">❤️ 点赞了</span>
        </template>
      </div>
      <div
        v-if="item.type === EventDataTypes.Message && (item?.msg || parsedMessage.length > 0 || item.emoji)"
        class="card-content"
      >
        <span
          v-if="!item.emoji && parsedMessage.length > 0"
          class="message-text"
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
              class="inline-emoji"
              referrerpolicy="no-referrer"
            >
          </template>
        </span>
        <span
          v-else-if="item.emoji"
          class="message-text"
        >
          <img
            :src="`${item.emoji}@64w`"
            alt="emoji"
            class="emoji-image"
            referrerpolicy="no-referrer"
          >
        </span>
        <span
          v-else
          class="message-text"
        >{{ item?.msg }}</span>
      </div>
    </div>
  </template>
</template>

<style scoped>
/* 头像 */
  .avatar {
    flex-shrink: 0;
    border-radius: 50%;
    margin-right: 6px;
    width: var(--dw-avatar-size);
    height: var(--dw-avatar-size);
    object-fit: cover;
    vertical-align: middle;
  }

  /* 用户名 */
  .username {
    font-weight: bold;
    margin-right: 6px;
    word-break: keep-all;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 120px;
    flex-shrink: 0;
    vertical-align: middle;
  }

  /* 内联表情 */
  .inline-emoji {
    vertical-align: middle;
    height: calc(var(--dw-font-size) * 1.4);
    margin: 0 1px;
  }

  /* 纯表情消息 */
  .emoji-image {
    vertical-align: middle;
    height: var(--dw-emoji-size, 32px);
  }

  /* --- 卡片样式 --- */
  .danmaku-card {
    border-radius: var(--dw-border-radius, 8px);
    padding: 6px 10px;
    margin: 2px 0;
    display: flex;
    flex-direction: column;
    width: 100%;
    border-left: 3px solid transparent;
    background-color: rgba(0, 0, 0, calc(0.6 * var(--dw-opacity, 1)));
    transition: background-color 0.2s;
    box-sizing: border-box; /* 确保padding不会增加元素的实际尺寸 */
  }

  /* SC 卡片 */
  .sc-item .danmaku-card {
    border-left-color: #E6A23C;
    background: linear-gradient(
      90deg,
      rgba(255, 243, 224, calc(0.85 * var(--dw-opacity, 1))) 0%,
      rgba(255, 224, 178, calc(0.85 * var(--dw-opacity, 1))) 100%
    );
  }

  .sc-item .username {
    color: #A0522D;
  }

  .sc-item .card-content {
    color: #A0522D;
  }

  /* 礼物 卡片 */
  .gift-item .danmaku-card {
    border-left-color: #F56C6C;
    background: linear-gradient(
      90deg,
      rgba(255, 234, 234, calc(0.85 * var(--dw-opacity, 1))) 0%,
      rgba(255, 240, 240, calc(0.85 * var(--dw-opacity, 1))) 100%
    );
    /* 礼物卡片垂直居中 */
    justify-content: center;
    min-height: 40px;
  }

  .gift-item .username {
    color: #C04848;
  }

  /* 上舰 卡片 */
  .guard-item .danmaku-card {
    border-left-color: var(--guard-color, #673AB7);
    background: linear-gradient(
      90deg,
      rgba(243, 234, 255, calc(0.85 * var(--dw-opacity, 1))) 0%,
      rgba(237, 231, 246, calc(0.85 * var(--dw-opacity, 1))) 100%
    );
  }

  .guard-item .username {
    color: var(--guard-color, #673AB7);
  }

  .card-header {
    display: flex;
    align-items: center;
    margin-bottom: 4px;
    min-height: var(--dw-avatar-size);
  }

  /* 礼物卡片头部特殊处理 */
  .gift-item .card-header {
    margin-bottom: 0;
  }

  .card-content {
    font-size: 0.95em;
    word-break: break-word;
    margin-left: calc(var(--dw-avatar-size) + 6px);
    line-height: 1.4;
  }

  /* SC 徽章 */
  .sc-badge {
    font-weight: bold;
    font-size: 0.85em;
    border-radius: 4px;
    padding: 1px 6px;
    color: #fff;
    margin-left: auto;
    background: #E6A23C;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    white-space: nowrap;
  }

  /* SC 不同价格颜色 */
  .sc-50 {
    background: #E6A23C;
  }

  .sc-100 {
    background: #F56C6C;
  }

  .sc-500 {
    background: #f56c6c;
  }

  .sc-1000 {
    background: #d32f2f;
  }

  .sc-2000 {
    background: #7b1fa2;
  }

  .sc-max {
    background: #212121;
  }

  /* 礼物 徽章 */
  .gift-badge {
    background: #6aa8a3;
    color: #fff;
    border-radius: 4px;
    padding: 1px 6px;
    font-weight: bold;
    font-size: 0.85em;
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }
  .gift-badge[isPay="true"] {
    background: #F56C6C;
  }

  .gift-price {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
    padding: 0 4px;
    font-size: 0.9em;
    margin-left: 4px;
  }

  /* 上舰 徽章 */
  .guard-badge {
    color: #fff;
    font-weight: bold;
    border-radius: 4px;
    padding: 1px 6px;
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.85em;
    white-space: nowrap;
  }

  .guard-num {
    font-size: 0.9em;
    opacity: 0.8;
    margin-left: 2px;
  }

  /* --- 极简单行弹幕 --- */
  .danmaku-simple-row {
    display: none;
  }

  /* --- 普通消息卡片样式 --- */
  .message-card {
    border-left-color: #409EFF;
    background: linear-gradient(
      90deg,
      rgba(40, 40, 40, calc(0.85 * var(--dw-opacity, 1))) 0%,
      rgba(30, 30, 30, calc(0.85 * var(--dw-opacity, 1))) 100%
    );
  }

  .guard-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 4px;
    margin-left: 4px;
    flex-shrink: 0;
  }

  /* 粉丝勋章样式 */
  .fans-medal {
    display: flex;
    align-items: center;
    border-radius: 4px;
    margin-left: 4px;
    font-size: 0.75em;
    height: 16px;
    overflow: hidden;
    flex-shrink: 0;
  }

  .medal-name {
    padding: 0 3px;
    color: #fff;
    max-width: 40px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    background-color: rgba(255, 255, 255, 0.2);
  }

  .medal-level {
    padding: 0 3px;
    color: #fff;
    font-weight: bold;
  }

  .enter-badge {
    color: #67C23A;
    font-size: 0.85em;
    font-weight: 500;
    padding: 1px 6px;
    background-color: rgba(103, 194, 58, 0.1);
    border-radius: 4px;
    margin-left: auto;
    white-space: nowrap;
  }

  .message-text {
    color: var(--dw-text-color);
    word-break: break-all;
    white-space: normal;
  }

  .like-badge {
    color: #F56C6C;
    font-size: 0.85em;
    font-weight: 500;
    padding: 1px 6px;
    background-color: rgba(245, 108, 108, 0.1);
    border-radius: 4px;
    margin-left: auto;
    white-space: nowrap;
  }
</style>
