import { ref, reactive, watch, computed, onUnmounted } from 'vue';
import { defineStore, acceptHMRUpdate } from 'pinia';
import { EventModel, EventDataTypes, GuardLevel } from '@/api/api-models';
import { useDanmakuClient } from '@/store/useDanmakuClient';
import { useBiliFunction } from './useBiliFunction';
import { useAccount } from '@/api/account';
import { useStorage } from '@vueuse/core'

// --- 配置类型定义 ---
export interface GiftThankConfig {
  enabled: boolean;
  delaySeconds: number; // 延迟感谢秒数 (0表示立即)
  templates: string[]; // 感谢弹幕模板
  filterMode: 'none' | 'blacklist' | 'whitelist' | 'value' | 'free'; // 过滤模式
  filterGiftNames: string[]; // 黑/白名单礼物名称
  minValue: number; // 最低价值 (用于 value 模式)
  ignoreTianXuan: boolean; // 屏蔽天选时刻礼物
  thankMode: 'singleGift' | 'singleUserMultiGift' | 'multiUserMultiGift'; // 感谢模式
  maxUsersPerMsg: number; // 每次感谢最大用户数
  maxGiftsPerUser: number; // 每用户最大礼物数 (用于 singleUserMultiGift)
  includeQuantity: boolean; // 是否包含礼物数量
  userFilterEnabled: boolean; // 是否启用用户过滤
  requireMedal: boolean; // 要求本房间勋章
  requireCaptain: boolean; // 要求任意舰长
  onlyDuringLive: boolean; // 仅直播中开启
}

export interface GuardPmConfig {
  enabled: boolean;
  template: string; // 私信模板
  sendDanmakuConfirm: boolean; // 是否发送弹幕确认
  danmakuTemplate: string; // 弹幕确认模板
  preventRepeat: boolean; // 防止重复发送 (需要本地存储)
  giftCodeMode: boolean; // 礼品码模式
  giftCodes: { level: GuardLevel; codes: string[]; }[]; // 分等级礼品码
  onlyDuringLive: boolean; // 仅直播中开启
}

export interface FollowThankConfig {
  enabled: boolean;
  delaySeconds: number;
  templates: string[];
  maxUsersPerMsg: number;
  ignoreTianXuan: boolean;
  onlyDuringLive: boolean;
}

export interface EntryWelcomeConfig {
  enabled: boolean;
  delaySeconds: number;
  templates: string[];
  maxUsersPerMsg: number;
  ignoreTianXuan: boolean;
  userFilterEnabled: boolean;
  requireMedal: boolean;
  requireCaptain: boolean;
  onlyDuringLive: boolean;
}

export interface ScheduledDanmakuConfig {
  enabled: boolean;
  intervalSeconds: number;
  messages: string[];
  mode: 'random' | 'sequential';
  onlyDuringLive: boolean;
}

export interface AutoReplyConfig {
  enabled: boolean;
  cooldownSeconds: number;
  rules: { keywords: string[]; replies: string[]; blockwords: string[]; }[];
  userFilterEnabled: boolean;
  requireMedal: boolean;
  requireCaptain: boolean;
  onlyDuringLive: boolean;
}

// --- 聚合数据结构 ---
interface AggregatedGift {
  uid: number;
  name: string; // 用户名
  gifts: { [giftName: string]: { count: number; price: number; }; }; // 礼物名 -> {数量, 单价}
  totalPrice: number;
  timestamp: number;
}

interface AggregatedUser {
  uid: number;
  name: string;
  timestamp: number;
}


export const useAutoAction = defineStore('autoAction', () => {
  const danmakuClient = useDanmakuClient();
  const biliFunc = useBiliFunction();
  const account = useAccount(); // 用于获取房间ID和直播状态

  // --- 状态定义 ---
  const giftThankConfig = useStorage<GiftThankConfig>(
    'autoAction.giftThankConfig',
    {
      enabled: false,
      delaySeconds: 5,
      templates: ['感谢 {{user.name}} 赠送的 {{gift.summary}}！'],
      filterMode: 'none',
      filterGiftNames: [],
      minValue: 0,
      ignoreTianXuan: true,
      thankMode: 'singleUserMultiGift',
      maxUsersPerMsg: 3,
      maxGiftsPerUser: 3,
      includeQuantity: true,
      userFilterEnabled: false,
      requireMedal: false,
      requireCaptain: false,
      onlyDuringLive: true
    }
  )

  const guardPmConfig = useStorage<GuardPmConfig>(
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
  )

  const followThankConfig = useStorage<FollowThankConfig>(
    'autoAction.followThankConfig',
    {
      enabled: false,
      delaySeconds: 10,
      templates: ['感谢 {{user.name}} 的关注！'],
      maxUsersPerMsg: 5,
      ignoreTianXuan: true,
      onlyDuringLive: true
    }
  )

  const entryWelcomeConfig = useStorage<EntryWelcomeConfig>(
    'autoAction.entryWelcomeConfig',
    {
      enabled: false,
      delaySeconds: 15,
      templates: ['欢迎 {{user.name}} 进入直播间！'],
      maxUsersPerMsg: 5,
      ignoreTianXuan: true,
      userFilterEnabled: false,
      requireMedal: false,
      requireCaptain: false,
      onlyDuringLive: true
    }
  )

  const scheduledDanmakuConfig = useStorage<ScheduledDanmakuConfig>(
    'autoAction.scheduledDanmakuConfig',
    {
      enabled: false,
      intervalSeconds: 300,
      messages: ['点点关注不迷路~'],
      mode: 'random',
      onlyDuringLive: true
    }
  )

  const autoReplyConfig = useStorage<AutoReplyConfig>(
    'autoAction.autoReplyConfig',
    {
      enabled: false,
      cooldownSeconds: 5,
      rules: [],
      userFilterEnabled: false,
      requireMedal: false,
      requireCaptain: false,
      onlyDuringLive: true
    }
  )

  // --- 运行时数据 ---
  const aggregatedGifts = ref<AggregatedGift[]>([]); // 聚合的礼物信息
  const aggregatedFollows = ref<AggregatedUser[]>([]); // 聚合的关注用户
  const aggregatedEntries = ref<AggregatedUser[]>([]); // 聚合的入场用户
  const sentGuardPms = useStorage<Set<number>>('autoAction.sentGuardPms', new Set()); // 已发送私信的舰长UID
  const giftThankTimer = ref<NodeJS.Timeout | null>(null);
  const followThankTimer = ref<NodeJS.Timeout | null>(null);
  const entryWelcomeTimer = ref<NodeJS.Timeout | null>(null);
  const scheduledDanmakuTimer = ref<NodeJS.Timeout | null>(null);
  const lastReplyTimestamps = ref<{ [keyword: string]: number; }>({}); // 自动回复冷却计时
  const currentScheduledIndex = ref(0); // 定时弹幕顺序模式索引
  const isTianXuanActive = ref(false); // 天选时刻状态

  // --- Helper Functions ---
  const isLive = computed(() => account.value.streamerInfo?.isStreaming ?? false); // 获取直播状态
  const roomId = computed(() => account.value.streamerInfo?.roomId); // 获取房间ID

  // 检查是否应处理事件 (直播状态过滤)
  function shouldProcess(config: { enabled: boolean; onlyDuringLive: boolean; }): boolean {
    if (!config.enabled) return false;
    return !config.onlyDuringLive || isLive.value;
  }

  // 检查用户过滤
  function checkUserFilter(config: { userFilterEnabled: boolean; requireMedal: boolean; requireCaptain: boolean; }, event: EventModel): boolean {
    if (!config.userFilterEnabled) return true;
    if (config.requireMedal && !event.fans_medal_wearing_status) return false;
    if (config.requireCaptain && event.guard_level === GuardLevel.None) return false;
    return true;
  }

  // 获取随机模板
  function getRandomTemplate(templates: string[]): string {
    if (!templates || templates.length === 0) return '';
    return templates[Math.floor(Math.random() * templates.length)];
  }

  // Helper to get nested property value
  function getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((o, k) => (o && typeof o === 'object' && k in o) ? o[k] : undefined, obj);
  }

  // 格式化消息 (支持 {{object.property}} )
  function formatMessage(template: string, params: Record<string, any>): string {
    return template.replace(/\{\{\s*([^}\s]+)\s*\}\}/g, (match, path) => {
      const value = getNestedValue(params, path);
      return value !== undefined ? String(value) : match;
    });
  }

  // 检查是否处于天选时刻
  function checkTianXuanStatus() {
    if (!roomId.value) return;
    // 这里可以调用API检查天选时刻状态
    // 示例实现，实际应该调用B站API
    biliFunc.checkRoomTianXuanStatus(roomId.value).then(active => {
      isTianXuanActive.value = active;
    });
  }

  // 每5分钟更新一次天选状态
  const tianXuanTimer = setInterval(checkTianXuanStatus, 5 * 60 * 1000);

  // 清理所有计时器
  function clearAllTimers() {
    [giftThankTimer, followThankTimer, entryWelcomeTimer, scheduledDanmakuTimer].forEach(timer => {
      if (timer.value) clearTimeout(timer.value);
    });
    clearInterval(tianXuanTimer);
  }

  // --- 事件处理 ---

  // 处理礼物事件
  function onGift(event: EventModel) {
    if (!shouldProcess(giftThankConfig.value) || !roomId.value) return;
    if (giftThankConfig.value.ignoreTianXuan && isTianXuanActive.value) return;
    if (!checkUserFilter(giftThankConfig.value, event)) return;

    // 礼物过滤逻辑
    const giftName = event.uname;
    const giftPrice = event.price / 1000; // B站价格单位通常是 1/1000 元
    const giftCount = event.num;

    switch (giftThankConfig.value.filterMode) {
      case 'blacklist':
        if (giftThankConfig.value.filterGiftNames.includes(giftName)) return;
        break;
      case 'whitelist':
        if (!giftThankConfig.value.filterGiftNames.includes(giftName)) return;
        break;
      case 'value':
        if (giftPrice < giftThankConfig.value.minValue) return;
        break;
      case 'free':
        if (giftPrice === 0) return; // 免费礼物价格为0
        break;
    }

    // 添加到聚合列表
    let userGift = aggregatedGifts.value.find(g => g.uid === event.uid);
    if (!userGift) {
      userGift = { uid: event.uid, name: event.uname, gifts: {}, totalPrice: 0, timestamp: Date.now() };
      aggregatedGifts.value.push(userGift);
    }
    if (!userGift.gifts[giftName]) {
      userGift.gifts[giftName] = { count: 0, price: giftPrice };
    }
    userGift.gifts[giftName].count += giftCount;
    userGift.totalPrice += giftPrice * giftCount;
    userGift.timestamp = Date.now(); // 更新时间戳

    // 重置或启动延迟计时器
    if (giftThankTimer.value) clearTimeout(giftThankTimer.value);
    if (giftThankConfig.value.delaySeconds > 0) {
      giftThankTimer.value = setTimeout(sendGiftThankYou, giftThankConfig.value.delaySeconds * 1000);
    } else {
      sendGiftThankYou(); // 立即发送
    }
  }

  // 发送礼物感谢
  function sendGiftThankYou() {
    if (!roomId.value || aggregatedGifts.value.length === 0) return;

    const usersToThank = aggregatedGifts.value.slice(0, giftThankConfig.value.maxUsersPerMsg);
    aggregatedGifts.value = aggregatedGifts.value.slice(giftThankConfig.value.maxUsersPerMsg); // 移除已处理的用户

    // 根据感谢模式构建弹幕内容
    let messages: string[] = [];
    const template = getRandomTemplate(giftThankConfig.value.templates);
    if (!template) return;

    usersToThank.forEach(user => {
      const topGifts = Object.entries(user.gifts)
        .sort(([, a], [, b]) => b.price * b.count - a.price * a.count) // 按总价值排序
        .slice(0, giftThankConfig.value.maxGiftsPerUser);

      const giftStrings = topGifts.map(([name, data]) =>
        giftThankConfig.value.includeQuantity ? `${name}x${data.count}` : name
      );

      if (giftStrings.length > 0) {
        // 准备模板参数
        const params = {
          user: { name: user.name },
          gift: {
            summary: giftStrings.join(', '),
            totalPrice: user.totalPrice.toFixed(2)
          }
        };
        messages.push(formatMessage(template, params));
      }
    });

    // 发送弹幕
    messages.forEach(msg => {
      if (msg) biliFunc.sendLiveDanmaku(roomId.value!, msg);
    });

    // 如果还有未感谢的礼物，继续设置计时器
    if (aggregatedGifts.value.length > 0) {
      if (giftThankTimer.value) clearTimeout(giftThankTimer.value);
      giftThankTimer.value = setTimeout(sendGiftThankYou, giftThankConfig.value.delaySeconds * 1000);
    } else {
      giftThankTimer.value = null;
    }
  }

  // 处理上舰事件 (Guard)
  function onGuard(event: EventModel) {
    if (!shouldProcess(guardPmConfig.value) || !roomId.value) return;

    const userId = event.uid;
    const userName = event.uname;
    const guardLevel = event.guard_level;

    if (guardLevel === GuardLevel.None) return; // 不是上舰事件

    // 防止重复发送
    if (guardPmConfig.value.preventRepeat) {
      if (sentGuardPms.value.has(userId)) {
        console.log(`用户 ${userName} (${userId}) 已发送过上舰私信，跳过。`);
        return;
      }
    }

    // 查找礼品码
    let giftCode = '';
    if (guardPmConfig.value.giftCodeMode) {
      const levelCodes = guardPmConfig.value.giftCodes.find(gc => gc.level === guardLevel)?.codes;
      if (levelCodes && levelCodes.length > 0) {
        giftCode = levelCodes.shift() || '';
        // 更新储存的礼品码
        saveGuardConfig();
      } else {
        // 尝试查找通用码 (level 0)
        const commonCodes = guardPmConfig.value.giftCodes.find(gc => gc.level === GuardLevel.None)?.codes;
        if (commonCodes && commonCodes.length > 0) {
          giftCode = commonCodes.shift() || '';
          saveGuardConfig();
        } else {
          console.warn(`等级 ${guardLevel} 或通用礼品码已用完，无法发送给 ${userName}`);
        }
      }
    }

    // 格式化私信内容
    const guardLevelName = { [GuardLevel.Zongdu]: '总督', [GuardLevel.Tidu]: '提督', [GuardLevel.Jianzhang]: '舰长' }[guardLevel] || '舰长';
    const pmParams = {
      user: { name: userName },
      guard: {
        levelName: guardLevelName,
        giftCode: giftCode
      }
    };
    const pmContent = formatMessage(guardPmConfig.value.template, pmParams);

    // 发送私信
    biliFunc.sendPrivateMessage(userId, pmContent).then(success => {
      if (success) {
        console.log(`成功发送上舰私信给 ${userName} (${userId})`);
        if (guardPmConfig.value.preventRepeat) {
          sentGuardPms.value.add(userId);
        }
        // 发送弹幕确认
        if (guardPmConfig.value.sendDanmakuConfirm && guardPmConfig.value.danmakuTemplate) {
          const confirmParams = { user: { name: userName } };
          const confirmMsg = formatMessage(guardPmConfig.value.danmakuTemplate, confirmParams);
          biliFunc.sendLiveDanmaku(roomId.value!, confirmMsg);
        }
      } else {
        console.error(`发送上舰私信给 ${userName} (${userId}) 失败`);
        // 失败时归还礼品码
        if (giftCode && guardPmConfig.value.giftCodeMode) {
          returnGiftCode(guardLevel, giftCode);
        }
      }
    });
  }

  // 归还礼品码到列表
  function returnGiftCode(level: GuardLevel, code: string) {
    const levelCodes = guardPmConfig.value.giftCodes.find(gc => gc.level === level);
    if (levelCodes) {
      levelCodes.codes.push(code);
    } else {
      guardPmConfig.value.giftCodes.push({ level, codes: [code] });
    }
    saveGuardConfig();
  }

  // 保存舰长配置到本地
  function saveGuardConfig() {
    // useStorage会自动保存，无需额外操作
  }

  // 处理关注事件
  function onFollow(event: EventModel) {
    if (!shouldProcess(followThankConfig.value) || !roomId.value) return;
    if (followThankConfig.value.ignoreTianXuan && isTianXuanActive.value) return;

    aggregatedFollows.value.push({ uid: event.uid, name: event.uname, timestamp: Date.now() });

    if (followThankTimer.value) clearTimeout(followThankTimer.value);
    if (followThankConfig.value.delaySeconds > 0) {
      followThankTimer.value = setTimeout(sendFollowThankYou, followThankConfig.value.delaySeconds * 1000);
    } else {
      sendFollowThankYou();
    }
  }

  // 发送关注感谢
  function sendFollowThankYou() {
    if (!roomId.value || aggregatedFollows.value.length === 0) return;
    const usersToThank = aggregatedFollows.value.slice(0, followThankConfig.value.maxUsersPerMsg);
    aggregatedFollows.value = aggregatedFollows.value.slice(followThankConfig.value.maxUsersPerMsg);

    const template = getRandomTemplate(followThankConfig.value.templates);
    if (!template) return;

    const names = usersToThank.map(u => u.name).join('、');
    const params = { user: { name: names } };
    const message = formatMessage(template, params);

    if (message) biliFunc.sendLiveDanmaku(roomId.value!, message);

    if (aggregatedFollows.value.length > 0) {
      if (followThankTimer.value) clearTimeout(followThankTimer.value);
      followThankTimer.value = setTimeout(sendFollowThankYou, followThankConfig.value.delaySeconds * 1000);
    } else {
      followThankTimer.value = null;
    }
  }

  // 处理入场事件 (Enter)
  function onEnter(event: EventModel) {
    if (!shouldProcess(entryWelcomeConfig.value) || !roomId.value) return;
    if (entryWelcomeConfig.value.ignoreTianXuan && isTianXuanActive.value) return;
    if (!checkUserFilter(entryWelcomeConfig.value, event)) return;

    aggregatedEntries.value.push({ uid: event.uid, name: event.uname, timestamp: Date.now() });

    if (entryWelcomeTimer.value) clearTimeout(entryWelcomeTimer.value);
    if (entryWelcomeConfig.value.delaySeconds > 0) {
      entryWelcomeTimer.value = setTimeout(sendEntryWelcome, entryWelcomeConfig.value.delaySeconds * 1000);
    } else {
      sendEntryWelcome();
    }
  }

  // 发送入场欢迎
  function sendEntryWelcome() {
    if (!roomId.value || aggregatedEntries.value.length === 0) return;
    const usersToWelcome = aggregatedEntries.value.slice(0, entryWelcomeConfig.value.maxUsersPerMsg);
    aggregatedEntries.value = aggregatedEntries.value.slice(entryWelcomeConfig.value.maxUsersPerMsg);

    const template = getRandomTemplate(entryWelcomeConfig.value.templates);
    if (!template) return;

    const names = usersToWelcome.map(u => u.name).join('、');
    const params = { user: { name: names } };
    const message = formatMessage(template, params);

    if (message) biliFunc.sendLiveDanmaku(roomId.value!, message);

    if (aggregatedEntries.value.length > 0) {
      if (entryWelcomeTimer.value) clearTimeout(entryWelcomeTimer.value);
      entryWelcomeTimer.value = setTimeout(sendEntryWelcome, entryWelcomeConfig.value.delaySeconds * 1000);
    } else {
      entryWelcomeTimer.value = null;
    }
  }

  // 处理弹幕事件 (用于自动回复)
  function onDanmaku(event: EventModel) {
    if (!shouldProcess(autoReplyConfig.value) || !roomId.value) return;
    if (!checkUserFilter(autoReplyConfig.value, event)) return;

    const message = event.msg;
    const userId = event.uid;
    const now = Date.now();

    for (const rule of autoReplyConfig.value.rules) {
      const keywordMatch = rule.keywords.some(kw => message.includes(kw));
      if (!keywordMatch) continue;

      const blockwordMatch = rule.blockwords.some(bw => message.includes(bw));
      if (blockwordMatch) continue; // 包含屏蔽词，不回复

      // 检查冷却
      const ruleKey = rule.keywords.join('|');
      const lastReplyTime = lastReplyTimestamps.value[ruleKey] || 0;
      if (now - lastReplyTime < autoReplyConfig.value.cooldownSeconds * 1000) {
        continue; // 仍在冷却中
      }

      // 选择回复并发送
      const reply = getRandomTemplate(rule.replies);
      if (reply) {
        const params = { user: { name: event.uname } };
        const formattedReply = formatMessage(reply, params);
        biliFunc.sendLiveDanmaku(roomId.value!, formattedReply);
        lastReplyTimestamps.value[ruleKey] = now; // 更新冷却时间
        break; // 匹配到一个规则就停止
      }
    }
  }

  // 发送定时弹幕
  function sendScheduledDanmaku() {
    if (!shouldProcess(scheduledDanmakuConfig.value) || !roomId.value || scheduledDanmakuConfig.value.messages.length === 0) {
      stopScheduledDanmaku(); // 停止计时器如果条件不满足
      return;
    }

    let message = '';
    if (scheduledDanmakuConfig.value.mode === 'random') {
      message = getRandomTemplate(scheduledDanmakuConfig.value.messages);
    } else {
      message = scheduledDanmakuConfig.value.messages[currentScheduledIndex.value];
      currentScheduledIndex.value = (currentScheduledIndex.value + 1) % scheduledDanmakuConfig.value.messages.length;
    }

    if (message) {
      biliFunc.sendLiveDanmaku(roomId.value!, message);
    }

    // 设置下一次定时
    if (scheduledDanmakuTimer.value) clearTimeout(scheduledDanmakuTimer.value);
    scheduledDanmakuTimer.value = setTimeout(sendScheduledDanmaku, scheduledDanmakuConfig.value.intervalSeconds * 1000);
  }

  // 启动定时弹幕
  function startScheduledDanmaku() {
    if (scheduledDanmakuTimer.value) clearTimeout(scheduledDanmakuTimer.value); // 清除旧的
    if (shouldProcess(scheduledDanmakuConfig.value) && scheduledDanmakuConfig.value.intervalSeconds > 0) {
      scheduledDanmakuTimer.value = setTimeout(sendScheduledDanmaku, scheduledDanmakuConfig.value.intervalSeconds * 1000);
    }
  }

  // 停止定时弹幕
  function stopScheduledDanmaku() {
    if (scheduledDanmakuTimer.value) {
      clearTimeout(scheduledDanmakuTimer.value);
      scheduledDanmakuTimer.value = null;
    }
  }

  // 监听配置变化以启动/停止定时弹幕
  watch(() => [scheduledDanmakuConfig.value.enabled, scheduledDanmakuConfig.value.onlyDuringLive, isLive.value, scheduledDanmakuConfig.value.intervalSeconds], () => {
    if (scheduledDanmakuConfig.value.enabled && (!scheduledDanmakuConfig.value.onlyDuringLive || isLive.value)) {
      startScheduledDanmaku();
    } else {
      stopScheduledDanmaku();
    }
  }, { immediate: true }); // 立即执行一次检查

  // 当组件卸载时清理所有计时器
  onUnmounted(() => {
    clearAllTimers();
  });

  // 初始化，订阅事件
  function init() {
    danmakuClient.onEvent('danmaku', (data) => onDanmaku(data as EventModel));
    danmakuClient.onEvent('gift', (data) => onGift(data as EventModel));
    danmakuClient.onEvent('guard', (data) => onGuard(data as EventModel));
    danmakuClient.onEvent('follow', (data) => onFollow(data as EventModel));
    danmakuClient.onEvent('enter', (data) => onEnter(data as EventModel));

    // 初始检查天选状态
    checkTianXuanStatus();

    // 启动定时弹幕（如果初始状态满足条件）
    startScheduledDanmaku();

    console.log('自动操作模块已初始化');
  }

  return {
    init,
    // --- 配置 ---
    giftThankConfig,
    guardPmConfig,
    followThankConfig,
    entryWelcomeConfig,
    scheduledDanmakuConfig,
    autoReplyConfig,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAutoAction, import.meta.hot));
}

export { GuardLevel };
