import { EventModel, OpenLiveInfo } from '@/api/api-models';
import BaseDanmakuClient from '@/data/DanmakuClients/BaseDanmakuClient';
import DirectClient, { DirectClientAuthInfo } from '@/data/DanmakuClients/DirectClient';
import OpenLiveClient, { AuthInfo } from '@/data/DanmakuClients/OpenLiveClient';
import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue'; // 引入 shallowRef

// 定义支持的事件名称类型
type EventName = 'danmaku' | 'gift' | 'sc' | 'guard' | 'enter' | 'scDel' | 'follow';
type EventNameWithAll = EventName | 'all';
// 定义监听器函数类型
type Listener = (arg1: any, arg2: any) => void;
type EventListener = (arg1: EventModel, arg2: any) => void;
// --- 修正点: 确保 AllEventListener 定义符合要求 ---
// AllEventListener 明确只接受一个参数
type AllEventListener = (arg1: any) => void;

// --- 修正点: 定义一个统一的监听器类型，用于内部实现签名 ---
type GenericListener = Listener | AllEventListener;

export const useDanmakuClient = defineStore('DanmakuClient', () => {
  // 使用 shallowRef 存储 danmakuClient 实例, 性能稍好
  const danmakuClient = shallowRef<BaseDanmakuClient | undefined>(new OpenLiveClient()); // 默认实例化一个 OpenLiveClient

  // 连接状态: 'waiting'-等待初始化, 'connecting'-连接中, 'connected'-已连接
  const state = ref<'waiting' | 'connecting' | 'connected'>('waiting');
  // 计算属性, 判断是否已连接
  const connected = computed(() => state.value === 'connected');
  // 存储开放平台认证信息 (如果使用 OpenLiveClient)
  const authInfo = ref<OpenLiveInfo>();

  // 初始化锁, 防止并发初始化
  let isInitializing = false;

  /**
   * @description 注册事件监听器 (特定于 OpenLiveClient 的原始事件 或 调用 onEvent)
   * @param eventName 事件名称 ('danmaku', 'gift', 'sc', 'guard', 'enter', 'scDel')
   * @param listener 回调函数
   * @remarks 对于 OpenLiveClient, 直接操作其内部 events; 对于其他客户端, 调用 onEvent.
   */
  // --- 修正点: 保持重载签名不变 ---
  function onEvent(eventName: 'all', listener: AllEventListener): void;
  function onEvent(eventName: EventName, listener: Listener): void;
  // --- 修正点: 实现签名使用联合类型，并在内部进行类型断言 ---
  function onEvent(eventName: keyof BaseDanmakuClient['eventsAsModel'], listener: GenericListener): void {
    if (!danmakuClient.value) {
      console.warn("[DanmakuClient] 尝试在客户端初始化之前调用 'onEvent'。");
      return;
    }
    try {
      if (eventName === 'all') {
        // 对于 'all' 事件, 直接使用 AllEventListener 类型
        danmakuClient.value.eventsAsModel[eventName].push(listener as AllEventListener);
      } else {
        danmakuClient.value.eventsAsModel[eventName].push(listener);
      }
    } catch (error) {
      console.error(`[DanmakuClient] 注册事件监听器: ${eventName} 失败: ${error}`);
    }
  }

  /*
   * @description 注册事件监听器 (模型化数据, 存储在 Store 中)
   * @param eventName 事件名称 ('danmaku', 'gift', 'sc', 'guard', 'all')
   * @param listener 回调函数
   * @remarks 监听器存储在 Store 中, 会在客户端重连后自动重新附加.
   */
  // --- 修正点: 保持重载签名不变 ---
  function on(eventName: 'all', listener: AllEventListener): void;
  function on(eventName: EventName, listener: Listener): void;
  // --- 修正点: 实现签名使用联合类型，并在内部进行类型断言 ---
  function on(eventName: EventNameWithAll, listener: GenericListener): void {
    if (!danmakuClient.value) {
      console.warn("[DanmakuClient] 尝试在客户端初始化之前调用 'on'。");
      return;
    }
    danmakuClient.value.eventsRaw[eventName].push(listener);
  }


  /**
   * @description 移除事件监听器 (模型化数据, 从 Store 中移除)
   * @param eventName 事件名称 ('danmaku', 'gift', 'sc', 'guard', 'all')
   * @param listener 要移除的回调函数
   */
  // --- 修正点: 保持重载签名不变 ---
  function offEvent(eventName: 'all', listener: AllEventListener): void;
  function offEvent(eventName: EventName, listener: Listener): void;
  // --- 修正点: 实现签名使用联合类型，并在内部进行类型断言 ---
  function offEvent(eventName: keyof BaseDanmakuClient['eventsRaw'], listener: GenericListener): void {
    if (!danmakuClient.value) {
      console.warn("[DanmakuClient] 尝试在客户端初始化之前调用 'offEvent'。");
      return;
    }
    if (eventName === 'all') {
      // 对于 'all' 事件, 直接使用 AllEventListener 类型
      const modelListeners = danmakuClient.value.eventsAsModel[eventName] as AllEventListener[];
      const index = modelListeners.indexOf(listener as AllEventListener);
      if (index > -1) {
        modelListeners.splice(index, 1);
      }
    } else {
      const index = danmakuClient.value.eventsAsModel[eventName].indexOf(listener);
      if (index > -1) {
        danmakuClient.value.eventsAsModel[eventName].splice(index, 1);
      } else {
        console.warn(`[DanmakuClient] 试图移除未注册的监听器: ${listener}`);
      }
    }
  }

  /*
   * @description 移除事件监听器 (特定于 OpenLiveClient 或调用 offEvent)
   * @param eventName 事件名称 ('danmaku', 'gift', 'sc', 'guard', 'all')
   * @param listener 要移除的回调函数
   */
  // --- 修正点: 保持重载签名不变 ---
  function off(eventName: 'all', listener: AllEventListener): void;
  function off(eventName: EventName, listener: Listener): void;
  // --- 修正点: 实现签名使用联合类型，并在内部进行类型断言 ---
  function off(eventName: EventNameWithAll, listener: GenericListener): void {
    if (!danmakuClient.value) {
      console.warn("[DanmakuClient] 尝试在客户端初始化之前调用 'off'。");
      return;
    }
    const index = danmakuClient.value.eventsRaw[eventName].indexOf(listener);
    if (index > -1) {
      danmakuClient.value.eventsRaw[eventName].splice(index, 1);
    }
    // 直接从 eventsRaw 中移除监听器
  }

  /**
   * @description 初始化 OpenLive 客户端
   * @param auth 认证信息
   * @returns
   */
  async function initOpenlive(auth?: AuthInfo) {
    return initClient(new OpenLiveClient(auth));
  }

  /**
   * @description 初始化 Direct 客户端
   * @param auth 认证信息
   * @returns
   */
  async function initDirect(auth: DirectClientAuthInfo) {
    return initClient(new DirectClient(auth));
  }


  // 辅助函数: 从客户端的 eventsAsModel 移除单个监听器
  // --- 修正点: 修正 detachListenerFromClient 的签名和实现以处理联合类型 ---
  function detachListenerFromClient(client: BaseDanmakuClient, eventName: EventNameWithAll, listener: GenericListener): void {
    if (client.eventsAsModel[eventName]) {
      if (eventName === 'all') {
        const modelListeners = client.eventsAsModel[eventName] as AllEventListener[];
        const index = modelListeners.indexOf(listener as AllEventListener);
        if (index > -1) {
          modelListeners.splice(index, 1);
        }
      } else {
        const modelListeners = client.eventsAsModel[eventName] as Listener[];
        const index = modelListeners.indexOf(listener as Listener);
        if (index > -1) {
          modelListeners.splice(index, 1);
        }
      }
    }
  }


  /**
   * @description 通用客户端初始化逻辑
   * @param client 要初始化的客户端实例
   * @returns Promise<boolean> 是否初始化成功 (包括重试后最终成功)
   */
  async function initClient(client: BaseDanmakuClient) { // 返回 Promise<boolean> 表示最终是否成功
    // 防止重复初始化或在非等待状态下初始化
    if (isInitializing) {
      while (isInitializing) {
        await new Promise((resolve) => setTimeout(resolve, 100)); // 等待初始化完成
      }
      return useDanmakuClient(); // 如果已连接，则视为“成功”
    }
    if (state.value === 'connected') {
      return useDanmakuClient(); // 如果已连接，则视为“成功”
    }

    isInitializing = true;
    state.value = 'connecting';
    console.log('[DanmakuClient] 开始初始化...');


    let oldEventsAsModel = danmakuClient.value?.eventsAsModel;
    let oldEventsRaw = danmakuClient.value?.eventsRaw;
    if (!oldEventsAsModel || Object.keys(oldEventsAsModel).length === 0) {
      oldEventsAsModel = client.createEmptyEventModelListeners();
    }
    if (!oldEventsRaw || Object.keys(oldEventsRaw).length === 0) {
      oldEventsRaw = client.createEmptyRawEventlisteners();
    }

    // 先停止并清理旧客户端 (如果存在)
    if (danmakuClient.value) {
      console.log('[DanmakuClient] 正在处理旧的客户端实例...');
      if (danmakuClient.value.state === 'connected') {
        await disposeClientInstance(danmakuClient.value);
      }
    }

    // 设置新的客户端实例
    danmakuClient.value = client;
    // 确保新客户端有空的监听器容器 (BaseDanmakuClient 应负责初始化)
    danmakuClient.value.eventsAsModel = oldEventsAsModel;
    danmakuClient.value.eventsRaw = oldEventsRaw;
    // 通常在 client 实例化或 Start 时处理，或者在 attachListenersToClient 中确保存在


    let connectSuccess = false;
    const maxRetries = 5; // Example: Limit retries
    let retryCount = 0;

    const attemptConnect = async () => {
      if (!danmakuClient.value) return false; // Guard against client being disposed during wait
      try {
        console.log(`[DanmakuClient] 尝试连接 (第 ${retryCount + 1} 次)...`);
        const result = await danmakuClient.value.Start(); // 启动连接
        if (result.success) {
          // 连接成功
          authInfo.value = danmakuClient.value instanceof OpenLiveClient ? danmakuClient.value.roomAuthInfo : undefined;
          state.value = 'connected';
          // 将 Store 中存储的监听器 (来自 onEvent) 附加到新连接的客户端的 eventsAsModel
          console.log('[DanmakuClient] 初始化成功');
          connectSuccess = true;
          return true; // 连接成功, 退出重试循环
        } else {
          // 连接失败
          console.error(`[DanmakuClient] 连接尝试失败: ${result.message}`);
          return false; // 继续重试
        }
      } catch (error) {
        // 捕获 Start() 可能抛出的异常
        console.error(`[DanmakuClient] 连接尝试期间发生异常:`, error);
        return false; // 继续重试
      }
    };

    // 循环尝试连接, 直到成功或达到重试次数
    while (!connectSuccess && retryCount < maxRetries) {
      if (state.value !== 'connecting') { // 检查状态是否在循环开始时改变
        console.log('[DanmakuClient] 初始化被外部中止。');
        isInitializing = false;
        //return false; // 初始化被中止
        break;
      }

      if (!(await attemptConnect())) {
        retryCount++;
        if (retryCount < maxRetries && state.value === 'connecting') {
          console.log(`[DanmakuClient] 5 秒后重试连接... (${retryCount}/${maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, 5000));
          // 再次检查在等待期间状态是否改变
          if (state.value !== 'connecting') {
            console.log('[DanmakuClient] 在重试等待期间初始化被中止。');
            isInitializing = false;
            //return false; // 初始化被中止
            break;
          }
        } else if (state.value === 'connecting') {
          console.error(`[DanmakuClient] 已达到最大连接重试次数 (${maxRetries})。初始化失败。`);
          // 连接失败，重置状态
          await dispose(); // 清理资源
          // state.value = 'waiting'; // dispose 会设置状态
          // isInitializing = false; // dispose 会设置
          // return false; // 返回失败状态
          break;
        }
      }
    }

    isInitializing = false; // 无论成功失败，初始化过程结束
    // 返回最终的连接状态
    return useDanmakuClient();
  }

  // 封装停止和清理客户端实例的逻辑
  async function disposeClientInstance(client: BaseDanmakuClient) {
    try {
      console.log('[DanmakuClient] 正在停止客户端实例...');
      client.Stop(); // 停止客户端连接和内部处理
      // 可能需要添加额外的清理逻辑，例如移除所有监听器
      // client.eventsAsModel = client.createEmptyEventModelListeners(); // 清空监听器
      // client.eventsRaw = client.createEmptyRawEventlisteners(); // 清空监听器
      console.log('[DanmakuClient] 客户端实例已停止。');
    } catch (error) {
      console.error('[DanmakuClient] 停止客户端时出错:', error);
    }
  }

  /**
   * @description 停止并清理当前客户端连接和资源
   */
  async function dispose() {
    console.log('[DanmakuClient] 正在停止并清理客户端...');
    isInitializing = false; // 允许在 dispose 后重新初始化

    if (danmakuClient.value) {
      await disposeClientInstance(danmakuClient.value);
      //danmakuClient.value = undefined; // 保留, 用户再次获取event
    }
    state.value = 'waiting'; // 重置状态为等待
    authInfo.value = undefined; // 清理认证信息
    // isInitializing = false; // 在函数开始处已设置
    console.log('[DanmakuClient] 已处理。');
    // 注意: Store 中 listeners.value (来自 onEvent) 默认不清空, 以便重连后恢复
  }

  return {
    danmakuClient, // 当前弹幕客户端实例 (shallowRef)
    state,         // 连接状态 ('waiting', 'connecting', 'connected')
    authInfo,      // OpenLive 认证信息 (ref)
    connected,     // 是否已连接 (computed)
    onEvent,       // 注册事件监听器 (模型化数据, 存储于 Store)
    offEvent,      // 移除事件监听器 (模型化数据, 从 Store 移除)
    on,            // 注册事件监听器 (直接操作 client.eventsRaw)
    off,           // 移除事件监听器 (直接操作 client.eventsRaw 或调用 offEvent)
    initOpenlive,  // 初始化 OpenLive 客户端
    initDirect,    // 初始化 Direct 客户端
    dispose,       // 停止并清理客户端
  };
});