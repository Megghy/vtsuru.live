import { ref, Ref, computed } from 'vue';
import { EventModel, EventDataTypes } from '@/api/api-models';
import { ActionType, AutoActionItem, RuntimeState, TriggerType, Priority, KeywordMatchType } from '../types';
import { usePointStore } from '@/store/usePointStore';
import { processTemplate } from '../actionUtils';
import { buildExecutionContext } from '../utils';
import { v4 as uuidv4 } from 'uuid';
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval';
import { GuidUtils } from '@/Utils';

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
function createDefaultCheckInConfig(): CheckInConfig {  return {
    enabled: false,
    command: '签到',
    points: 10,
    cooldownSeconds: 3600, // 1小时
    onlyDuringLive: true, // 默认仅在直播时可签到
    sendReply: true, // 默认发送回复消息
    successAction: {
      id: uuidv4(),
      name: '签到成功回复',
      enabled: true,
      triggerType: TriggerType.DANMAKU,
      actionType: ActionType.SEND_DANMAKU,
      template: '@{{user.name}} 签到成功，获得 {{checkin.totalPoints}} 积分。',
      priority: Priority.NORMAL,
      logicalExpression: '',
      ignoreCooldown: false,
      executeCommand: '',
      triggerConfig: {},
      actionConfig: {}
    },
    cooldownAction: {
      id: uuidv4(),
      name: '签到冷却回复',
      enabled: true,
      triggerType: TriggerType.DANMAKU,
      actionType: ActionType.SEND_DANMAKU,
      template: '{{user.name}} 你今天已经签到过了，明天再来吧~',
      priority: Priority.NORMAL,
      logicalExpression: '',
      ignoreCooldown: false,
      executeCommand: '',
      triggerConfig: {},
      actionConfig: {}
    },
    earlyBird: {
      enabled: false,
      windowMinutes: 30,
      bonusPoints: 5,
      successAction: {
        id: uuidv4(),
        name: '早鸟签到回复',
        enabled: true,
        triggerType: TriggerType.DANMAKU,
        actionType: ActionType.SEND_DANMAKU,
        template: '恭喜 {{user.name}} 完成早鸟签到！额外获得 {{bonusPoints}} 积分，共获得 {{totalPoints}} 积分！',
        priority: Priority.NORMAL,
        logicalExpression: '',
        ignoreCooldown: false,
        executeCommand: '',
        triggerConfig: {},
        actionConfig: {}
      }
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
        // 使用buildExecutionContext构建上下文
        const cooldownContext = buildExecutionContext(event, roomId.value, TriggerType.DANMAKU, {
          user: { name: username, uid: userId }
        });

        const message = processTemplate(checkInConfig.value.cooldownAction, cooldownContext);

        if (roomId.value && message) {
          sendDanmaku(roomId.value, message).catch(err =>
            console.error('[CheckIn] 发送已签到提示失败:', err)
          );
        }
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
      const point = await pointStore.addPoints(userId, pointsEarned, `签到奖励 (${format(new Date(), 'yyyy-MM-dd')})`, `${username} 完成签到`);      // 更新签到记录
      if (checkInStorage.value) {
        // 确保 lastCheckIn 对象存在
        if (!checkInStorage.value.lastCheckIn) {
          checkInStorage.value.lastCheckIn = {};
        }
        // 确保 users 对象存在
        if (!checkInStorage.value.users) {
          checkInStorage.value.users = {};
        }

        // 获取用户当前的签到数据
        let userData = checkInStorage.value.users[userId];

        // 如果是新用户，创建用户数据
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

        // 计算连续签到天数
        const lastCheckInDate = new Date(userData.lastCheckInTime);
        const currentDate = new Date(currentTime);

        // 如果上次签到不是昨天（隔了一天以上），则重置连续签到天数
        const isYesterday =
          lastCheckInDate.getFullYear() === currentDate.getFullYear() &&
          lastCheckInDate.getMonth() === currentDate.getMonth() &&
          lastCheckInDate.getDate() === currentDate.getDate() - 1;

        // 如果上次签到不是今天（防止重复计算）
        if (!isSameDay) {
          // 更新连续签到天数
          if (isYesterday) {
            // 昨天签到过，增加连续签到天数
            userData.streakDays += 1;
          } else if (userData.lastCheckInTime > 0) {
            // 不是昨天签到且不是首次签到，重置连续签到天数为1
            userData.streakDays = 1;
          } else {
            // 首次签到
            userData.streakDays = 1;
          }

          // 更新累计签到次数
          userData.totalCheckins += 1;

          // 更新早鸟签到次数
          if (isEarlyBird) {
            userData.earlyBirdCount += 1;
          }
        }

        // 更新最后签到时间
        userData.lastCheckInTime = currentTime;
        // 更新用户名（以防用户改名）
        userData.username = username;

        // 保存用户数据
        checkInStorage.value.users[userId] = userData;
        // 更新lastCheckIn记录
        checkInStorage.value.lastCheckIn[userId] = currentTime;
      }

      // 发送成功消息
      if (roomId.value) {
        // 构建签到上下文数据
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

        // 根据配置决定是否发送回复消息
        if (checkInConfig.value.sendReply) {
          // 使用buildExecutionContext构建完整上下文
          const successContext = buildExecutionContext(event, roomId.value, TriggerType.DANMAKU, checkInData);

          let message;
          if (isEarlyBird) {
            // 使用早鸟签到模板
            message = processTemplate(checkInConfig.value.earlyBird.successAction, successContext);
          } else {
            // 使用普通签到模板
            message = processTemplate(checkInConfig.value.successAction, successContext);
          }

          if (message) {
            sendDanmaku(roomId.value, message).catch(err =>
              console.error('[CheckIn] 发送签到成功消息失败:', err)
            );
          }
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