<script setup lang="ts">
  import { EventDataTypes, EventModel } from '@/api/api-models';
  import { NSpin } from 'naive-ui';
  import { DANMAKU_WINDOW_BROADCAST_CHANNEL, DanmakuWindowBCData, DanmakuWindowSettings } from './store/useDanmakuWindow';
  import { nanoid } from 'nanoid';
  import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
  import ClientDanmakuItem from './ClientDanmakuItem.vue';

  type TempDanmakuType = EventModel & {
    randomId: string;
    isNew?: boolean; // 添加：标记是否为新弹幕
    disappearAt?: number; // 消失时间戳
  };

  let bc: BroadcastChannel | undefined = undefined;
  const setting = ref<DanmakuWindowSettings>();
  const danmakuList = ref<TempDanmakuType[]>([]);
  const maxItems = computed(() => setting.value?.maxDanmakuCount || 50);
  const hasItems = computed(() => danmakuList.value.length > 0);

  // 动态设置CSS变量
  function updateCssVariables() {
    if (!setting.value) return;

    const root = document.documentElement;
    root.style.setProperty('--dw-direction', setting.value.reverseOrder ? 'column-reverse' : 'column');

    // 背景和文字颜色
    root.style.setProperty('--dw-bg-color', setting.value.backgroundColor || 'rgba(0,0,0,0.6)');
    root.style.setProperty('--dw-text-color', setting.value.textColor || '#ffffff');

    // 尺寸相关
    root.style.setProperty('--dw-border-radius', `${setting.value.borderRadius || 0}px`);
    root.style.setProperty('--dw-opacity', `${setting.value.opacity || 1}`);
    root.style.setProperty('--dw-font-size', `${setting.value.fontSize || 14}px`);
    root.style.setProperty('--dw-avatar-size', `${(setting.value.fontSize || 14) + 6}px`);
    root.style.setProperty('--dw-emoji-size', `${(setting.value.fontSize || 14) + 10}px`);
    root.style.setProperty('--dw-item-spacing', `${setting.value.itemSpacing || 5}px`);

    // 动画和阴影
    root.style.setProperty('--dw-animation-duration', `${setting.value.animationDuration || 300}ms`);
    root.style.setProperty('--dw-shadow', setting.value.enableShadow ? `0 0 10px ${setting.value.shadowColor}` : 'none');
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

    // 计算消失时间
    let disappearAt: number | undefined = undefined;
    if (setting.value.autoDisappearTime > 0) {
      disappearAt = Date.now() + setting.value.autoDisappearTime * 1000;
    }

    // 为传入的弹幕对象添加一个随机ID和isNew标记
    const dataWithId = {
      ...data,
      randomId: nanoid(), // 生成一个随机ID
      disappearAt, // 添加消失时间
      isNew: true, // 标记为新弹幕，用于动画
    };

    danmakuList.value.unshift(dataWithId);
    // Limit the list size AFTER adding the new item
    while (danmakuList.value.length > maxItems.value) {
      danmakuList.value.pop();
    }

    // 设置一个定时器，在动画完成后移除isNew标记
    setTimeout(() => {
      const index = danmakuList.value.findIndex(item => item.randomId === dataWithId.randomId);
      if (index !== -1) {
        danmakuList.value[index].isNew = false;
      }
    }, setting.value.animationDuration || 300);

    console.log('[DanmakuWindow] 添加弹幕:', dataWithId);
  }

  // 检查和移除过期弹幕
  function checkAndRemoveExpiredDanmaku() {
    if (!setting.value || setting.value.autoDisappearTime <= 0) return;

    const now = Date.now();
    // 让弹幕有足够时间完成消失动画后再从列表中移除
    danmakuList.value = danmakuList.value.filter(item => {
      // 如果设置了消失时间，则在消失时间+动画时长后才真正移除
      const animationDuration = setting.value?.animationDuration || 300;
      return !item.disappearAt || (item.disappearAt + animationDuration) > now;
    });
  }

  // 为弹幕项生成自定义属性值
  function getSCColorAttribute(price: number): string {
    if (price === 0) return `sc-0`;
    if (price > 0 && price < 50) return `sc-50`;
    if (price >= 50 && price < 100) return `sc-100`;
    if (price >= 100 && price < 500) return `sc-500`;
    if (price >= 500 && price < 1000) return `sc-1000`;
    if (price >= 1000 && price < 2000) return `sc-2000`;
    if (price >= 2000) return `sc-max`;
    return '';
  }

  onMounted(() => {
    bc = new BroadcastChannel(DANMAKU_WINDOW_BROADCAST_CHANNEL);
    console.log(`[DanmakuWindow] BroadcastChannel 已创建: ${DANMAKU_WINDOW_BROADCAST_CHANNEL}`);
    bc.postMessage({
      type: 'window-ready',
    });
    bc.onmessage = (event) => {
      const data = event.data as DanmakuWindowBCData;
      switch (data.type) {
        case 'danmaku':
          addDanmaku(data.data);
          break;
        case 'test-danmaku': // 处理测试弹幕
          addDanmaku(data.data);
          break;
        case 'update-setting':
          setting.value = data.data;
          updateCssVariables();
          console.log('[DanmakuWindow] 设置已更新:', data.data);
          break;
        case 'clear-danmaku': // 处理清空弹幕
          danmakuList.value = [];
          console.log('[DanmakuWindow] 弹幕已清空');
          break;
      }
    };

    // 初始化CSS变量
    updateCssVariables();

    // 启动定时器，定期检查过期弹幕
    const checkInterval = setInterval(checkAndRemoveExpiredDanmaku, 1000);

    onUnmounted(() => {
      if (bc) {
        bc.close();
        bc = undefined;
      }
      clearInterval(checkInterval);
    });
  });

  // 监听设置变化
  watch(() => setting.value, () => {
    updateCssVariables();
  }, { deep: true });
</script>

<template>
  <NSpin
    v-if="!setting"
    show
  />

  <div
    v-else
    class="danmaku-window"
    :class="{ 'has-items': hasItems }"
  >
    <div
      ref="scrollContainerRef"
      class="danmaku-list"
    >
      <!-- 移除 TransitionGroup，使用普通 div -->
      <div class="danmaku-list-container">
        <div
          v-for="item in danmakuList"
          :key="item.randomId"
          :data-type="item.type"
          class="danmaku-item"
          :class="{ 'danmaku-item-new': item.isNew }"
        >
          <ClientDanmakuItem
            :item="item"
            :setting="setting"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style>
  html,
  body {
    background: transparent;
    overflow: hidden;
  }

  .n-layout {
    background: transparent;
  }

  :root {
    --dw-bg-color: rgba(0, 0, 0, 0.6);
    --dw-text-color: #ffffff;
    --dw-border-radius: 0px;
    --dw-opacity: 1;
    --dw-font-size: 14px;
    --dw-avatar-size: 20px;
    --dw-emoji-size: 24px;
    --dw-item-spacing: 5px;
    --dw-animation-duration: 300ms;
    --dw-shadow: none;
  }

  .danmaku-window {
    -webkit-app-region: drag;
    overflow: hidden;
    background-color: transparent; /* 完全透明背景 */
    width: 100%;
    height: 100%;
    color: var(--dw-text-color);
    font-size: var(--dw-font-size);
    box-shadow: var(--dw-shadow);
    overflow-x: hidden;
    transition: opacity 0.3s ease;
  }

  /* 没有弹幕时完全透明 */
  .danmaku-window:not(.has-items) {
    opacity: 0;
  }

  .danmaku-list {
    padding: 8px;
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: var(--dw-direction);
    box-sizing: border-box; /* 确保padding不会增加元素的实际尺寸 */
  }

  .danmaku-list-container {
    width: 100%;
    display: flex;
    flex-direction: inherit;
    gap: var(--dw-item-spacing);
    padding-bottom: 8px; /* 添加底部内边距以防止项目溢出 */
    box-sizing: border-box; /* 确保padding不会增加元素的实际尺寸 */
  }

  .danmaku-list.reverse {
    flex-direction: column-reverse;
  }

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

  /* 弹幕进入动画 */
  .danmaku-item {
    transform-origin: center left;
    transition: all var(--dw-animation-duration) ease;
  }

  .danmaku-item-new {
    animation: danmaku-in var(--dw-animation-duration) ease-out forwards;
  }

  @keyframes danmaku-in {
    from {
      opacity: 0;
      transform: translateX(-20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes danmaku-out {
    from {
      opacity: 1;
      transform: translateX(0);
    }
    to {
      opacity: 0;
      transform: translateX(20px);
    }
  }
</style>