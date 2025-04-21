import { computed, Ref } from 'vue';
import { GuardLevel, EventModel } from '@/api/api-models';
import {
  AutoActionItem,
  TriggerType,
  RuntimeState,
  ExecutionContext,
  ActionType
} from '../types';
import {
  filterValidActions,
  executeActions
} from '../actionUtils';
import { buildExecutionContext } from '../utils';

/**
 * 舰长私信模块
 * @param roomId 房间ID
 * @param sendPrivateMessage 发送私信函数
 * @param sendLiveDanmaku 发送弹幕函数
 */
export function useGuardPm(
  roomId: Ref<number | undefined>,
  sendPrivateMessage: (uid: number, message: string) => Promise<boolean>,
  sendLiveDanmaku: (roomId: number, message: string) => Promise<boolean>
) {
  /**
   * 处理舰长购买事件
   * @param actions 自动操作列表
   * @param event 舰长购买事件
   * @param runtimeState 运行时状态
   */
  function handleGuardBuy(
    actions: AutoActionItem[],
    event: any,
    runtimeState: RuntimeState
  ) {
    if (!roomId.value) return;

    // 使用通用函数过滤舰长事件的操作
    const isLiveRef = computed(() => true);
    const guardActions = filterValidActions(actions, TriggerType.GUARD, isLiveRef);

    // 使用通用执行函数处理舰长事件
    if (guardActions.length > 0 && roomId.value) {
      executeActions(
        guardActions,
        event,
        TriggerType.GUARD,
        roomId.value,
        runtimeState,
        { sendPrivateMessage, sendLiveDanmaku },
        {
          customFilters: [
            // 防止重复发送检查
            (action, context) => {
              if (action.triggerConfig.preventRepeat && event && event.uid) {
                // 确保 uid 是数字类型
                const uid = typeof event.uid === 'number' ? event.uid : parseInt(event.uid, 10);

                // 检查是否已经发送过
                if (runtimeState.sentGuardPms.has(uid)) {
                  return false;
                }

                // 添加到已发送集合
                runtimeState.sentGuardPms.add(uid);
              }
              return true;
            }
          ],
          customContextBuilder: (eventData, roomId, triggerType): ExecutionContext => {
            // 使用标准上下文构建方法
            const context = buildExecutionContext(eventData, roomId, triggerType);

            // 如果是舰长事件且有事件数据，处理礼品码
            if (triggerType === TriggerType.GUARD && eventData && eventData.guard_level !== undefined) {
              const guardLevel = eventData.guard_level;

              // 查找包含礼品码的操作
              guardActions.forEach(action => {
                // 找到对应等级的礼品码
                if (action.triggerConfig.giftCodes && action.triggerConfig.giftCodes.length > 0) {
                  // 优先查找特定等级的礼品码
                  let levelCodesEntry = action.triggerConfig.giftCodes.find(gc => gc.level === guardLevel);

                  // 如果没有找到特定等级的礼品码，尝试查找通用礼品码（level为0）
                  if (!levelCodesEntry) {
                    levelCodesEntry = action.triggerConfig.giftCodes.find(gc => gc.level === 0);
                  }

                  if (levelCodesEntry && levelCodesEntry.codes && levelCodesEntry.codes.length > 0) {
                    // 随机选择一个礼品码
                    const randomIndex = Math.floor(Math.random() * levelCodesEntry.codes.length);
                    const randomCode = levelCodesEntry.codes[randomIndex];
                    // 确保guard变量存在并设置礼品码
                    if (context.variables.guard) {
                      context.variables.guard.giftCode = randomCode;
                      // 在上下文中存储选中的礼品码信息以供后续消耗
                      context.variables.guard.selectedGiftCode = {
                        code: randomCode,
                        level: levelCodesEntry.level
                      };
                    }
                  }
                }
              });
            }

            return context;
          },
          onSuccess: (action: AutoActionItem, context: ExecutionContext) => {
            // 检查是否需要消耗礼品码
            if (
              action.actionType === ActionType.SEND_PRIVATE_MSG &&
              action.triggerConfig.consumeGiftCode &&
              context.variables.guard?.selectedGiftCode
            ) {
              const { code: selectedCode, level: selectedLevel } = context.variables.guard.selectedGiftCode;

              console.log(`[AutoAction] 尝试消耗礼品码: ActionID=${action.id}, Level=${selectedLevel}, Code=${selectedCode}`);

              // 确保 giftCodes 存在且为数组
              if (Array.isArray(action.triggerConfig.giftCodes)) {
                // 找到对应等级的礼品码条目
                const levelCodesEntry = action.triggerConfig.giftCodes.find(gc => gc.level === selectedLevel);

                if (levelCodesEntry && Array.isArray(levelCodesEntry.codes)) {
                  // 找到要删除的礼品码的索引
                  const codeIndex = levelCodesEntry.codes.indexOf(selectedCode);

                  if (codeIndex > -1) {
                    // 从数组中移除礼品码
                    levelCodesEntry.codes.splice(codeIndex, 1);
                    console.log(`[AutoAction] 成功消耗礼品码: ActionID=${action.id}, Level=${selectedLevel}, Code=${selectedCode}. 剩余 ${levelCodesEntry.codes.length} 个。`);
                    // !!! 重要提示: 此处直接修改了 action 对象。
                    // !!! 请确保你的状态管理允许这种修改，或者调用 store action 来持久化更新。
                    // 例如: store.updateActionGiftCodes(action.id, selectedLevel, levelCodesEntry.codes);
                  } else {
                    console.warn(`[AutoAction] 未能在等级 ${selectedLevel} 中找到要消耗的礼品码: ${selectedCode}, ActionID=${action.id}`);
                  }
                } else {
                  console.warn(`[AutoAction] 未找到等级 ${selectedLevel} 的礼品码列表或列表格式不正确, ActionID=${action.id}`);
                }
              } else {
                console.warn(`[AutoAction] Action ${action.id} 的 giftCodes 配置不存在或不是数组。`);
              }
            }
          }
        }
      );
    }
  }

  /**
   * 获取舰长等级名称
   * @param level 舰长等级
   * @returns 舰长等级名称
   */
  function getGuardLevelName(level: number): string {
    switch (level) {
      case 1: return '总督';
      case 2: return '提督';
      case 3: return '舰长';
      default: return '未知等级';
    }
  }

  return {
    handleGuardBuy
  };
}