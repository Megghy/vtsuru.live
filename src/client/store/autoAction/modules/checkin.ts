import { ref, Ref, computed } from 'vue';
import { EventModel, EventDataTypes } from '@/api/api-models';
import { ActionType, AutoActionItem, RuntimeState, TriggerType, Priority, KeywordMatchType } from '../types';
import { usePointStore } from '@/store/usePointStore';
import { processTemplate, executeActions } from '../actionUtils';
import { buildExecutionContext } from '../utils';
import { v4 as uuidv4 } from 'uuid';
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval';
import { GuidUtils } from '@/Utils';
import { createDefaultAutoAction } from '../utils';

// 签到配置接口
export interface CheckInConfig {
  enabled: boolean;
  command: string;
  points: number;
  cooldownSeconds: number;
  onlyDuringLive: boolean; // 仅在直播时可签到
  sendReply: boolean; // 是否发送签到回复消息
  successAction: AutoActionItem;  // 使用 AutoActionItem 替代字符串
  cooldownAction: AutoActionItem; // 使用 AutoActionItem 替代字符串
  earlyBird: {
    enabled: boolean;
    windowMinutes: number;
    bonusPoints: number;
    successAction: AutoActionItem; // 使用 AutoActionItem 替代字符串
  };
}

// 创建默认配置
function createDefaultCheckInConfig(): CheckInConfig {
  const successAction = createDefaultAutoAction(TriggerType.DANMAKU);
  successAction.name = '签到成功回复';
  successAction.template = '@{{user.name}} 签到成功，获得 {{checkin.totalPoints}} 积分。';

  const cooldownAction = createDefaultAutoAction(TriggerType.DANMAKU);
  cooldownAction.name = '签到冷却回复';
  cooldownAction.template = '{{user.name}} 你今天已经签到过了，明天再来吧~';

  const earlyBirdAction = createDefaultAutoAction(TriggerType.DANMAKU);
  earlyBirdAction.name = '早鸟签到回复';
  earlyBirdAction.template = '恭喜 {{user.name}} 完成早鸟签到！额外获得 {{bonusPoints}} 积分，共获得 {{totalPoints}} 积分！';

  return {
    enabled: false,
    command: '签到',
    points: 10,
    cooldownSeconds: 3600, // 1小时
    onlyDuringLive: true, // 默认仅在直播时可签到
    sendReply: true, // 默认发送回复消息
    successAction,
    cooldownAction,
    earlyBird: {
      enabled: false,
      windowMinutes: 30,
      bonusPoints: 5,
      successAction: earlyBirdAction
    }
  };
}

// 签到记录存储
interface CheckInStorage {
  lastCheckIn: Record<string, number>; // ouid -> timestamp
  users: Record<string, UserCheckInData>; // 用户签到详细数据
}

// 用户签到数据
export interface UserCheckInData {
  ouid: string;         // 用户ID
  username: string;    // 用户名称
  totalCheckins: number; // 累计签到次数
  streakDays: number;  // 连续签到天数
  lastCheckInTime: number; // 上次签到时间
  earlyBirdCount: number; // 早鸟签到次数
  firstCheckInTime: number; // 首次签到时间
}

/**
 * 签到功能核心逻辑
 */
export function useCheckIn(
  isLive: Ref<boolean>,
  roomId: Ref<number | undefined>,
  liveStartTime: Ref<number | null>,
  isTianXuanActive: Ref<boolean>,
  sendDanmaku: (roomId: number, message: string) => Promise<boolean>
) {
  const pointStore = usePointStore();

  // 使用 IndexedDB 持久化存储签到配置
  const { data: checkInConfig, isFinished: isConfigLoaded } = useIDBKeyval<CheckInConfig>(
    'autoAction.checkin.config',
    createDefaultCheckInConfig(),
    {
      onError: (err) => {
        console.error('[CheckIn] IDB 错误 (配置):', err);
      }
    }
  );  // 使用 IndexedDB 持久化存储签到记录
  const { data: checkInStorage, isFinished: isStorageLoaded } = useIDBKeyval<CheckInStorage>(
    'autoAction.checkin.storage',
    {
      lastCheckIn: {},
      users: {}
    },
    {
      onError: (err) => {
        console.error('[CheckIn] IDB 错误 (记录):', err);
      }
    }
  );

  // 处理签到弹幕
  async function processCheckIn(
    event: EventModel,
    runtimeState: RuntimeState
  ) {
    // 确保配置和存储已加载
    if (!isConfigLoaded.value || !isStorageLoaded.value) {
      console.log('[CheckIn] 配置或存储尚未加载完成，跳过处理');
      return;
    }

    if (!roomId.value || !checkInConfig.value.enabled) {
      return;
    }

    // 检查是否仅在直播时可签到
    if (checkInConfig.value.onlyDuringLive && !isLive.value) {
      return;
    }

    // 跳过非弹幕事件
    if (event.type !== EventDataTypes.Message) {
      return;
    }

    // 检查弹幕内容是否匹配签到指令
    if (event.msg?.trim() !== checkInConfig.value.command) {
      return;
    }

    const userId = event.ouid;
    const username = event.uname || '用户';
    const currentTime = Date.now();

    // 检查是否已经在今天签到过
    const lastCheckInTime = checkInStorage.value.lastCheckIn[userId] || 0;

    // 判断上次签到时间是否为今天
    const lastCheckInDate = new Date(lastCheckInTime);
    const currentDate = new Date(currentTime);

    // 比较日期部分是否相同（年、月、日）
    const isSameDay = lastCheckInDate.getFullYear() === currentDate.getFullYear() &&
      lastCheckInDate.getMonth() === currentDate.getMonth() &&
      lastCheckInDate.getDate() === currentDate.getDate();

    // 检查是否发送冷却提示
    if (lastCheckInTime > 0 && isSameDay) {
      // 用户今天已经签到过，发送提示
      if (checkInConfig.value.sendReply) {
        // 构建上下文
        const cooldownContext = buildExecutionContext(event, roomId.value, TriggerType.DANMAKU, {
          user: { name: username, uid: userId }
        });
        // 统一用 executeActions
        executeActions(
          [checkInConfig.value.cooldownAction],
          event,
          TriggerType.DANMAKU,
          roomId.value,
          runtimeState,
          { sendLiveDanmaku: sendDanmaku },
          {
            customContextBuilder: () => cooldownContext
          }
        );
      }
      window.$notification.info({
        title: '签到提示',
        description: `${username} 重复签到, 已忽略`,
        duration: 5000
      });
      return;
    }

    // 计算积分奖励
    let pointsEarned = checkInConfig.value.points;
    let bonusPoints = 0;
    let isEarlyBird = false;

    // 检查是否符合早鸟奖励条件
    if (checkInConfig.value.earlyBird.enabled && liveStartTime.value) {
      const earlyBirdWindowMs = checkInConfig.value.earlyBird.windowMinutes * 60 * 1000;
      const timeSinceLiveStart = currentTime - liveStartTime.value;

      if (timeSinceLiveStart <= earlyBirdWindowMs) {
        bonusPoints = checkInConfig.value.earlyBird.bonusPoints;
        pointsEarned += bonusPoints;
        isEarlyBird = true;
      }
    }

    // 更新用户积分
    try {
      // 调用积分系统添加积分
      const point = await pointStore.addPoints(userId, pointsEarned, `签到奖励 (${format(new Date(), 'yyyy-MM-dd')})`, `${username} 完成签到`);
      if (checkInStorage.value) {
        if (!checkInStorage.value.lastCheckIn) {
          checkInStorage.value.lastCheckIn = {};
        }
        if (!checkInStorage.value.users) {
          checkInStorage.value.users = {};
        }
        let userData = checkInStorage.value.users[userId];
        if (!userData) {
          userData = {
            ouid: userId,
            username: username,
            totalCheckins: 0,
            streakDays: 0,
            lastCheckInTime: 0,
            earlyBirdCount: 0,
            firstCheckInTime: currentTime
          };
        }
        const lastCheckInDate = new Date(userData.lastCheckInTime);
        const currentDate = new Date(currentTime);
        const isYesterday =
          lastCheckInDate.getFullYear() === currentDate.getFullYear() &&
          lastCheckInDate.getMonth() === currentDate.getMonth() &&
          lastCheckInDate.getDate() === currentDate.getDate() - 1;
        if (!isSameDay) {
          if (isYesterday) {
            userData.streakDays += 1;
          } else if (userData.lastCheckInTime > 0) {
            userData.streakDays = 1;
          } else {
            userData.streakDays = 1;
          }
          userData.totalCheckins += 1;
          if (isEarlyBird) {
            userData.earlyBirdCount += 1;
          }
        }
        userData.lastCheckInTime = currentTime;
        userData.username = username;
        checkInStorage.value.users[userId] = userData;
        checkInStorage.value.lastCheckIn[userId] = currentTime;
      }
      if (roomId.value) {
        const checkInData = {
          checkin: {
            points: checkInConfig.value.points,
            bonusPoints: isEarlyBird ? bonusPoints : 0,
            totalPoints: pointsEarned,
            userPoints: point,
            isEarlyBird: isEarlyBird,
            time: new Date(currentTime),
            cooldownSeconds: checkInConfig.value.cooldownSeconds
          }
        };
        if (checkInConfig.value.sendReply) {
          const successContext = buildExecutionContext(event, roomId.value, TriggerType.DANMAKU, checkInData);
          const action = isEarlyBird ? checkInConfig.value.earlyBird.successAction : checkInConfig.value.successAction;
          executeActions(
            [action],
            event,
            TriggerType.DANMAKU,
            roomId.value,
            runtimeState,
            { sendLiveDanmaku: sendDanmaku },
            {
              customContextBuilder: () => successContext
            }
          );
        }
        window.$notification.success({
          title: '签到成功',
          description: `${username} 完成签到, 获得 ${pointsEarned} 积分, 累计签到 ${checkInStorage.value.users[userId].totalCheckins} 次`,
          duration: 5000
        });
      }
    } catch (error) {
      console.error('[CheckIn] 处理签到失败:', error);
    }
  }

  // 监听直播开始事件
  function onLiveStart() {
    // 直播开始时记录开始时间，用于早鸟奖励计算
    if (isLive.value && !liveStartTime.value) {
      liveStartTime.value = Date.now();
    }
  }

  // 监听直播结束事件
  function onLiveEnd() {
    // 直播结束时清空早鸟奖励的时间记录
    liveStartTime.value = null;
  }

  return {
    checkInConfig,
    checkInStorage,
    processCheckIn,
    onLiveStart,
    onLiveEnd
  };
}

/**
 * 创建默认的签到相关 AutoActionItem 配置
 * 这些配置可以在管理界面中显示和编辑
 */
export function createCheckInAutoActions(): AutoActionItem[] {
  return [
    // 普通签到成功响应
    {
      id: uuidv4(),
      name: '签到成功响应',
      enabled: true,
      triggerType: TriggerType.DANMAKU,
      actionType: ActionType.SEND_DANMAKU,
      template: '@{{user.name}} 签到成功，获得 {{points}} 积分',
      priority: Priority.NORMAL,
      logicalExpression: '',
      ignoreCooldown: false,
      executeCommand: '',
      triggerConfig: {
        keywords: ['签到'],
        keywordMatchType: KeywordMatchType.Full
      },
      actionConfig: {
        cooldownSeconds: 86400 // 24小时，确保每天只能签到一次
      }
    },
    // 早鸟签到成功响应
    {
      id: uuidv4(),
      name: '早鸟签到成功响应',
      enabled: true,
      triggerType: TriggerType.DANMAKU,
      actionType: ActionType.SEND_DANMAKU,
      template: '@{{user.name}} 早鸟签到成功，获得 {{totalPoints}} 积分',
      priority: Priority.HIGH,
      logicalExpression: '',
      ignoreCooldown: false,
      executeCommand: '',
      triggerConfig: {
        keywords: ['签到'],
        keywordMatchType: KeywordMatchType.Full
      },
      actionConfig: {
        cooldownSeconds: 86400 // 24小时
      }
    },
    // 签到冷却期提示
    {
      id: uuidv4(),
      name: '签到冷却提示',
      enabled: true,
      triggerType: TriggerType.DANMAKU,
      actionType: ActionType.SEND_DANMAKU,
      template: '@{{user.name}} 你今天已经签到过了，明天再来吧~',
      priority: Priority.LOW,
      logicalExpression: '',
      ignoreCooldown: true,
      executeCommand: '',
      triggerConfig: {
        keywords: ['签到'],
        keywordMatchType: KeywordMatchType.Full
      },
      actionConfig: {}
    }
  ];
}