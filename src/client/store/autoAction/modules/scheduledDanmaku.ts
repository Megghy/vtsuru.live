import { ref, watch, Ref, computed } from 'vue';
import { useStorage } from '@vueuse/core';
import {
  getRandomTemplate,
  formatTemplate,
  buildExecutionContext
} from '../utils';
import {
  AutoActionItem,
  TriggerType,
  RuntimeState
} from '../types';

/**
 * 定时弹幕模块
 * @param isLive 是否处于直播状态
 * @param roomId 房间ID
 * @param sendLiveDanmaku 发送弹幕函数
 */
export function useScheduledDanmaku(
  isLive: Ref<boolean>,
  roomId: Ref<number | undefined>,
  sendLiveDanmaku: (roomId: number, message: string) => Promise<boolean>
) {
  // 运行时数据
  const timer = ref<any | null>(null);
  const remainingSeconds = ref(0); // 倒计时剩余秒数
  const countdownTimer = ref<any | null>(null); // 倒计时定时器

  /**
   * 处理定时任务 - 使用新的AutoActionItem结构
   * @param actions 自动操作列表
   * @param runtimeState 运行时状态
   */
  function processScheduledActions(
    actions: AutoActionItem[],
    runtimeState: RuntimeState
  ) {
    if (!roomId.value) return;

    // 获取定时消息操作
    const scheduledActions = actions.filter(action =>
      action.triggerType === TriggerType.SCHEDULED &&
      action.enabled &&
      (!action.triggerConfig.onlyDuringLive || isLive.value)
    );

    // 为每个定时操作设置定时器
    scheduledActions.forEach(action => {
      // 检查是否已有定时器
      if (runtimeState.scheduledTimers[action.id]) return;

      const intervalSeconds = action.triggerConfig.intervalSeconds || 300; // 默认5分钟

      // 创建定时器函数
      const timerFn = () => {
        // 创建执行上下文
        const context = buildExecutionContext(null, roomId.value, TriggerType.SCHEDULED);

        // 选择并发送消息
        const template = getRandomTemplate(action.templates);
        if (template && roomId.value) {
          const formattedMessage = formatTemplate(template, context);
          sendLiveDanmaku(roomId.value, formattedMessage);
        }

        // 设置下一次定时
        runtimeState.scheduledTimers[action.id] = setTimeout(timerFn, intervalSeconds * 1000);
      };

      // 首次启动定时器
      runtimeState.scheduledTimers[action.id] = setTimeout(timerFn, intervalSeconds * 1000);
    });
  }

  /**
   * 启动定时弹幕 (旧方式)
   */
  function startScheduledDanmaku() {
    console.log('定时弹幕已迁移到新的AutoActionItem结构');
  }

  /**
   * 停止定时弹幕 (旧方式)
   */
  function stopScheduledDanmaku() {
    console.log('定时弹幕已迁移到新的AutoActionItem结构');
  }

  /**
   * 格式化剩余时间为分:秒格式
   */
  const formattedRemainingTime = computed(() => {
    const minutes = Math.floor(remainingSeconds.value / 60);
    const seconds = remainingSeconds.value % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  });

  /**
   * 清理计时器
   */
  function clearTimer() {
    if (timer.value) {
      clearTimeout(timer.value);
      timer.value = null;
    }
    if (countdownTimer.value) {
      clearInterval(countdownTimer.value);
      countdownTimer.value = null;
    }
  }

  return {
    startScheduledDanmaku,
    stopScheduledDanmaku,
    processScheduledActions,
    clearTimer,
    remainingSeconds,
    formattedRemainingTime
  };
}