// 导入 Vue 和 Pinia 相关函数
import { ref, computed, watch } from 'vue';
import { defineStore, acceptHMRUpdate } from 'pinia';
// 导入 API 模型和类型
import { EventModel, GuardLevel, EventDataTypes } from '@/api/api-models.js';
import { useDanmakuClient } from '@/store/useDanmakuClient.js';
import { useBiliFunction } from './useBiliFunction.js';
import { useAccount } from '@/api/account.js';
// 导入 VueUse 工具库
import { useStorage } from '@vueuse/core';
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval';
// 导入自动操作相关的类型和工具函数
import {
  TriggerType,
  ActionType,
  Priority,
  RuntimeState,
  type AutoActionItem,
  ExecutionContext,
  KeywordMatchType
} from './autoAction/types.js';
import {
  getRandomTemplate,
  buildExecutionContext,
  evaluateExpression,
  shouldProcess,
  createDefaultAutoAction,
  createDefaultRuntimeState
} from './autoAction/utils';
import { evaluateTemplateExpressions } from './autoAction/expressionEvaluator';
// 导入 actionUtils 工具函数
import { filterValidActions, checkUserFilters, checkCooldown, processTemplate, executeActions } from './autoAction/actionUtils';
// 导入 nanoid 用于生成唯一 ID
import { nanoid } from 'nanoid';
// 导入开发环境判断标志
import { isDev } from '@/data/constants.js';

// 导入所有自动操作子模块
import { useGiftThank } from './autoAction/modules/giftThank';
import { useGuardPm } from './autoAction/modules/guardPm';
import { useFollowThank } from './autoAction/modules/followThank';
import { useEntryWelcome } from './autoAction/modules/entryWelcome';
import { useAutoReply } from './autoAction/modules/autoReply';
import { useScheduledDanmaku } from './autoAction/modules/scheduledDanmaku';
import { useSuperChatThank } from './autoAction/modules/superChatThank';

// 定义名为 'autoAction' 的 Pinia store
export const useAutoAction = defineStore('autoAction', () => {
  // 获取 Pinia store 实例
  const danmakuClient = useDanmakuClient(); // 弹幕客户端
  const biliFunc = useBiliFunction();      // B站相关功能函数
  const account = useAccount();             // 账户信息，用于获取房间ID和直播状态

  // --- 共享状态 ---
  const isLive = computed(() => account.value.streamerInfo?.isStreaming ?? false); // 获取直播状态
  const roomId = computed(() => isDev ? 1294406 : account.value.streamerInfo?.roomId); // 获取房间ID (开发环境使用固定ID)
  const isTianXuanActive = ref(false); // 天选时刻活动状态

  // --- 存储所有自动操作项 (使用 IndexedDB 持久化) ---
  const { data: autoActions, isFinished: isActionsLoaded } = useIDBKeyval<AutoActionItem[]>('autoAction.items', [], {
    onError: (err) => {
      console.error('[AutoAction] IDB 错误 (项目):', err); // 报告 IndexedDB 错误
    }
  });

  // --- 运行时状态 (非持久化) ---
  const runtimeState = ref<RuntimeState>(createDefaultRuntimeState());

  // --- 添加触发类型启用状态持久化 ---
  const { data: enabledTriggerTypes, isFinished: isTriggersLoaded } = useIDBKeyval<Record<TriggerType, boolean>>('autoAction.enabledTriggers', {
    [TriggerType.DANMAKU]: true,
    [TriggerType.GIFT]: true,
    [TriggerType.GUARD]: true,
    [TriggerType.FOLLOW]: true,
    [TriggerType.ENTER]: true,
    [TriggerType.SCHEDULED]: true,
    [TriggerType.SUPER_CHAT]: true
  }, {
    onError: (err) => console.error('[AutoAction] IDB 错误 (触发类型):', err) // 报告 IndexedDB 错误
  });

  /**
   * 设置触发类型启用状态
   * @param triggerType 触发类型
   * @param enabled 是否启用
   */
  function setTriggerTypeEnabled(triggerType: TriggerType, enabled: boolean) {
    if (enabledTriggerTypes.value) {
      enabledTriggerTypes.value[triggerType] = enabled;

      // 如果是定时任务类型，且状态改变，则需要相应处理定时器
      if (triggerType === TriggerType.SCHEDULED) {
        if (enabled) {
          // 启用时，启动相关定时器
          startIndividualScheduledActions();
          startGlobalTimer();
        } else {
          // 禁用时，停止相关定时器
          stopAllIndividualScheduledActions();
          // 移除 stopGlobalTimer() 调用，让计时器继续运行，但回调会提前返回
          // stopGlobalTimer();
        }
      }
    }
  }

  // --- 全局定时器设置 (使用 IndexedDB 持久化) ---
  const { data: globalIntervalSeconds, isFinished: isIntervalLoaded } = useIDBKeyval<number>('autoAction.globalInterval', 300, {
    onError: (err) => console.error('[AutoAction] IDB 错误 (间隔):', err) // 报告 IndexedDB 错误
  });
  const { data: globalSchedulingMode, isFinished: isModeLoaded } = useIDBKeyval<'random' | 'sequential'>('autoAction.globalMode', 'random', {
    onError: (err) => console.error('[AutoAction] IDB 错误 (模式):', err) // 报告 IndexedDB 错误
  });
  // 持久化上次全局顺序执行的索引 (使用 IndexedDB 持久化)
  const { data: lastGlobalActionIndex, isFinished: isIndexLoaded } = useIDBKeyval<number>('autoAction.lastGlobalIndex', -1, {
    onError: (err) => console.error('[AutoAction] IDB 错误 (上次索引):', err) // 报告 IndexedDB 错误
  });

  const globalTimer = ref<any | null>(null); // 单个全局定时器实例

  // --- 全局定时器逻辑 ---

  /**
   * 全局定时器触发处理函数
   */
  function handleGlobalTimerTick() {
    // 1. 基本状态检查 (如果条件不满足，返回但不停止计时器)
    if (!roomId.value || !isActionsLoaded.value) {
      console.warn('[AutoAction] 全局定时器触发跳过: 房间ID或操作项未就绪.');
      // Schedule next tick? No, rely on restart when ready.
      return; // <- Changed from stopGlobalTimer()
    }
    // 检查触发类型是否启用
    if (!enabledTriggerTypes.value || !enabledTriggerTypes.value[TriggerType.SCHEDULED]) {
      console.log('[AutoAction] 全局定时器触发跳过: 定时任务类型已禁用.');
      // Schedule next tick? No.
      return; // <- Changed from stopGlobalTimer()
    }

    // 3. 筛选出当前*符合条件*的已启用操作
    const eligibleActions = autoActions.value.filter(action =>
      action.triggerType === TriggerType.SCHEDULED &&
      action.enabled &&
      action.triggerConfig.useGlobalTimer && // 必须选择使用全局定时器
      (!action.triggerConfig.onlyDuringLive || isLive.value) && // 检查是否仅直播时触发
      (!action.triggerConfig.ignoreTianXuan || !isTianXuanActive.value) // 检查是否忽略天选时刻
    );

    // 4. 执行操作 (仅当有符合条件的任务时)
    if (eligibleActions.length > 0) {
      let actionToExecute: AutoActionItem | null = null;
      if (globalSchedulingMode.value === 'random') {
        // 随机模式：随机选择一个
        const randomIndex = Math.floor(Math.random() * eligibleActions.length);
        actionToExecute = eligibleActions[randomIndex];
      } else {
        // 顺序模式：按顺序循环选择
        lastGlobalActionIndex.value = (lastGlobalActionIndex.value + 1) % eligibleActions.length;
        actionToExecute = eligibleActions[lastGlobalActionIndex.value];
      }

      if (actionToExecute) {
        // 构建执行上下文并执行选中的操作
        const context = buildExecutionContext(null, roomId.value, TriggerType.SCHEDULED);
        // 手动执行定时任务
        const template = getRandomTemplate(actionToExecute.template);
        if (template && roomId.value) {
          const formattedContent = evaluateTemplateExpressions(template, context);
          // 更新执行时间
          runtimeState.value.lastExecutionTime[actionToExecute.id] = Date.now();
          // 发送弹幕
          if (actionToExecute.actionConfig.delaySeconds && actionToExecute.actionConfig.delaySeconds > 0) {
            setTimeout(() => {
              biliFunc.sendLiveDanmaku(roomId.value!, formattedContent).catch(err => console.error("[AutoAction] 发送弹幕失败:", err));
            }, actionToExecute.actionConfig.delaySeconds * 1000);
          } else {
            biliFunc.sendLiveDanmaku(roomId.value, formattedContent).catch(err => console.error("[AutoAction] 发送弹幕失败:", err));
          }
        }
      }
    } else {
      // 没有符合条件的任务，跳过本次执行，但定时器继续
      console.log('[AutoAction] 当前没有符合条件的全局定时任务可执行，跳过本次执行。');
    }

    // 5. 安排 *下一次* 触发 (只要有任务配置了全局定时器且间隔有效)
    const intervalMs = globalIntervalSeconds.value * 1000;
    if (intervalMs > 0) {
      // 确保在设置新的定时器之前清除任何旧的句柄
      if (globalTimer.value) {
        clearTimeout(globalTimer.value);
      }
      globalTimer.value = setTimeout(handleGlobalTimerTick, intervalMs);
      runtimeState.value.globalTimerStartTime = Date.now(); // 记录下一次间隔的开始时间
    } else {
      console.warn('[AutoAction] 全局定时器间隔无效，无法安排下一次触发。');
      // 不停止定时器，等待间隔被修正后由 restartGlobalTimer 恢复
    }
  }

  /**
   * 启动全局定时器 (如果尚未运行且有需要)
   * 仅安排 *第一次* 触发
   */
  function startGlobalTimer() {
    // 如果定时器已在运行或操作尚未加载完成，则不执行
    if (globalTimer.value || !isActionsLoaded.value) return;

    // 如果定时任务类型被禁用，则不启动定时器
    // (handleGlobalTimerTick 会处理返回，这里不需要停止)
    if (!enabledTriggerTypes.value || !enabledTriggerTypes.value[TriggerType.SCHEDULED]) return; // <- Added enabledTriggerTypes check

    // 检查是否有任何启用的定时任务需要全局定时器
    const needsGlobalTimer = autoActions.value.some(action =>
      action.triggerType === TriggerType.SCHEDULED &&
      // action.enabled && // Don't require enabled here, just configured
      action.triggerConfig.useGlobalTimer
    );

    // 如果需要全局定时器且间隔时间有效
    if (needsGlobalTimer && globalIntervalSeconds.value > 0) {
      // 这里只 *安排* 第一次触发，`handleGlobalTimerTick` 会处理后续的触发
      const intervalMs = globalIntervalSeconds.value * 1000;
      // console.log(`[AutoAction] 安排首次全局定时器触发于 ${globalIntervalSeconds.value} 秒后`); // 移除调试日志
      // 以防万一先清除旧的定时器 (例如，快速切换状态)
      if (globalTimer.value) clearTimeout(globalTimer.value);
      globalTimer.value = setTimeout(handleGlobalTimerTick, intervalMs);
      runtimeState.value.globalTimerStartTime = Date.now(); // 记录首次间隔的开始时间
    } else {
      // 如果没有任务配置需要全局定时器，或者间隔无效，则确保停止
      // console.log('[AutoAction] 无操作需要全局定时器或间隔无效.'); // 移除信息日志
      stopGlobalTimer(); // 保持这个停止调用
    }
  }

  /**
   * 停止全局定时器
   */
  function stopGlobalTimer() {
    if (globalTimer.value) {
      console.log('[AutoAction] 停止全局定时器.');
      clearTimeout(globalTimer.value);
      globalTimer.value = null;
      lastGlobalActionIndex.value = -1; // 重置顺序索引
      runtimeState.value.globalTimerStartTime = null; // 清除启动时间
    }
  }

  /**
   * 重启全局定时器
   */
  function restartGlobalTimer() {
    stopGlobalTimer();
    // 确保操作加载完成后再启动
    if (isActionsLoaded.value) {
      startGlobalTimer();
    }
  }

  // --- 独立定时任务管理 ---

  /**
   * 停止指定的独立定时器
   * @param actionId 操作项ID
   */
  function stopIndividualTimer(actionId: string) {
    const timer = runtimeState.value.scheduledTimers[actionId];
    if (timer) {
      // console.log(`[AutoAction] 停止独立定时器: ${actionId}`); // 移除调试日志
      clearTimeout(timer);
      delete runtimeState.value.scheduledTimers[actionId];
      delete runtimeState.value.timerStartTimes[actionId]; // 清除启动时间记录
    }
  }

  /**
   * 为指定的独立定时任务启动定时器
   * @param action 操作项配置
   */
  function startIndividualTimer(action: AutoActionItem) {
    // 如果定时器已存在、操作未启用或操作使用全局定时器，则不启动
    if (runtimeState.value.scheduledTimers[action.id] || !action.enabled || action.triggerConfig.useGlobalTimer) return;

    // 获取或设置默认间隔时间
    const intervalSeconds = action.triggerConfig.intervalSeconds || 300;
    if (intervalSeconds <= 0) return; // 间隔无效

    const intervalMs = intervalSeconds * 1000;
    // console.log(`[AutoAction] 启动独立定时器: ${action.name} (${action.id})`); // 移除调试日志

    // 定义定时器触发时执行的函数
    const timerFunc = () => {
      // 获取最新的操作状态，以防在此期间发生变化
      const currentAction = autoActions.value.find(a => a.id === action.id);
      if (!currentAction) {
        // 如果操作已被删除，停止定时器
        stopIndividualTimer(action.id);
        return;
      }
      // 在执行前再次检查条件
      const shouldExecute = currentAction.enabled &&
        !currentAction.triggerConfig.useGlobalTimer && // 确认仍未使用全局定时器
        (!currentAction.triggerConfig.onlyDuringLive || isLive.value) &&
        (!currentAction.triggerConfig.ignoreTianXuan || !isTianXuanActive.value);

      if (shouldExecute) {
        // 构建上下文并执行操作
        const context = buildExecutionContext(null, roomId.value, TriggerType.SCHEDULED);
        // 手动执行定时任务
        const template = getRandomTemplate(currentAction.template);
        if (template && roomId.value) {
          const formattedContent = evaluateTemplateExpressions(template, context);
          // 更新执行时间
          runtimeState.value.lastExecutionTime[currentAction.id] = Date.now();
          // 发送弹幕
          if (currentAction.actionConfig.delaySeconds && currentAction.actionConfig.delaySeconds > 0) {
            setTimeout(() => {
              biliFunc.sendLiveDanmaku(roomId.value!, formattedContent).catch(err => console.error("[AutoAction] 发送弹幕失败:", err));
            }, currentAction.actionConfig.delaySeconds * 1000);
          } else {
            biliFunc.sendLiveDanmaku(roomId.value, formattedContent).catch(err => console.error("[AutoAction] 发送弹幕失败:", err));
          }
        }
      }

      // 仅当操作仍然启用且未使用全局定时器时，才重新安排下一次触发
      if (currentAction.enabled && !currentAction.triggerConfig.useGlobalTimer) {
        const rescheduleIntervalMs = (currentAction.triggerConfig.intervalSeconds || 300) * 1000;
        runtimeState.value.scheduledTimers[action.id] = setTimeout(timerFunc, rescheduleIntervalMs);
        runtimeState.value.timerStartTimes[action.id] = Date.now(); // 重设计时器时更新启动时间
      } else {
        // 如果条件不再满足 (例如，被禁用或切换到全局定时器)，停止此独立定时器
        stopIndividualTimer(action.id);
      }
    };
    // 首次启动定时器
    runtimeState.value.scheduledTimers[action.id] = setTimeout(timerFunc, intervalMs);
    runtimeState.value.timerStartTimes[action.id] = Date.now(); // 记录首次启动时间
  }

  /**
   * 启动所有已启用的独立定时任务
   */
  function startIndividualScheduledActions() {
    if (!roomId.value || !autoActions.value) return;

    // 如果定时任务类型被禁用，则不启动任何定时器
    if (!enabledTriggerTypes.value[TriggerType.SCHEDULED]) return;

    // 筛选出所有启用且不使用全局定时器的定时任务
    const individualActions = autoActions.value.filter(action =>
      action.triggerType === TriggerType.SCHEDULED &&
      action.enabled &&
      !action.triggerConfig.useGlobalTimer
    );
    // 为每个符合条件的任务启动独立定时器
    individualActions.forEach(action => startIndividualTimer(action));
  }

  /**
   * 停止所有独立定时任务的定时器
   */
  function stopAllIndividualScheduledActions() {
    console.log('[AutoAction] 停止所有独立定时器.');
    // 遍历并停止所有记录在 runtimeState 中的独立定时器
    Object.keys(runtimeState.value.scheduledTimers).forEach(stopIndividualTimer);
  }

  // --- 初始化与事件监听 ---
  let isInited = false
  /**
   * 初始化自动操作系统
   */
  function init() {
    if (isInited) {
      return;
    }
    isInited = true;
    // 计算属性，判断所有持久化数据是否加载完成
    const allLoaded = computed(() => isActionsLoaded.value && isIntervalLoaded.value && isModeLoaded.value && isIndexLoaded.value && isTriggersLoaded.value);

    // 监听所有数据加载状态
    watch(allLoaded, (loaded) => {
      if (loaded) {
        console.log('[AutoAction] 所有设置已从 IDB 加载.');
        // 确保加载的操作项有默认配置
        autoActions.value.forEach(action => {
          if (!action.triggerConfig) action.triggerConfig = {};
          if (action.triggerType === TriggerType.SCHEDULED) {
            // 为定时任务设置默认值（如果缺失）
            if (action.triggerConfig.useGlobalTimer === undefined) action.triggerConfig.useGlobalTimer = false;
            if (action.triggerConfig.intervalSeconds === undefined) action.triggerConfig.intervalSeconds = 300;
            if (action.triggerConfig.schedulingMode === undefined) action.triggerConfig.schedulingMode = 'random';
          }
        });
        // 确保全局顺序索引已初始化 (以防 IDB 返回 null/undefined)
        if (lastGlobalActionIndex.value === null || lastGlobalActionIndex.value === undefined) {
          lastGlobalActionIndex.value = -1;
        }
        // 确保触发类型启用状态已初始化
        if (!enabledTriggerTypes.value) {
          enabledTriggerTypes.value = {
            [TriggerType.DANMAKU]: true,
            [TriggerType.GIFT]: true,
            [TriggerType.GUARD]: true,
            [TriggerType.FOLLOW]: true,
            [TriggerType.ENTER]: true,
            [TriggerType.SCHEDULED]: true,
            [TriggerType.SUPER_CHAT]: true
          };
        }
        checkTianXuanStatus(); // 检查天选状态
        startIndividualScheduledActions(); // 启动独立定时任务
        startGlobalTimer(); // 启动全局定时器 (如果需要)
        registerEventListeners(); // 注册弹幕事件监听器
      }
    }, { immediate: true }); // 立即执行一次检查
  }

  // 初始化模块
  const giftThankModule = useGiftThank(isLive, roomId, isTianXuanActive, biliFunc.sendLiveDanmaku);
  const guardPmModule = useGuardPm(
    roomId,
    (userId: number, message: string) => biliFunc.sendPrivateMessage(userId, message),
    biliFunc.sendLiveDanmaku
  );
  const followThankModule = useFollowThank(isLive, roomId, isTianXuanActive, biliFunc.sendLiveDanmaku);
  const entryWelcomeModule = useEntryWelcome(isLive, roomId, isTianXuanActive, biliFunc.sendLiveDanmaku);
  const autoReplyModule = useAutoReply(isLive, roomId, biliFunc.sendLiveDanmaku);
  const scheduledDanmakuModule = useScheduledDanmaku(isLive, roomId, biliFunc.sendLiveDanmaku);
  const superChatThankModule = useSuperChatThank(isLive, roomId, isTianXuanActive, biliFunc.sendLiveDanmaku);

  /**
   * 向弹幕客户端注册事件监听器
   */
  function registerEventListeners() {
    // 检查弹幕客户端连接状态
    if (danmakuClient.state !== 'connected') {
      console.warn('[AutoAction] 弹幕客户端未就绪, 延迟注册监听器.');
      // 可选: 等待弹幕客户端发出就绪事件
      // return;
    }
    try {
      // 监听各种事件，并交由 processEvent 处理
      danmakuClient.onEvent('danmaku', (event) => processEvent(event, TriggerType.DANMAKU));
      danmakuClient.onEvent('gift', (event) => processEvent(event, TriggerType.GIFT));
      danmakuClient.onEvent('guard', (event) => processEvent(event, TriggerType.GUARD));
      danmakuClient.onEvent('sc', (event) => processEvent(event, TriggerType.SUPER_CHAT));
      danmakuClient.onEvent('enter', (event) => processEvent(event, TriggerType.ENTER));
      danmakuClient.onEvent('follow', (event) => processEvent(event, TriggerType.FOLLOW));
      console.log('[AutoAction] 事件监听器已注册.');
    } catch (err) {
      console.error('[AutoAction] 注册事件监听器时出错:', err);
    }
  }

  // --- 操作项管理 (增删改查) ---

  /**
   * 添加一个新的自动操作项
   * @param triggerType 触发器类型
   * @returns 新创建的操作项
   */
  function addAutoAction(triggerType: TriggerType): AutoActionItem {
    const newAction = createDefaultAutoAction(triggerType); // 创建默认操作项
    autoActions.value.push(newAction); // 添加到列表
    // 如果是定时任务，根据配置启动相应的定时器
    if (triggerType === TriggerType.SCHEDULED) {
      if (newAction.triggerConfig.useGlobalTimer) {
        restartGlobalTimer(); // 可能需要启动或重启全局定时器
      } else {
        startIndividualTimer(newAction); // 启动独立的定时器
      }
    }
    // console.log('[AutoAction] 已添加:', newAction.name, newAction.id); // 移除调试日志
    return newAction;
  }

  /**
   * 移除一个自动操作项
   * @param id 要移除的操作项 ID
   */
  function removeAutoAction(id: string) {
    const index = autoActions.value.findIndex(action => action.id === id);
    if (index !== -1) {
      const removedAction = autoActions.value[index];
      // console.log('[AutoAction] 正在移除:', removedAction.name, id); // 移除调试日志

      let needsGlobalTimerAfterRemoval = false;
      let wasGlobalTimerAction = false;

      // 如果移除的是定时任务，需要特殊处理定时器
      if (removedAction.triggerType === TriggerType.SCHEDULED) {
        stopIndividualTimer(id); // 停止可能存在的独立定时器
      }

      // 从列表中移除操作项
      autoActions.value.splice(index, 1);

      // 如果移除了一个全局定时任务，但还有其他全局任务存在，则重启全局定时器以更新状态
      if (wasGlobalTimerAction && needsGlobalTimerAfterRemoval) {
        restartGlobalTimer();
      }
    }
  }

  /**
   * 切换自动操作项的启用/禁用状态
   * @param id 操作项 ID
   * @param enabled 目标状态 (true 为启用, false 为禁用)
   */
  function toggleAutoAction(id: string, enabled: boolean) {
    const action = autoActions.value.find(action => action.id === id);
    if (action) {
      // console.log(`[AutoAction] 切换 ${action.name} (${id}) 状态为 ${enabled}`); // 移除调试日志
      action.enabled = enabled;

      // 如果是定时任务，需要相应地启动或停止定时器
      if (action.triggerType === TriggerType.SCHEDULED) {
        if (action.triggerConfig.useGlobalTimer) {
          // 启用/禁用全局定时任务时，重启全局定时器以确保其根据剩余任务正确运行或停止
          restartGlobalTimer();
        } else {
          // 独立定时任务
          if (enabled) {
            startIndividualTimer(action); // 尝试启动其独立定时器
          } else {
            stopIndividualTimer(id); // 停止其独立定时器
          }
        }
      }
    }
  }

  // --- 辅助函数与执行逻辑 ---

  // 模拟的天选状态检查函数 (需替换为实际实现)
  function checkTianXuanStatus() {
    // TODO: 实现检查天选时刻状态的逻辑
    // isTianXuanActive.value = a_real_check();
  }
  // 定时检查天选状态 (每5分钟)
  const tianXuanTimer = setInterval(checkTianXuanStatus, 5 * 60 * 1000);

  /**
   * 处理接收到的事件
   * @param event 事件数据
   * @param triggerType 事件对应的触发器类型
   */
  function processEvent(event: EventModel, triggerType: TriggerType) {
    if (!roomId.value) return; // 房间 ID 无效则跳过
    // 检查触发类型是否启用
    if (!enabledTriggerTypes.value[triggerType]) return;
    // 根据触发类型调用相应模块的处理函数
    switch (triggerType) {
      case TriggerType.DANMAKU:
        // 调用弹幕自动回复模块
        autoReplyModule.onDanmaku(event, autoActions.value, runtimeState.value);
        break;
      case TriggerType.GIFT:
        // 调用礼物感谢模块
        giftThankModule.processGift(event, autoActions.value, runtimeState.value);
        break;
      case TriggerType.GUARD:
        // 调用舰长感谢模块
        guardPmModule.handleGuardBuy(autoActions.value, event, runtimeState.value);
        break;
      case TriggerType.FOLLOW:
        // 调用关注感谢模块
        followThankModule.processFollow(event, autoActions.value, runtimeState.value);
        break;
      case TriggerType.ENTER:
        // 调用入场欢迎模块
        entryWelcomeModule.processEnter(event, autoActions.value, runtimeState.value);
        break;
      case TriggerType.SUPER_CHAT:
        // 调用醒目留言感谢模块
        superChatThankModule.processSuperChat(event, autoActions.value, runtimeState.value);
        break;
      // 定时任务不在此处理，由定时器调用
      default:
        console.warn(`[AutoAction] 未知触发类型: ${triggerType}`);
    }
  }

  /**
   * 获取定时任务的计时器信息 (用于显示剩余时间等)
   * @param actionId 定时任务ID
   * @returns 计时器信息（包含剩余毫秒数估算），或 null (如果任务不存在、未启用或计时器未运行)
   */
  function getScheduledTimerInfo(actionId: string): { actionId: string; intervalMs: number; remainingMs: number } | null {
    // 查找对应的操作项
    const action = autoActions.value.find(a => a.id === actionId);
    // 必须是已启用的定时任务
    if (!action || action.triggerType !== TriggerType.SCHEDULED || !action.enabled) {
      return null;
    }

    const usingGlobal = action.triggerConfig.useGlobalTimer ?? false; // 是否使用全局定时器
    let intervalSeconds: number; // 间隔秒数
    let isActive = false; // 定时器是否在运行
    let startTime: number | null = null; // 定时器本轮启动时间

    if (usingGlobal) {
      // 使用全局定时器
      intervalSeconds = globalIntervalSeconds.value;
      isActive = globalTimer.value !== null; // 全局定时器是否在运行
      startTime = runtimeState.value.globalTimerStartTime; // 获取全局定时器的启动时间
    } else {
      // 使用独立定时器
      intervalSeconds = action.triggerConfig.intervalSeconds || 300;
      isActive = !!runtimeState.value.scheduledTimers[actionId]; // 独立定时器是否在运行
      startTime = runtimeState.value.timerStartTimes[actionId] ?? null; // 获取独立定时器的启动时间
    }

    // 如果定时器未激活、间隔无效或没有启动时间，则无法计算剩余时间
    if (!isActive || intervalSeconds <= 0 || startTime === null) {
      return null;
    }

    const intervalMs = intervalSeconds * 1000; // 间隔毫秒数
    const now = Date.now(); // 当前时间
    // 计算剩余时间 (确保不为负数)
    const remainingMs = Math.max(0, startTime + intervalMs - now);

    return {
      actionId,
      intervalMs,
      remainingMs // 返回计算出的剩余时间
    };
  }

  /**
   * 在列表中向上或向下移动一个操作项
   * 这会影响全局定时器顺序模式下的执行顺序
   * @param id 要移动的操作项 ID
   * @param direction 'up' (向上) 或 'down' (向下)
   */
  function moveAction(id: string, direction: 'up' | 'down') {
    const index = autoActions.value.findIndex(action => action.id === id); // 查找当前索引
    if (index === -1) {
      console.warn(`[AutoAction] 无法移动操作: 未找到 ID ${id}.`);
      return;
    }

    const actionToMove = autoActions.value[index]; // 获取要移动的操作项

    // 简单的在整个列表中重新排序
    // 更复杂的逻辑可以只在相同触发类型的操作中排序
    let newIndex = index;
    if (direction === 'up' && index > 0) {
      // 向上移动
      newIndex = index - 1;
    } else if (direction === 'down' && index < autoActions.value.length - 1) {
      // 向下移动
      newIndex = index + 1;
    }

    if (newIndex !== index) { // 如果位置确实改变了
      // console.log(`[AutoAction] 移动操作 ${actionToMove.name} (${id}) 从 ${index} 到 ${newIndex}`); // 移除调试日志
      // 从原位置移除，并插入到新位置
      autoActions.value.splice(index, 1);
      autoActions.value.splice(newIndex, 0, actionToMove);
      // 如果移动的是使用全局定时器的定时任务，重置全局顺序索引，以便下次重新计算
      if (actionToMove.triggerType === TriggerType.SCHEDULED && actionToMove.triggerConfig.useGlobalTimer) {
        lastGlobalActionIndex.value = -1; // 强制在下一次触发时重新计算索引
      }
    }
  }

  // 监听全局间隔设置的变化，如果变化且有效，则重启全局定时器
  watch(globalIntervalSeconds, (newInterval, oldInterval) => {
    if (newInterval !== oldInterval && newInterval > 0) {
      console.log('[AutoAction] 全局间隔已更改, 重启全局定时器.');
      restartGlobalTimer();
    }
  });

  /**
   * 计算属性：获取下一个将在全局顺序模式下执行的操作
   */
  const nextScheduledAction = computed<AutoActionItem | null>(() => {
    // 仅在顺序模式下有效，且操作列表存在
    if (globalSchedulingMode.value !== 'sequential' || !autoActions.value) {
      return null;
    }

    // 筛选出当前符合全局定时器条件的活动操作
    const eligibleActions = autoActions.value.filter(action =>
      action.triggerType === TriggerType.SCHEDULED &&
      action.enabled &&
      action.triggerConfig.useGlobalTimer &&
      (!action.triggerConfig.onlyDuringLive || isLive.value) &&
      (!action.triggerConfig.ignoreTianXuan || !isTianXuanActive.value)
    );

    if (eligibleActions.length === 0) {
      return null; // 没有符合条件的操作
    }

    // 计算下一个索引
    // 注意：lastGlobalActionIndex 指向的是 *上次* 执行的操作在当时 eligibleActions 列表中的索引
    const nextIndex = (lastGlobalActionIndex.value + 1) % eligibleActions.length;

    return eligibleActions[nextIndex]; // 返回下一个将要执行的操作
  });

  /**
   * 手动设置下一个在全局顺序模式下执行的操作
   * @param actionId 要设置为下一个执行的操作ID
   */
  function setNextGlobalAction(actionId: string) {
    if (globalSchedulingMode.value !== 'sequential') {
      console.warn('[AutoAction] 只能在顺序模式下手动指定下一个操作。');
      return;
    }

    // 筛选出当前符合条件的活动操作 (与 nextScheduledAction 逻辑一致)
    const eligibleActions = autoActions.value.filter(action =>
      action.triggerType === TriggerType.SCHEDULED &&
      action.enabled &&
      action.triggerConfig.useGlobalTimer &&
      (!action.triggerConfig.onlyDuringLive || isLive.value) &&
      (!action.triggerConfig.ignoreTianXuan || !isTianXuanActive.value)
    );

    if (eligibleActions.length === 0) {
      console.warn('[AutoAction] 没有符合条件的活动操作可供指定。');
      return;
    }

    // 找到目标操作在当前合格列表中的索引
    const targetIndex = eligibleActions.findIndex(action => action.id === actionId);

    if (targetIndex === -1) {
      console.warn(`[AutoAction] 指定的操作ID ${actionId} 不存在或不符合当前执行条件。`);
      return;
    }

    // 设置 lastGlobalActionIndex 为目标索引的前一个索引
    // 这样，在下一次 handleGlobalTimerTick 中计算 (lastGlobalActionIndex + 1) % length 时，就会得到 targetIndex
    // 如果目标是列表中的第一个 (index 0)，则将 lastGlobalActionIndex 设置为列表最后一个元素的索引
    lastGlobalActionIndex.value = (targetIndex === 0) ? eligibleActions.length - 1 : targetIndex - 1;

    console.log(`[AutoAction] 手动指定下一个执行的操作为: ${eligibleActions[targetIndex].name} (ID: ${actionId}), 将在下一个计时周期执行。`);

    // 重启全局计时器，以便立即应用更改并在下一个周期执行指定的操作
    // （如果不重启，则会在当前周期结束后，按新的索引执行）
    restartGlobalTimer();
  }

  /**
   * 手动触发指定类型的测试逻辑
   * @param triggerType 要测试的触发类型
   * @param testUid 测试用的UID（仅用于私信测试）
   */
  function triggerTestActionByType(triggerType: TriggerType, testUid?: number) {
    console.log(`[AutoAction Test] 准备测试类型: ${triggerType}`);

    // 查找所有属于该类型且已启用的操作 (包括触发器类型本身是否启用)
    const actionsToTest = autoActions.value.filter(a =>
      a.triggerType === triggerType &&
      a.enabled &&
      enabledTriggerTypes.value[triggerType]
    );

    if (actionsToTest.length === 0) {
      console.warn(`[AutoAction Test] 没有找到启用的 ${triggerType} 类型的操作可供测试。`);
      if (!enabledTriggerTypes.value[triggerType]) {
          console.warn(`[AutoAction Test] 触发类型 ${triggerType} 本身已被禁用。`);
      }
      return;
    }

    // 创建基础测试事件属性
    const baseTestEvent: Partial<EventModel> = {
      uid: testUid || 10000,
      uname: '测试用户',
      uface: '',
      open_id: 'test-open-id',
      ouid: 'test-ouid',
      time: Math.floor(Date.now() / 1000),
      num: 1,
      price: 0,
      guard_level: Math.floor(Math.random() * 3) + 1, // 1-3
      fans_medal_wearing_status: true,
      fans_medal_name: '测试牌子',
      fans_medal_level: Math.floor(Math.random() * 30) + 1 // 1-10
    };

    // 根据不同触发类型创建不同的模拟事件
    let testEvent: EventModel;

    switch (triggerType) {
      case TriggerType.DANMAKU:
        testEvent = {
          ...baseTestEvent,
          type: EventDataTypes.Message,
          msg: '测试弹幕消息',
        } as EventModel;
        break;
      case TriggerType.GIFT:
        testEvent = {
          ...baseTestEvent,
          type: EventDataTypes.Gift,
          msg: '测试礼物',
          price: 100,
          num: 5
        } as EventModel;
        break;
      case TriggerType.GUARD:
        const level = Math.floor(Math.random() * 3) + 1; // 1-3
        testEvent = {
          ...baseTestEvent,
          type: EventDataTypes.Guard,
          msg: '舰长',
          price: level === 1 ? 19998 : level === 2 ? 1998 : 198,
          guard_level: level, // 1-3
        } as EventModel;
        break;
      case TriggerType.FOLLOW:
        testEvent = {
          ...baseTestEvent,
          type: EventDataTypes.Follow,
        } as EventModel;
        break;
      case TriggerType.ENTER:
        testEvent = {
          ...baseTestEvent,
          type: EventDataTypes.Enter,
        } as EventModel;
        break;
      case TriggerType.SUPER_CHAT:
        testEvent = {
          ...baseTestEvent,
          type: EventDataTypes.SC,
          msg: '这是一条测试SC消息',
          price: Math.floor(Math.random() * 1000) + 10,
        } as EventModel;
        break;
      case TriggerType.SCHEDULED:
        // 对于定时任务，使用特殊的处理方式
        if (actionsToTest.length > 0) {
          const action = actionsToTest[0];
          const context = buildExecutionContext(null, roomId.value, TriggerType.SCHEDULED);
          const template = getRandomTemplate(action.template);

          if (template && roomId.value) {
            const formattedContent = evaluateTemplateExpressions(template, context);
            runtimeState.value.lastExecutionTime[action.id] = Date.now();

            console.log(`[定时任务测试] 正在测试定时任务: ${action.name}, 内容: ${formattedContent}`);

            if (action.actionConfig.delaySeconds && action.actionConfig.delaySeconds > 0) {
              console.log(`[定时任务测试] 将在 ${action.actionConfig.delaySeconds} 秒后发送弹幕`);
              setTimeout(() => {
                biliFunc.sendLiveDanmaku(roomId.value!, formattedContent)
                  .catch(err => console.error("[AutoAction] 发送弹幕失败:", err));
              }, action.actionConfig.delaySeconds * 1000);
            } else {
              biliFunc.sendLiveDanmaku(roomId.value, formattedContent)
                .catch(err => console.error("[AutoAction] 发送弹幕失败:", err));
            }
          }
        }
        return; // 定时任务不需要继续处理
      default:
        console.warn(`[AutoAction Test] 未知的触发类型: ${triggerType}`);
        return;
    }

    console.log(`[AutoAction Test] 创建测试事件:`, testEvent);

    // 直接调用processEvent进行测试，将创建的测试事件和触发类型传入
    processEvent(testEvent, triggerType);
  }

  // --- 导出 Store 成员 ---
  return {
    autoActions, // 所有操作项列表 (ref)
    runtimeState: computed(() => runtimeState.value), // 运行时状态 (计算属性)
    globalIntervalSeconds, // 全局定时器间隔 (ref from IDB)
    globalSchedulingMode, // 全局定时器模式 (ref from IDB)
    nextScheduledAction, // 下一个顺序执行的操作 (计算属性)
    isLive, // 直播状态 (计算属性)
    isTianXuanActive, // 天选状态 (ref)
    enabledTriggerTypes, // 触发类型启用状态
    init, // 初始化函数
    addAutoAction, // 添加操作
    removeAutoAction, // 移除操作
    toggleAutoAction, // 切换操作启用状态
    moveAction, // 移动操作顺序
    setNextGlobalAction, // 手动设置下一个全局顺序操作
    restartGlobalTimer, // 重启全局定时器
    getScheduledTimerInfo, // 获取定时任务计时器信息
    setTriggerTypeEnabled, // 设置触发类型启用状态
    // 暴露独立定时器控制函数 (如果 UI 需要单独控制)
    startIndividualTimer,
    stopIndividualTimer,
    stopAllIndividualScheduledActions,
    startIndividualScheduledActions,
    triggerTestActionByType // 新的 action
  };
});// HMR (热模块替换) 支持
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAutoAction, import.meta.hot));
}

// 重新导出类型，方便外部使用
export { AutoActionItem, TriggerType, ActionType, Priority, KeywordMatchType };

