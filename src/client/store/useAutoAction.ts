import { ref, computed, onUnmounted, watch } from 'vue';
import { defineStore, acceptHMRUpdate } from 'pinia';
import { EventModel, GuardLevel } from '@/api/api-models.js';
import { useDanmakuClient } from '@/store/useDanmakuClient.js';
import { useBiliFunction } from './useBiliFunction.js';
import { useAccount } from '@/api/account.js';
import { useStorage } from '@vueuse/core';
import {
  TriggerType,
  ActionType,
  Priority,
  RuntimeState,
  type AutoActionItem,
  ExecutionContext
} from './autoAction/types.js';
import {
  evaluateExpression,
  formatTemplate,
  getRandomTemplate,
  createDefaultAutoAction,
  createDefaultRuntimeState
} from './autoAction/utils.js';

// 导入所有子模块
import { useGiftThank } from './autoAction/modules/giftThank.js';
import { useGuardPm } from './autoAction/modules/guardPm.js';
import { useFollowThank } from './autoAction/modules/followThank.js';
import { useEntryWelcome } from './autoAction/modules/entryWelcome.js';
import { useAutoReply } from './autoAction/modules/autoReply.js';
import { useScheduledDanmaku } from './autoAction/modules/scheduledDanmaku.js';
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval'
import { isDev } from '@/data/constants.js';

export const useAutoAction = defineStore('autoAction', () => {
  const danmakuClient = useDanmakuClient();
  const biliFunc = useBiliFunction();
  const account = useAccount(); // 用于获取房间ID和直播状态

  // --- 共享状态 ---
  const isLive = computed(() => account.value.streamerInfo?.isStreaming ?? false); // 获取直播状态
  const roomId = computed(() => isDev ? 1294406 : account.value.streamerInfo?.roomId); // 获取房间ID
  const isTianXuanActive = ref(false); // 天选时刻状态

  // --- 存储所有自动操作项 ---
  const { data: autoActions } = useIDBKeyval<AutoActionItem[]>('autoAction.items', []);

  // --- 运行时状态 ---
  const runtimeState = ref<RuntimeState>(createDefaultRuntimeState());

  // --- 初始化各个模块 ---
  const giftThank = useGiftThank(
    isLive,
    roomId,
    isTianXuanActive,
    (roomId: number, message: string) => biliFunc.sendLiveDanmaku(roomId, message)
  );

  const guardPm = useGuardPm(
    isLive,
    roomId,
    (userId: number, message: string) => biliFunc.sendPrivateMessage(userId, message)
  );

  const followThank = useFollowThank(
    isLive,
    roomId,
    isTianXuanActive,
    (roomId: number, message: string) => biliFunc.sendLiveDanmaku(roomId, message)
  );

  const entryWelcome = useEntryWelcome(
    isLive,
    roomId,
    isTianXuanActive,
    (roomId: number, message: string) => biliFunc.sendLiveDanmaku(roomId, message)
  );

  const autoReply = useAutoReply(
    isLive,
    roomId,
    (roomId: number, message: string) => biliFunc.sendLiveDanmaku(roomId, message)
  );

  const scheduledDanmaku = useScheduledDanmaku(
    isLive,
    roomId,
    (roomId: number, message: string) => biliFunc.sendLiveDanmaku(roomId, message)
  );

  // --- 共享函数 ---

  // 检查是否处于天选时刻
  function checkTianXuanStatus() {
    return false;
    if (!roomId.value) return;

    // 调用B站API检查天选时刻状态
    /*biliFunc.checkRoomTianXuanStatus(roomId.value).then(active => {
      isTianXuanActive.value = active;
    }).catch(err => {
      console.error('检查天选时刻状态失败:', err);
    });*/
  }

  // 每5分钟更新一次天选状态
  const tianXuanTimer = setInterval(checkTianXuanStatus, 5 * 60 * 1000);

  // 清理所有计时器
  function clearAllTimers() {
    // 清理所有定时弹幕计时器
    Object.entries(runtimeState.value.scheduledTimers).forEach(([id, timer]) => {
      if (timer) clearTimeout(timer);
    });

    // 清理天选状态定时器
    clearInterval(tianXuanTimer);

    // 清理各模块计时器
    scheduledDanmaku.clearTimer();
  }

  // 检查操作是否应该处理
  function shouldProcessAction(action: AutoActionItem, event?: EventModel): boolean {
    // 基本检查: 是否启用
    if (!action.enabled) return false;

    // 直播状态检查
    if (action.triggerConfig.onlyDuringLive && !isLive.value) return false;

    // 天选时刻检查
    if (action.triggerConfig.ignoreTianXuan && isTianXuanActive.value) return false;

    // 用户过滤检查
    if (event && action.triggerConfig.userFilterEnabled) {
      if (action.triggerConfig.requireMedal && !event.fans_medal_wearing_status) return false;
      if (action.triggerConfig.requireCaptain && event.guard_level === GuardLevel.None) return false;
    }

    // 评估逻辑表达式
    if (action.logicalExpression && event) {
      const context: ExecutionContext = {
        event,
        roomId: roomId.value,
        variables: {},
        timestamp: Date.now()
      };

      if (!evaluateExpression(action.logicalExpression, context)) return false;
    }

    return true;
  }

  // 根据事件类型处理
  function processEvent(event: EventModel, triggerType: TriggerType) {
    if (!roomId.value) return;

    // 使用特定模块处理对应的事件类型
    switch (triggerType) {
      case TriggerType.GIFT:
        // 使用新的统一方式处理礼物感谢
        giftThank.processGift(event, autoActions.value, runtimeState.value);
        break;

      case TriggerType.GUARD:
        guardPm.processGuard(event, autoActions.value, runtimeState.value);
        break;

      case TriggerType.FOLLOW:
        followThank.processFollow(event, autoActions.value, runtimeState.value);
        break;

      case TriggerType.ENTER:
        entryWelcome.processEnter(event, autoActions.value, runtimeState.value);
        break;

      case TriggerType.DANMAKU:
        // 使用新的统一方式处理弹幕自动回复
        autoReply.onDanmaku(event, autoActions.value, runtimeState.value);
        break;

      case TriggerType.SUPER_CHAT:
        // 处理SC事件
        processEventWithAutoActions(event, triggerType);
        break;

      default:
        // 默认使用自动操作系统处理
        processEventWithAutoActions(event, triggerType);
    }
  }

  // 使用自动操作系统处理事件
  function processEventWithAutoActions(event: EventModel, triggerType: TriggerType) {
    // 过滤出符合此触发类型的actions并按优先级排序
    const matchingActions = autoActions.value
      .filter(action => action.triggerType === triggerType)
      .filter(action => shouldProcessAction(action, event))
      .sort((a, b) => a.priority - b.priority);

    if (matchingActions.length === 0) return;

    // 准备执行上下文
    const context: ExecutionContext = {
      event,
      roomId: roomId.value,
      variables: buildVariablesFromEvent(event, triggerType),
      timestamp: Date.now()
    };

    // 执行匹配的操作
    for (const action of matchingActions) {
      executeAction(action, context);
    }
  }

  // 从事件中构建变量
  function buildVariablesFromEvent(event: EventModel, triggerType: TriggerType): Record<string, any> {
    const variables: Record<string, any> = {};

    // 用户信息
    variables.user = {
      name: event.uname,
      uid: event.uid,
      guardLevel: event.guard_level,
      hasMedal: event.fans_medal_wearing_status,
      medalLevel: event.fans_medal_level,
      medalName: event.fans_medal_name
    };

    // 根据不同的触发类型添加特定变量
    switch (triggerType) {
      case TriggerType.GIFT:
        variables.gift = {
          name: event.msg, // 礼物名称通常存在msg字段
          count: event.num,
          price: event.price / 1000, // B站价格单位通常是 1/1000 元
          totalPrice: (event.price / 1000) * event.num,
          summary: `${event.num}个${event.msg}`
        };
        break;

      case TriggerType.GUARD:
        const guardLevelMap = {
          [GuardLevel.Zongdu]: '总督',
          [GuardLevel.Tidu]: '提督',
          [GuardLevel.Jianzhang]: '舰长',
          [GuardLevel.None]: '无舰长'
        };
        variables.guard = {
          level: event.guard_level,
          levelName: guardLevelMap[event.guard_level as GuardLevel] || '未知舰长等级',
          giftCode: '' // 会在执行时填充
        };
        break;

      case TriggerType.SUPER_CHAT:
        variables.sc = {
          message: event.msg,
          price: event.price / 1000
        };
        break;
    }

    // 添加通用日期变量
    const now = new Date();
    variables.date = {
      formatted: now.toLocaleString(),
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      hour: now.getHours(),
      minute: now.getMinutes(),
      second: now.getSeconds(),
    };

    // 时段函数
    variables.timeOfDay = () => {
      const hour = now.getHours();
      if (hour >= 5 && hour < 12) return '早上';
      if (hour >= 12 && hour < 18) return '下午';
      return '晚上';
    };

    return variables;
  }

  // 执行自动操作
  function executeAction(action: AutoActionItem, context: ExecutionContext) {
    const { actionType, templates, actionConfig, id } = action;
    const { delaySeconds = 0, cooldownSeconds = 0 } = actionConfig;

    // 检查冷却时间
    if (!action.ignoreCooldown) {
      const lastExecTime = runtimeState.value.lastExecutionTime[id] || 0;
      if (Date.now() - lastExecTime < cooldownSeconds * 1000) {
        return; // 仍在冷却中
      }
    }

    // 获取随机模板
    const template = getRandomTemplate(templates);
    if (!template) return;

    // 格式化模板
    const formattedContent = formatTemplate(template, context);
    if (!formattedContent) return;

    // 根据操作类型执行不同的动作
    const executeActionFunc = () => {
      // 记录执行时间
      runtimeState.value.lastExecutionTime[id] = Date.now();

      switch (actionType) {
        case ActionType.SEND_DANMAKU:
          if (context.roomId) {
            biliFunc.sendLiveDanmaku(context.roomId, formattedContent);
          }
          break;

        case ActionType.SEND_PRIVATE_MSG:
          if (context.event) {
            biliFunc.sendPrivateMessage(context.event.uid, formattedContent);

            // 如果是上舰私信，记录已发送
            if (action.triggerType === TriggerType.GUARD && action.triggerConfig.preventRepeat) {
              runtimeState.value.sentGuardPms.add(context.event.uid);
            }
          }
          break;

        case ActionType.EXECUTE_COMMAND:
          if (action.executeCommand) {
            try {
              const execFunc = new Function(
                'context',
                'event',
                'biliFunc',
                'roomId',
                action.executeCommand
              );
              execFunc(context, context.event, biliFunc, roomId.value);
            } catch (error) {
              console.error('执行命令错误:', error);
            }
          }
          break;
      }
    };

    // 延迟执行
    if (delaySeconds > 0) {
      setTimeout(executeActionFunc, delaySeconds * 1000);
    } else {
      executeActionFunc();
    }
  }

  // 启动定时任务
  function startScheduledActions() {
    if (!roomId.value) return;

    // 使用专用模块处理定时发送
    scheduledDanmaku.processScheduledActions(autoActions.value, runtimeState.value);

    // 同时处理自定义的定时任务
    const scheduledActions = autoActions.value.filter(
      action => action.triggerType === TriggerType.SCHEDULED && action.enabled
    );

    scheduledActions.forEach(action => {
      // 清理可能存在的旧定时器
      if (runtimeState.value.scheduledTimers[action.id]) {
        clearTimeout(runtimeState.value.scheduledTimers[action.id]!);
      }

      const intervalSeconds = action.triggerConfig.intervalSeconds || 300; // 默认5分钟

      const timerFunc = () => {
        // 仅在检查时判断直播状态，不停止定时器
        const shouldExecute =
          !action.triggerConfig.onlyDuringLive || isLive.value;

        if (shouldExecute && !(action.triggerConfig.ignoreTianXuan && isTianXuanActive.value)) {
          // 创建执行上下文
          const context: ExecutionContext = {
            roomId: roomId.value,
            variables: {
              date: {
                formatted: new Date().toLocaleString(),
                year: new Date().getFullYear(),
                month: new Date().getMonth() + 1,
                day: new Date().getDate(),
                hour: new Date().getHours(),
                minute: new Date().getMinutes(),
                second: new Date().getSeconds(),
              }
            },
            timestamp: Date.now()
          };

          // 执行定时操作
          executeAction(action, context);
        }

        // 无论是否执行，都设置下一次定时
        runtimeState.value.scheduledTimers[action.id] = setTimeout(timerFunc, intervalSeconds * 1000);
      };

      // 首次执行
      runtimeState.value.scheduledTimers[action.id] = setTimeout(timerFunc, intervalSeconds * 1000);
    });
  }

  // 停止所有定时任务
  function stopAllScheduledActions() {
    // 清理所有定时任务
    Object.entries(runtimeState.value.scheduledTimers).forEach(([id, timer]) => {
      if (timer) {
        clearTimeout(timer);
        runtimeState.value.scheduledTimers[id] = null;
      }
    });

    // 清理模块定时任务
    scheduledDanmaku.clearTimer();
  }

  // 添加新的自动操作
  function addAutoAction(triggerType: TriggerType): AutoActionItem {
    const newAction = createDefaultAutoAction(triggerType);
    autoActions.value.push(newAction);
    return newAction;
  }

  // 删除自动操作
  function removeAutoAction(id: string) {
    const index = autoActions.value.findIndex(action => action.id === id);
    if (index !== -1) {
      // 清理相关定时器
      if (autoActions.value[index].triggerType === TriggerType.SCHEDULED &&
          runtimeState.value.scheduledTimers[id]) {
        clearTimeout(runtimeState.value.scheduledTimers[id]!);
        runtimeState.value.scheduledTimers[id] = null;
      }
      autoActions.value.splice(index, 1);
    }
  }

  // 切换自动操作启用状态
  function toggleAutoAction(id: string, enabled: boolean) {
    const action = autoActions.value.find(action => action.id === id);
    if (action) {
      action.enabled = enabled;

      // 如果是定时操作，重新配置定时器
      if (action.triggerType === TriggerType.SCHEDULED) {
        if (enabled) {
          // 如果已有定时器，先清理
          if (runtimeState.value.scheduledTimers[id]) {
            clearTimeout(runtimeState.value.scheduledTimers[id]!);
            runtimeState.value.scheduledTimers[id] = null;
          }

          // 启用时单独启动这个定时器
          const intervalSeconds = action.triggerConfig.intervalSeconds || 300;

          const timerFunc = () => {
            // 仅在检查时判断直播状态，不停止定时器
            const shouldExecute =
              !action.triggerConfig.onlyDuringLive || isLive.value;

            if (shouldExecute && !(action.triggerConfig.ignoreTianXuan && isTianXuanActive.value)) {
              // 创建执行上下文
              const context: ExecutionContext = {
                roomId: roomId.value,
                variables: {
                  date: {
                    formatted: new Date().toLocaleString(),
                    year: new Date().getFullYear(),
                    month: new Date().getMonth() + 1,
                    day: new Date().getDate(),
                    hour: new Date().getHours(),
                    minute: new Date().getMinutes(),
                    second: new Date().getSeconds(),
                  }
                },
                timestamp: Date.now()
              };

              // 执行定时操作
              executeAction(action, context);
            }

            // 无论是否执行，都设置下一次定时
            runtimeState.value.scheduledTimers[id] = setTimeout(timerFunc, intervalSeconds * 1000);
          };

          // 启动定时器
          runtimeState.value.scheduledTimers[id] = setTimeout(timerFunc, intervalSeconds * 1000);
        } else if (runtimeState.value.scheduledTimers[id]) {
          // 禁用时清理定时器
          clearTimeout(runtimeState.value.scheduledTimers[id]!);
          runtimeState.value.scheduledTimers[id] = null;
        }
      }
    }
  }

  // 初始化
  function init() {
    // 初始检查天选状态
    checkTianXuanStatus();

    // 启动所有定时发送任务
    startScheduledActions();

    // 不再根据直播状态停止定时任务，只在回调中判断
    /*watch(isLive, (newIsLive) => {
      if (newIsLive) {
        startScheduledActions();
      } else {
        stopAllScheduledActions();
      }
    });*/

    // 安全地订阅事件
    try {
      danmakuClient.onEvent('danmaku', (event) => processEvent(event, TriggerType.DANMAKU));
      danmakuClient.onEvent('gift', (event) => processEvent(event, TriggerType.GIFT));
      danmakuClient.onEvent('guard', (event) => processEvent(event, TriggerType.GUARD));
      danmakuClient.onEvent('sc', (event) => processEvent(event, TriggerType.SUPER_CHAT));
      danmakuClient.onEvent('enter', (event) => processEvent(event, TriggerType.ENTER));
    } catch (err) {
      console.error('注册事件监听器失败:', err);
    }

    // 注册HMR清理
    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        clearAllTimers();
      });
    }
  }

  // 卸载时清理
  onUnmounted(() => {
    clearAllTimers();
  });

  // 向外部导出所有配置和状态
  const exportedConfigs = computed(() => ({
    autoActions: autoActions.value,
    isLive: isLive.value,
    roomId: roomId.value
  }));

  /**
   * 获取定时任务的计时器信息
   * @param actionId 定时任务ID
   * @returns 计时器信息，包含剩余毫秒数
   */
  function getScheduledTimerInfo(actionId: string) {
    const timer = runtimeState.value.scheduledTimers[actionId];
    if (!timer) return null;

    // 找到对应的action
    const action = autoActions.value.find(a => a.id === actionId);
    if (!action) return null;

    const intervalSeconds = action.triggerConfig.intervalSeconds || 300;
    const intervalMs = intervalSeconds * 1000;

    // 计算下一次执行时间和剩余时间
    // 由于JavaScript中没有直接的方式获取setTimeout的剩余时间
    // 我们需要模拟一个剩余时间，在实际应用中可能需要更精确的方式
    const now = Date.now();
    const timerId = timer as unknown as number;
    const remainingMs = Math.max(0, (intervalMs - (now % intervalMs)) % intervalMs);

    return {
      actionId,
      intervalMs,
      remainingMs
    };
  }

  /**
   * 更新所有定时任务计时器状态（用于触发UI更新）
   */
  function updateScheduledTimers() {
    // 这个方法主要用于触发UI更新
    // 实际上只需要修改一个响应式变量即可
    const scheduledActions = autoActions.value.filter(
      action => action.triggerType === TriggerType.SCHEDULED && action.enabled
    );

    // 触发响应式更新
    scheduledActions.forEach(action => {
      const timerInfo = getScheduledTimerInfo(action.id);
      if (timerInfo) {
        // 简单地触发更新，不需要实际改变值
        const timerId = runtimeState.value.scheduledTimers[action.id];
        if (timerId) {
          // 重新分配相同的值会触发Vue的响应式更新
          runtimeState.value.scheduledTimers[action.id] = timerId;
        }
      }
    });
  }

  // 导出接口
  return {
    autoActions,
    runtimeState: runtimeState.value,
    shouldProcessAction,
    executeAction,
    addAutoAction,
    removeAutoAction,
    toggleAutoAction,
    processEvent,
    startScheduledActions,
    stopAllScheduledActions,
    checkTianXuanStatus,
    getScheduledTimerInfo,
    updateScheduledTimers,
    init
  };
});

// 支持热更新
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAutoAction, import.meta.hot));
}

export {
  AutoActionItem,
  TriggerType,
  ActionType,
  Priority
};
