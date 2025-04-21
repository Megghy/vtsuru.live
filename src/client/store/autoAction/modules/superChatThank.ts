import { EventModel } from '@/api/api-models';
import { Ref } from 'vue';
import {
  executeActions,
  filterValidActions
} from '../actionUtils';
import {
  AutoActionItem,
  RuntimeState,
  TriggerType
} from '../types';

/**
 * 醒目留言感谢模块
 * @param isLive 是否处于直播状态
 * @param roomId 房间ID
 * @param isTianXuanActive 是否处于天选时刻
 * @param sendLiveDanmaku 发送弹幕函数
 */
export function useSuperChatThank(
  isLive: Ref<boolean>,
  roomId: Ref<number | undefined>,
  isTianXuanActive: Ref<boolean>,
  sendLiveDanmaku: (roomId: number, message: string) => Promise<boolean>
) {

  /**
   * 处理醒目留言事件
   * @param event 醒目留言事件
   * @param actions 自动操作列表
   * @param runtimeState 运行时状态
   */
  function processSuperChat(
    event: EventModel,
    actions: AutoActionItem[],
    runtimeState: RuntimeState
  ) {
    if (!roomId.value) return;

    // 使用通用函数过滤有效的SC感谢操作
    const scActions = filterValidActions(actions, TriggerType.SUPER_CHAT, isLive, isTianXuanActive);

    // 使用通用执行函数处理SC事件
    if (scActions.length > 0 && roomId.value) {
      executeActions(
        scActions,
        event,
        TriggerType.SUPER_CHAT,
        roomId.value,
        runtimeState,
        { sendLiveDanmaku },
        {
          customFilters: [
            // SC价格过滤
            (action, context) => {
              // 如果未设置SC过滤或选择了不过滤模式
              if (!action.triggerConfig.scFilterMode || action.triggerConfig.scFilterMode === 'none') {
                return true;
              }

              // 价格过滤模式
              if (action.triggerConfig.scFilterMode === 'price' &&
                  action.triggerConfig.scMinPrice &&
                  event.price < action.triggerConfig.scMinPrice * 1000) {
                return false;
              }

              return true;
            }
          ]
        }
      );
    }
  }

  return {
    processSuperChat,
  };
}