<script setup lang="ts">
import { useDanmakuClient } from '@/store/useDanmakuClient';
import { DANMAKU_WINDOW_BROADCAST_CHANNEL, DanmakuWindowBCData, DanmakuWindowSettings } from './store/useDanmakuWindow';
import { NSpin, NEmpty, NIcon } from 'naive-ui';
import { EventDataTypes, EventModel } from '@/api/api-models';
// Import nextTick
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue';
import { TransitionGroup } from 'vue';
import { Money24Regular, VehicleShip24Filled } from '@vicons/fluent';

let bc: BroadcastChannel | undefined = undefined;
const setting = ref<DanmakuWindowSettings>();
const danmakuList = ref<EventModel[]>([]);
const maxItems = computed(() => setting.value?.maxDanmakuCount || 50);
// Ref for the scroll container
const scrollContainerRef = ref<HTMLElement | null>(null);

const isConnected = computed(() => {
  return setting.value !== undefined;
});

function GetSCColor(price: number): string {
  if (price === 0) return `#2a60b2`;
  if (price > 0 && price < 50) return `#2a60b2`;
  if (price >= 50 && price < 100) return `#427d9e`;
  if (price >= 100 && price < 500) return `#c99801`;
  if (price >= 500 && price < 1000) return `#e09443`;
  if (price >= 1000 && price < 2000) return `#e54d4d`;
  if (price >= 2000) return `#ab1a32`;
  return '';
}

function GetGuardColor(level: number | null | undefined): string {
  if (level) {
    switch (level) {
      case 1: return 'rgb(122, 4, 35)';
      case 2: return 'rgb(157, 155, 255)';
      case 3: return 'rgb(104, 136, 241)';
    }
  }
  return '';
}

function formatUsername(item: EventModel): string {
  let result = item.name;
  if (setting.value?.showFansMedal && item.fans_medal_wearing_status) {
    result = `[${item.fans_medal_name} ${item.fans_medal_level}] ${result}`;
  }
  return result;
}

function addDanmaku(data: EventModel) {
  if (!setting.value) return;

  // Map EventDataTypes enum values to the string values used in filterTypes
  const typeToStringMap: { [key in EventDataTypes]?: string } = {
    [EventDataTypes.Message]: "Message",
    [EventDataTypes.Gift]: "Gift",
    [EventDataTypes.SC]: "SC",
    [EventDataTypes.Guard]: "Guard",
    [EventDataTypes.Enter]: "Enter"
  };

  const typeStr = typeToStringMap[data.type];

  // Check if the type should be filtered out
  if (!typeStr || !setting.value.filterTypes.includes(typeStr)) {
    return; // Don't add if filtered
  }

  // --- Auto Scroll Logic ---
  const el = scrollContainerRef.value;
  let shouldScroll = false;
  if (el) {
    const threshold = 5; // Pixels threshold to consider "at the end"
    if (setting.value?.reverseOrder) {
      // Check if scrolled to the top before adding
      shouldScroll = el.scrollTop <= threshold;
    } else {
      // Check if scrolled to the bottom before adding
      shouldScroll = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
    }
  }
  // --- End Auto Scroll Logic ---


  // Maintain max message count
  if (setting.value.reverseOrder) {
    danmakuList.value.unshift(data);
    if (danmakuList.value.length > maxItems.value) {
      danmakuList.value.pop();
    }
  } else {
    danmakuList.value.push(data);
    if (danmakuList.value.length > maxItems.value) {
      danmakuList.value.shift();
    }
  }

  // --- Auto Scroll Execution ---
  if (shouldScroll && el) {
    nextTick(() => {
      if (setting.value?.reverseOrder) {
        el.scrollTop = 0; // Scroll to top
      } else {
        el.scrollTop = el.scrollHeight; // Scroll to bottom
      }
    });
  }
  // --- End Auto Scroll Execution ---
}

onMounted(() => {
  bc = new BroadcastChannel(DANMAKU_WINDOW_BROADCAST_CHANNEL);
  console.log(`[DanmakuWindow] BroadcastChannel 已创建: ${DANMAKU_WINDOW_BROADCAST_CHANNEL}`);
  bc.postMessage({
    type: 'window-ready',
  })
  bc.onmessage = (event) => {
    const data = event.data as DanmakuWindowBCData;
    switch (data.type) {
      case 'danmaku':
        addDanmaku(data.data); // addDanmaku now handles scrolling
        // console.log('[DanmakuWindow] 收到弹幕:', data.data); // Keep console logs minimal if not debugging
        break;
      case 'update-setting':
        setting.value = data.data;
        console.log('[DanmakuWindow] 设置已更新:', data.data);
        // Adjust scroll on setting change if needed (e.g., reverseOrder changes)
        nextTick(() => {
            const el = scrollContainerRef.value;
            if (el) {
                if (setting.value?.reverseOrder) {
                    el.scrollTop = 0;
                } else {
                    el.scrollTop = el.scrollHeight;
                }
            }
        });
        break;
    }
  };

  // Dispatch a request for settings
  bc.postMessage({ type: 'request-settings' });
});

onUnmounted(() => {
  if (bc) {
    bc.close();
    bc = undefined;
  }
});

// 格式化弹幕消息
function formatMessage(item: EventModel): string {
  switch(item.type) {
    case EventDataTypes.Message:
      return item.msg;
    case EventDataTypes.Gift:
      return `${item.msg} ${item.num > 1 ? 'x'+item.num : ''}`;
    case EventDataTypes.SC:
      return item.msg;
    case EventDataTypes.Guard:
      return `开通了${item.guard_level === 1 ? '总督' : item.guard_level === 2 ? '提督' : '舰长'}`;
    case EventDataTypes.Enter:
      return '进入直播间';
    default:
      return item.msg;
  }
}
</script>

<template>
  <NSpin
    v-if="!isConnected"
    show
  />

  <div
    v-else
    class="danmaku-window"
    :style="{
      backgroundColor: setting?.backgroundColor || 'rgba(0,0,0,0.6)',
      width: '100%',
      height: '100%',
      borderRadius: `${setting?.borderRadius || 0}px`,
      opacity: setting?.opacity || 1,
      color: setting?.textColor || '#ffffff',
      fontSize: `${setting?.fontSize || 14}px`,
      overflow: 'hidden',
      boxShadow: setting?.enableShadow ? `0 0 10px ${setting?.shadowColor}` : 'none'
    }"
  >
    <TransitionGroup
      ref="scrollContainerRef"
      :class="['danmaku-list', {'reverse': setting?.reverseOrder}]"
      name="danmaku-list"
      tag="div"
      :style="{
        padding: '8px',
        height: '100%',
        overflowY: 'auto',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: setting?.reverseOrder ? 'column-reverse' : 'column'
      }"
    >
      <div
        v-for="(item, index) in danmakuList"
        :key="`${item.time}-${index}`"
        :data-type="item.type"
        class="danmaku-item"
        :style="{
          marginBottom: `${setting?.itemSpacing || 5}px`,
          padding: '6px',
          borderRadius: '4px',
          backgroundColor: item.type === EventDataTypes.SC ? GetSCColor(item.price) : 'transparent',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          color: item.type === EventDataTypes.SC ? '#ffffff' : undefined,
          transition: `all ${setting?.animationDuration || 300}ms ease`
        }"
      >
        <!-- 头像 -->
        <img
          v-if="setting?.showAvatar && item.uface"
          :src="item.uface"
          class="avatar"
          :style="{
            width: `${setting?.fontSize + 6 || 20}px`,
            height: `${setting?.fontSize + 6 || 20}px`,
            borderRadius: '50%',
            marginRight: '6px'
          }"
          referrerpolicy="no-referrer"
        >

        <!-- 用户名 -->
        <div
          v-if="setting?.showUsername"
          class="username"
          :style="{
            fontWeight: 'bold',
            marginRight: '6px',
          }"
        >
          <!-- 舰长图标 -->
          <NIcon
            v-if="setting?.showGuardIcon && item.guard_level > 0"
            :component="VehicleShip24Filled"
            :color="GetGuardColor(item.guard_level)"
            :size="setting?.fontSize"
            style="margin-right: 2px; vertical-align: middle;"
          />
          {{ formatUsername(item) }}:
        </div>

        <!-- 消息内容 -->
        <div class="message">
          <!-- SC/礼物金额 -->
          <NIcon
            v-if="(item.type === EventDataTypes.Gift || item.type === EventDataTypes.SC) && item.price > 0"
            :component="Money24Regular"
            :color="item.type === EventDataTypes.SC ? '#ffffff' : '#dd2f2f'"
            :size="setting?.fontSize"
            style="margin-right: 4px; vertical-align: middle;"
          />
          <span v-if="(item.type === EventDataTypes.Gift || item.type === EventDataTypes.SC) && item.price > 0">
            {{ item.price }}￥
          </span>

          <!-- 消息内容 -->
          {{ formatMessage(item) }}
        </div>
      </div>

      <div
        v-if="danmakuList.length === 0"
        key="empty"
        style="display: flex; align-items: center; justify-content: center; height: 100%;"
      >
        <NEmpty description="暂无弹幕" />
      </div>
    </TransitionGroup>
  </div>
</template>

<style>
html, body{
  background: transparent;
}

.danmaku-list-enter-active,
.danmaku-list-leave-active {
  transition: all 0.3s ease;
}

.danmaku-list-enter-from {
  opacity: 0;
  transform: translateY(30px);
}

.danmaku-list-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

/* 滚动条样式 */
.danmaku-list::-webkit-scrollbar {
  width: 4px;
}

.danmaku-list::-webkit-scrollbar-track {
  background: transparent;
}

.danmaku-list::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.3);
  border-radius: 4px;
}

/* 拖动窗口时用于指示 */
.danmaku-window {
  -webkit-app-region: drag;
}

.danmaku-item {
  -webkit-app-region: no-drag;
}

/* 根据消息类型添加特殊样式 */
.danmaku-item[data-type="2"] { /* Gift */
  color: #dd2f2f;
}

.danmaku-item[data-type="0"] { /* Guard */
  color: #9d78c1;
}

.danmaku-item[data-type="3"] { /* Guard */
  color: #9d78c1;
}

.danmaku-item[data-type="4"] { /* Enter */
  color: #4caf50;
}
</style>