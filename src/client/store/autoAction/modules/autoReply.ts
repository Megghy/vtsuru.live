import { ref, Ref } from 'vue';
import { EventModel } from '@/api/api-models';
import {
  AutoActionItem,
  TriggerType,
  ExecutionContext,
  RuntimeState
} from '../types';
import {
  formatTemplate,
  getRandomTemplate,
  shouldProcess,
  evaluateExpression
} from '../utils';

/**
 * 自动回复模块
 * @param isLive 是否处于直播状态
 * @param roomId 房间ID
 * @param sendLiveDanmaku 发送弹幕函数
 */
export function useAutoReply(
  isLive: Ref<boolean>,
  roomId: Ref<number | undefined>,
  sendLiveDanmaku: (roomId: number, message: string) => Promise<boolean>
) {
  // 运行时数据 - 记录特定关键词的最后回复时间
  const lastReplyTimestamps = ref<{ [keyword: string]: number; }>({});

  /**
   * 处理弹幕事件
   * @param event 弹幕事件
   * @param actions 自动操作列表
   * @param runtimeState 运行时状态
   */
  function onDanmaku(
    event: EventModel,
    actions: AutoActionItem[],
    runtimeState: RuntimeState
  ) {
    if (!roomId.value) return;

    // 过滤出有效的自动回复操作
    const replyActions = actions.filter(action =>
      action.triggerType === TriggerType.DANMAKU &&
      action.enabled &&
      (!action.triggerConfig.onlyDuringLive || isLive.value)
    );

    if (replyActions.length === 0) return;

    const message = event.msg;
    const now = Date.now();

    // 准备执行上下文
    const context: ExecutionContext = {
      event,
      roomId: roomId.value,
      variables: {
        user: {
          name: event.uname,
          uid: event.uid,
          guardLevel: event.guard_level,
          hasMedal: event.fans_medal_wearing_status,
          medalLevel: event.fans_medal_level,
          medalName: event.fans_medal_name
        },
        message: event.msg,
        timeOfDay: () => {
          const hour = new Date().getHours();
          if (hour < 6) return '凌晨';
          if (hour < 9) return '早上';
          if (hour < 12) return '上午';
          if (hour < 14) return '中午';
          if (hour < 18) return '下午';
          if (hour < 22) return '晚上';
          return '深夜';
        },
        date: {
          formatted: new Date().toLocaleString('zh-CN')
        }
      },
      timestamp: now
    };

    // 检查每个操作
    for (const action of replyActions) {
      // 检查用户过滤条件
      if (action.triggerConfig.userFilterEnabled) {
        if (action.triggerConfig.requireMedal && !event.fans_medal_wearing_status) continue;
        if (action.triggerConfig.requireCaptain && !event.guard_level) continue;
      }

      // 关键词和屏蔽词检查
      const keywordMatch = action.triggerConfig.keywords?.some(kw => message.includes(kw));
      if (!keywordMatch) continue;

      const blockwordMatch = action.triggerConfig.blockwords?.some(bw => message.includes(bw));
      if (blockwordMatch) continue; // 包含屏蔽词，不回复

      // 评估逻辑表达式
      if (action.logicalExpression && !evaluateExpression(action.logicalExpression, context)) {
        continue;
      }

      // 检查冷却
      const lastExecTime = runtimeState.lastExecutionTime[action.id] || 0;
      if (!action.ignoreCooldown && now - lastExecTime < (action.actionConfig.cooldownSeconds || 0) * 1000) {
        continue; // 仍在冷却中
      }

      // 选择回复并发送
      const template = getRandomTemplate(action.templates);
      if (template) {
        // 格式化并发送
        const formattedReply = formatTemplate(template, context);

        // 更新冷却时间
        runtimeState.lastExecutionTime[action.id] = now;

        // 执行延迟处理
        if (action.actionConfig.delaySeconds && action.actionConfig.delaySeconds > 0) {
          setTimeout(() => {
            sendLiveDanmaku(roomId.value!, formattedReply);
          }, action.actionConfig.delaySeconds * 1000);
        } else {
          sendLiveDanmaku(roomId.value!, formattedReply);
        }

        break; // 匹配到一个规则就停止
      }
    }
  }

  // 重置冷却时间 (用于测试)
  function resetCooldowns(runtimeState: RuntimeState, actionId?: string) {
    if (actionId) {
      delete runtimeState.lastExecutionTime[actionId];
    } else {
      Object.keys(runtimeState.lastExecutionTime).forEach(id => {
        delete runtimeState.lastExecutionTime[id];
      });
    }
  }

  return {
    onDanmaku,
    resetCooldowns
  };
}