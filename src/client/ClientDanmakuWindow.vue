<script setup lang="ts">
  import { EventDataTypes, EventModel } from '@/api/api-models';
  import { NSpin } from 'naive-ui';
  import { DANMAKU_WINDOW_BROADCAST_CHANNEL, DanmakuWindowBCData, DanmakuWindowSettings } from './store/useDanmakuWindow';
  import { nanoid } from 'nanoid';
  import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue';
  import ClientDanmakuItem from './ClientDanmakuItem.vue';
  import { TransitionGroup } from 'vue'; // 添加TransitionGroup导入

  type TempDanmakuType = EventModel & {
    randomId: string;
    disappearAt?: number; // 消失时间戳
    timestamp?: number; // 添加：记录插入时间戳
  };

  let bc: BroadcastChannel | undefined = undefined;
  const setting = ref<DanmakuWindowSettings>();
  const danmakuList = ref<TempDanmakuType[]>([]);
  const pendingDanmakuQueue = ref<TempDanmakuType[]>([]); // 新增：待处理弹幕队列
  const isUpdateScheduled = ref(false); // 新增：是否已安排更新
  const maxItems = computed(() => setting.value?.maxDanmakuCount || 50);
  const hasItems = computed(() => danmakuList.value.length > 0);
  const isInBatchUpdate = ref(false); // 添加批量更新状态标志
  const pendingRemovalItems = ref<string[]>([]); // 待移除的弹幕ID

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

    // 根据 enableAnimation 设置 data-animation-disabled 属性
    if (setting.value.enableAnimation) {
      root.removeAttribute('data-animation-disabled');
    } else {
      root.setAttribute('data-animation-disabled', 'true');
    }
  }

  // 新增：处理批量更新
  function processBatchUpdate() {
    if (pendingDanmakuQueue.value.length === 0) {
      isUpdateScheduled.value = false;
      return;
    }

    isInBatchUpdate.value = true; // 开始批量更新

    const itemsToAdd = pendingDanmakuQueue.value.slice(); // 复制队列
    pendingDanmakuQueue.value = []; // 清空队列

    // 将新弹幕添加到列表开头
    danmakuList.value.unshift(...itemsToAdd);

    // 优化超出长度的弹幕处理
    if (danmakuList.value.length > maxItems.value) {
      danmakuList.value.splice(maxItems.value, danmakuList.value.length - maxItems.value);
    }

    isUpdateScheduled.value = false;

    // 在下一帧 DOM 更新后结束批量更新状态
    nextTick(() => {
        isInBatchUpdate.value = false;
    });
  }

  // 新增：安排批量更新
  function scheduleBatchUpdate() {
    if (!isUpdateScheduled.value) {
      isUpdateScheduled.value = true;
      requestAnimationFrame(processBatchUpdate);
    }
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

    // 为传入的弹幕对象添加一个随机ID和时间戳
    const dataWithId: TempDanmakuType = {
      ...data,
      randomId: nanoid(),
      disappearAt,
      timestamp: Date.now(),
    };

    // 将弹幕添加到待处理队列，并安排批量更新
    pendingDanmakuQueue.value.push(dataWithId);
    scheduleBatchUpdate();

    //console.log('[DanmakuWindow] 添加弹幕到队列:', dataWithId);
  }

  // 检查和移除过期弹幕 - 优化为 filter
  function checkAndRemoveExpiredDanmaku() {
    if (!setting.value || setting.value.autoDisappearTime <= 0 || danmakuList.value.length === 0) return;

    const now = Date.now();
    const originalLength = danmakuList.value.length;

    danmakuList.value = danmakuList.value.filter(item => {
      // 如果没有 disappearAt 或 disappearAt 在未来，则保留
      return !item.disappearAt || item.disappearAt > now;
    });

    // 如果有弹幕被移除，可以考虑触发一次批量状态（可选，取决于是否需要移除动画也加速）
    // if (danmakuList.value.length < originalLength) {
    //   isInBatchUpdate.value = true;
    //   nextTick(() => {
    //     isInBatchUpdate.value = false;
    //   });
    // }
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
    :class="{ 'has-items': hasItems, 'batch-update': isInBatchUpdate }"
  >
    <div
      ref="scrollContainerRef"
      class="danmaku-list"
    >
      <!-- 使用TransitionGroup替代普通div -->
      <TransitionGroup
        name="danmaku-list"
        tag="div"
        class="danmaku-list-container"
      >
        <ClientDanmakuItem
          v-for="item in danmakuList"
          :key="item.randomId"
          :item="item"
          :setting="setting"
          :data-type="item.type"
          class="danmaku-item"
        />
      </TransitionGroup>
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
    background-color: transparent;
    /* 完全透明背景 */
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
    box-sizing: border-box;
    /* 确保padding不会增加元素的实际尺寸 */
  }

  .danmaku-list-container {
    width: 100%;
    display: flex;
    flex-direction: inherit;
    gap: var(--dw-item-spacing);
    position: relative;
    padding-bottom: 8px;
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

  /* 批量更新模式下的优化 */
  .batch-update .danmaku-list-move {
    transition-duration: 100ms !important;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1) !important;
  }

  .batch-item {
    transition-duration: 100ms !important;
  }

  /* 动画相关样式 - 根据 enableAnimation 设置应用 */
  /* 1. declare transition */
  .danmaku-list-move,
  .danmaku-list-enter-active,
  .danmaku-list-leave-active {
    transition: all var(--dw-animation-duration) cubic-bezier(0.55, 0, 0.1, 1);
  }

  /* 当禁用动画时应用的样式 */
  :root[data-animation-disabled="true"] .danmaku-list-move,
  :root[data-animation-disabled="true"] .danmaku-list-enter-active,
  :root[data-animation-disabled="true"] .danmaku-list-leave-active {
    transition: none !important;
    animation: none !important;
  }

  .danmaku-list-enter-from,
  .danmaku-list-leave-to {
    opacity: 0;
    transform: scaleY(0.01) translate(3000px, 0);
  }

  /* 3. ensure leaving items are taken out of layout flow so that moving
      animations can be calculated correctly. */
  .danmaku-list-leave-active {
    position: absolute;
  }

  /* 根据弹幕类型提供不同的动画特性 */
  [data-type="3"] {
    /* 普通弹幕 */
    --transition-delay: 0.02s;
  }

  [data-type="2"] {
    /* 礼物 */
    --transition-delay: 0.04s;
    animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
    /* 小弹跳效果 */
  }

  [data-type="1"] {
    /* SC */
    --transition-delay: 0.05s;
    animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
    /* 特殊强调效果 */
  }

  .danmaku-item {
    /* 添加 will-change 提示浏览器进行优化 */
    will-change: transform, opacity;
  }
</style>