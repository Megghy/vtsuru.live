import { Ref } from 'vue';
import { useStorage } from '@vueuse/core';
import { GuardLevel, EventModel } from '@/api/api-models';
import {
  AutoActionItem,
  TriggerType,
  ActionType,
  RuntimeState
} from '../types';
import { formatTemplate, buildExecutionContext } from '../utils';

/**
 * 舰长私信模块
 * @param isLive 是否处于直播状态
 * @param roomId 房间ID
 * @param sendPrivateMessage 发送私信函数
 * @param sendLiveDanmaku 发送弹幕函数
 */
export function useGuardPm(
  isLive: Ref<boolean>,
  roomId: Ref<number | undefined>,
  sendPrivateMessage: (userId: number, message: string) => Promise<boolean>,
  sendLiveDanmaku?: (roomId: number, message: string) => Promise<boolean>
) {
  // 保留旧配置用于兼容
  const config = useStorage<{
    enabled: boolean;
    template: string;
    sendDanmakuConfirm: boolean;
    danmakuTemplate: string;
    preventRepeat: boolean;
    giftCodeMode: boolean;
    giftCodes: { level: number; codes: string[] }[];
    onlyDuringLive: boolean;
  }>(
    'autoAction.guardPmConfig',
    {
      enabled: false,
      template: '感谢 {{user.name}} 成为 {{guard.levelName}}！欢迎加入！',
      sendDanmakuConfirm: false,
      danmakuTemplate: '已私信 {{user.name}} 舰长福利！',
      preventRepeat: true,
      giftCodeMode: false,
      giftCodes: [],
      onlyDuringLive: true
    }
  );

  /**
   * 处理舰长事件 - 支持新的AutoActionItem结构
   * @param event 舰长事件
   * @param actions 自动操作列表
   * @param runtimeState 运行时状态
   */
  function processGuard(
    event: EventModel,
    actions: AutoActionItem[],
    runtimeState: RuntimeState
  ) {
    if (!roomId.value) return;

    const guardLevel = event.guard_level;
    if (guardLevel === GuardLevel.None) return; // 不是上舰事件

    // 过滤出有效的舰长私信操作
    const guardActions = actions.filter(action =>
      action.triggerType === TriggerType.GUARD &&
      action.enabled &&
      action.actionType === ActionType.SEND_PRIVATE_MSG &&
      (!action.triggerConfig.onlyDuringLive || isLive.value)
    );

    if (guardActions.length === 0) return;

    // 创建执行上下文
    const context = buildExecutionContext(event, roomId.value, TriggerType.GUARD);

    // 处理礼品码
    for (const action of guardActions) {
      // 防止重复发送
      if (action.triggerConfig.preventRepeat) {
        if (runtimeState.sentGuardPms.has(event.uid)) {
          console.log(`用户 ${event.uname} (${event.uid}) 已发送过上舰私信，跳过。`);
          continue;
        }
      }

      // 特定舰长等级过滤
      if (action.triggerConfig.guardLevels && !action.triggerConfig.guardLevels.includes(guardLevel)) {
        continue;
      }

      // 获取礼品码
      let giftCode = '';
      if (action.triggerConfig.giftCodes && action.triggerConfig.giftCodes.length > 0) {
        // 查找匹配等级的礼品码
        const levelCodes = action.triggerConfig.giftCodes.find(gc => gc.level === guardLevel);
        if (levelCodes && levelCodes.codes.length > 0) {
          giftCode = levelCodes.codes.shift() || '';
        } else {
          // 查找通用码 (level 0)
          const commonCodes = action.triggerConfig.giftCodes.find(gc => gc.level === GuardLevel.None);
          if (commonCodes && commonCodes.codes.length > 0) {
            giftCode = commonCodes.codes.shift() || '';
          } else {
            console.warn(`等级 ${guardLevel} 或通用礼品码已用完，无法发送给 ${event.uname}`);
          }
        }
      }

      // 更新上下文中的礼品码
      if (context.variables.guard) {
        context.variables.guard.giftCode = giftCode;
      }

      // 选择模板并格式化
      if (action.templates.length > 0) {
        const template = action.templates[0]; // 对于私信，使用第一个模板
        const formattedMessage = formatTemplate(template, context);

        // 发送私信
        sendPrivateMessage(event.uid, formattedMessage).then(success => {
          if (success) {
            console.log(`成功发送上舰私信给 ${event.uname} (${event.uid})`);
            if (action.triggerConfig.preventRepeat) {
              runtimeState.sentGuardPms.add(event.uid);
            }

            // 发送弹幕确认
            if (roomId.value && sendLiveDanmaku) {
              // 查找确认弹幕的设置
              const confirmActions = actions.filter(a =>
                a.triggerType === TriggerType.GUARD &&
                a.enabled &&
                a.actionType === ActionType.SEND_DANMAKU
              );

              if (confirmActions.length > 0 && confirmActions[0].templates.length > 0) {
                const confirmMsg = formatTemplate(confirmActions[0].templates[0], context);
                sendLiveDanmaku(roomId.value, confirmMsg);
              }
            }
          } else {
            console.error(`发送上舰私信给 ${event.uname} (${event.uid}) 失败`);
            // 失败时归还礼品码
            if (giftCode && action.triggerConfig.giftCodes) {
              const levelCodes = action.triggerConfig.giftCodes.find(gc => gc.level === guardLevel);
              if (levelCodes) {
                levelCodes.codes.push(giftCode);
              }
            }
          }
        });
      }
    }
  }

  /**
   * 处理上舰事件 - 旧方式实现，用于兼容现有代码
   */
  function onGuard(event: EventModel) {
    // 将在useAutoAction.ts中进行迁移，此方法保留但不实现具体逻辑
    console.log('舰长事件处理已迁移到新的AutoActionItem结构');
  }

  return {
    config,
    onGuard,
    processGuard
  };
}