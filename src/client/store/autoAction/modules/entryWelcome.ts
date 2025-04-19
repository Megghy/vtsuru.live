import { ref, Ref } from 'vue';
import { EventModel, EventDataTypes } from '@/api/api-models';
import {
  formatTemplate,
  getRandomTemplate,
  buildExecutionContext
} from '../utils';
import {
  AutoActionItem,
  TriggerType,
  RuntimeState
} from '../types';

/**
 * 入场欢迎模块
 * @param isLive 是否处于直播状态
 * @param roomId 房间ID
 * @param isTianXuanActive 是否处于天选时刻
 * @param sendLiveDanmaku 发送弹幕函数
 */
export function useEntryWelcome(
  isLive: Ref<boolean>,
  roomId: Ref<number | undefined>,
  isTianXuanActive: Ref<boolean>,
  sendLiveDanmaku: (roomId: number, message: string) => Promise<boolean>
) {
  // 运行时数据
  const timer = ref<NodeJS.Timeout | null>(null);

  /**
   * 处理入场事件 - 支持新的AutoActionItem结构
   * @param event 入场事件
   * @param actions 自动操作列表
   * @param runtimeState 运行时状态
   */
  function processEnter(
    event: EventModel,
    actions: AutoActionItem[],
    runtimeState: RuntimeState
  ) {
    if (!roomId.value) return;

    // 过滤出有效的入场欢迎操作
    const enterActions = actions.filter(action =>
      action.triggerType === TriggerType.ENTER &&
      action.enabled &&
      (!action.triggerConfig.onlyDuringLive || isLive.value) &&
      (!action.triggerConfig.ignoreTianXuan || !isTianXuanActive.value)
    );

    if (enterActions.length === 0) return;

    // 创建执行上下文
    const context = buildExecutionContext(event, roomId.value, TriggerType.ENTER);

    // 处理每个符合条件的操作
    for (const action of enterActions) {
      // 跳过不符合用户过滤条件的
      if (action.triggerConfig.userFilterEnabled) {
        if (action.triggerConfig.requireMedal && !event.fans_medal_wearing_status) continue;
        if (action.triggerConfig.requireCaptain && !event.guard_level) continue;
      }

      // 检查入场过滤条件 (可以在未来扩展更多条件)
      if (action.triggerConfig.filterMode === 'blacklist' &&
          action.triggerConfig.filterGiftNames?.includes(event.uname)) continue;

      // 检查冷却时间
      const lastExecTime = runtimeState.lastExecutionTime[action.id] || 0;
      if (!action.ignoreCooldown &&
          Date.now() - lastExecTime < (action.actionConfig.cooldownSeconds || 0) * 1000) {
        continue; // 仍在冷却中
      }

      // 选择并发送回复
      const template = getRandomTemplate(action.templates);
      if (template) {
        // 更新冷却时间
        runtimeState.lastExecutionTime[action.id] = Date.now();

        // 格式化并发送
        const formattedReply = formatTemplate(template, context);

        // 延迟发送
        if (action.actionConfig.delaySeconds && action.actionConfig.delaySeconds > 0) {
          setTimeout(() => {
            sendLiveDanmaku(roomId.value!, formattedReply);
          }, action.actionConfig.delaySeconds * 1000);
        } else {
          sendLiveDanmaku(roomId.value!, formattedReply);
        }
      }
    }
  }

  /**
   * 清理计时器
   */
  function clearTimer() {
    if (timer.value) {
      clearTimeout(timer.value);
      timer.value = null;
    }
  }

  return {
    processEnter,
    clearTimer
  };
}