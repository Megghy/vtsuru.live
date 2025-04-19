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
  ExecutionContext,
  RuntimeState
} from '../types';

/**
 * 礼物感谢模块
 * @param isLive 是否处于直播状态
 * @param roomId 房间ID
 * @param isTianXuanActive 是否处于天选时刻
 * @param sendLiveDanmaku 发送弹幕函数
 */
export function useGiftThank(
  isLive: Ref<boolean>,
  roomId: Ref<number | undefined>,
  isTianXuanActive: Ref<boolean>,
  sendLiveDanmaku: (roomId: number, message: string) => Promise<boolean>
) {
  // 测试发送功能状态
  const lastTestTime = ref(0);
  const testCooldown = 5000; // 5秒冷却时间
  const testLoading = ref(false);

  /**
   * 处理礼物事件
   * @param event 礼物事件
   * @param actions 自动操作列表
   * @param runtimeState 运行时状态
   */
  function processGift(
    event: EventModel,
    actions: AutoActionItem[],
    runtimeState: RuntimeState
  ) {
    if (!roomId.value) return;

    // 过滤出有效的礼物感谢操作
    const giftActions = actions.filter(action =>
      action.triggerType === TriggerType.GIFT &&
      action.enabled &&
      (!action.triggerConfig.onlyDuringLive || isLive.value) &&
      (!action.triggerConfig.ignoreTianXuan || !isTianXuanActive.value)
    );

    if (giftActions.length === 0) return;

    // 礼物基本信息
    const giftName = event.msg;
    const giftPrice = event.price / 1000;
    const giftCount = event.num;

    // 创建执行上下文
    const context = buildExecutionContext(event, roomId.value, TriggerType.GIFT);

    // 处理每个符合条件的操作
    for (const action of giftActions) {
      // 跳过不符合用户过滤条件的
      if (action.triggerConfig.userFilterEnabled) {
        if (action.triggerConfig.requireMedal && !event.fans_medal_wearing_status) continue;
        if (action.triggerConfig.requireCaptain && !event.guard_level) continue;
      }

      // 礼物过滤逻辑
      if (action.triggerConfig.filterMode === 'blacklist' &&
          action.triggerConfig.filterGiftNames?.includes(giftName)) continue;

      if (action.triggerConfig.filterMode === 'whitelist' &&
          !action.triggerConfig.filterGiftNames?.includes(giftName)) continue;

      if (action.triggerConfig.minValue && giftPrice < action.triggerConfig.minValue) continue;

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
          }, (action.actionConfig.delaySeconds || 0) * 1000);
        } else {
          sendLiveDanmaku(roomId.value!, formattedReply);
        }
      }
    }
  }

  /**
   * 测试发送礼物感谢弹幕
   */
  async function testSendThankMessage(
    action?: AutoActionItem
  ): Promise<{ success: boolean; message: string }> {
    // 检查是否在冷却期
    const now = Date.now();
    if (now - lastTestTime.value < testCooldown) {
      return {
        success: false,
        message: `请等待${Math.ceil((testCooldown - (now - lastTestTime.value)) / 1000)}秒后再次测试发送`
      };
    }

    if (!roomId.value) {
      return {
        success: false,
        message: '未设置房间号'
      };
    }

    if (!action) {
      return {
        success: false,
        message: '未指定要测试的操作'
      };
    }

    if (!action.templates || action.templates.length === 0) {
      return {
        success: false,
        message: '请至少添加一条模板'
      };
    }

    testLoading.value = true;
    lastTestTime.value = now;

    try {
      // 构建测试事件对象
      const testEvent: EventModel = {
        type: EventDataTypes.Gift,
        uname: '测试用户',
        uface: 'https://i0.hdslb.com/bfs/face/member/noface.jpg',
        uid: 123456,
        open_id: '123456',
        msg: '测试礼物',
        time: Date.now(),
        num: 1,
        price: 100000, // 100元
        guard_level: 0,
        fans_medal_level: 0,
        fans_medal_name: '',
        fans_medal_wearing_status: false,
        ouid: '123456'
      };

      // 创建测试上下文
      const context = buildExecutionContext(testEvent, roomId.value, TriggerType.GIFT);

      // 获取模板并格式化
      const template = getRandomTemplate(action.templates);
      if (!template) {
        return {
          success: false,
          message: '无法获取模板'
        };
      }

      const testMessage = formatTemplate(template, context);

      // 发送测试弹幕
      const success = await sendLiveDanmaku(roomId.value, testMessage);

      if (success) {
        return {
          success: true,
          message: '测试弹幕发送成功！'
        };
      } else {
        return {
          success: false,
          message: '测试弹幕发送失败，请检查B站登录状态和网络连接'
        };
      }
    } catch (error) {
      console.error('测试发送出错:', error);
      return {
        success: false,
        message: '发送过程出错'
      };
    } finally {
      testLoading.value = false;
    }
  }

  return {
    processGift,
    testSendThankMessage,
    testLoading,
    lastTestTime,
    testCooldown
  };
}