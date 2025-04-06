import { defineStore } from 'pinia';
import { ref, computed, shallowRef } from 'vue'; // shallowRef 用于非深度响应对象
import { useLocalStorage } from '@vueuse/core';
import { useRoute } from 'vue-router';
import { compress } from 'brotli-compress';
import { format } from 'date-fns';
import * as signalR from '@microsoft/signalr';
import * as msgpack from '@microsoft/signalr-protocol-msgpack';
import { useAccount } from '@/api/account'; // 假设账户信息路径
import { BASE_HUB_URL, isDev } from '@/data/constants'; // 假设常量路径
import BaseDanmakuClient from '@/data/DanmakuClients/BaseDanmakuClient'; // 假设弹幕客户端基类路径
import DirectClient, { DirectClientAuthInfo } from '@/data/DanmakuClients/DirectClient'; // 假设直连客户端路径
import OpenLiveClient from '@/data/DanmakuClients/OpenLiveClient'; // 假设开放平台客户端路径
import { error as logError, info as logInfo } from '@tauri-apps/plugin-log'; // 使用日志插件
import { getEventType, recordEvent, streamingInfo } from '@/client/data/info';
import { useWebRTC } from './useRTC';

export const useWebFetcher = defineStore('WebFetcher', () => {
  const cookie = useLocalStorage('JWT_Token', '');
  const route = useRoute();
  const account = useAccount();
  const rtc = useWebRTC();
  const webfetcherType = ref<'openlive' | 'direct'>('openlive'); // 弹幕客户端类型
  // --- 连接与状态 ---
  const state = ref<'disconnected' | 'connecting' | 'connected'>('disconnected'); // SignalR 连接状态
  const startedAt = ref<Date>(); // 本次启动时间
  const signalRClient = shallowRef<signalR.HubConnection>(); // SignalR 客户端实例 (浅响应)
  const client = shallowRef<BaseDanmakuClient>(); // 弹幕客户端实例 (浅响应)
  let timer: any; // 事件发送定时器
  let disconnectedByServer = false;
  let isFromClient = false; // 是否由Tauri客户端启动

  // --- 新增: 详细状态与信息 ---
  /** 弹幕客户端内部状态 */
  const danmakuClientState = ref<'stopped' | 'connecting' | 'connected'>('stopped'); // 更详细的弹幕客户端状态
  /** 弹幕服务器连接地址 */
  const danmakuServerUrl = ref<string>();
  /** SignalR 连接 ID */
  const signalRConnectionId = ref<string>();
  // const heartbeatLatency = ref<number>(null); // 心跳延迟暂不实现，复杂度较高

  // --- 事件处理 ---
  const events: string[] = []; // 待发送事件队列

  // --- 新增: 会话统计 (在 Start 时重置) ---
  /** 本次会话处理的总事件数 */
  const sessionEventCount = ref(0);
  /** 本次会话各类型事件计数 */
  const sessionEventTypeCounts = ref<{ [key: string]: number; }>({});
  /** 本次会话成功上传次数 */
  const successfulUploads = ref(0);
  /** 本次会话失败上传次数 */
  const failedUploads = ref(0);
  /** 本次会话发送的总字节数 (压缩后) */
  const bytesSentSession = ref(0);

  const prefix = computed(() => isFromClient ? '[web-fetcher-iframe] ' : '[web-fetcher] ');

  /**
   * 启动 WebFetcher 服务
   */
  async function Start(
    type: 'openlive' | 'direct' = 'openlive',
    directAuthInfo?: DirectClientAuthInfo,
    _isFromClient: boolean = false
  ): Promise<{ success: boolean; message: string; }> {
    if (state.value === 'connected' || state.value === 'connecting') {
      logInfo(prefix.value + '已经启动，无需重复启动');
      return { success: true, message: '已启动' };
    }
    webfetcherType.value = type; // 设置弹幕客户端类型
    // 重置会话统计数据
    resetSessionStats();
    startedAt.value = new Date();
    isFromClient = _isFromClient;
    state.value = 'connecting'; // 设置为连接中状态

    // 使用 navigator.locks 确保同一时间只有一个 Start 操作执行
    const result = await navigator.locks.request('webFetcherStartLock', async () => {
      logInfo(prefix.value + '开始启动...');
      while (!(await connectSignalR())) {
        logInfo(prefix.value + '连接 SignalR 失败, 5秒后重试');
        await new Promise((resolve) => setTimeout(resolve, 5000));
        // 如果用户手动停止，则退出重试循环
        if (state.value === 'disconnected') return { success: false, message: '用户手动停止' };
      }

      let danmakuResult = await connectDanmakuClient(type, directAuthInfo);
      while (!danmakuResult?.success) {
        logInfo(prefix.value + '弹幕客户端启动失败, 5秒后重试');
        await new Promise((resolve) => setTimeout(resolve, 5000));
        // 如果用户手动停止，则退出重试循环
        if (state.value === 'disconnected') return { success: false, message: '用户手动停止' };
        danmakuResult = await connectDanmakuClient(type, directAuthInfo);
      }

      // 只有在两个连接都成功后才设置为 connected
      state.value = 'connected';
      disconnectedByServer = false;
      logInfo(prefix.value + '启动成功');
      return { success: true, message: '启动成功' };
    });

    // 如果启动过程中因为手动停止而失败，需要确保状态是 disconnected
    if (!result.success) {
      Stop(); // 确保清理资源
      return { success: false, message: result.message || '启动失败' };
    }

    return result;
  }

  /**
   * 停止 WebFetcher 服务
   */
  function Stop() {
    if (state.value === 'disconnected') return;

    logInfo(prefix.value + '正在停止...');
    state.value = 'disconnected'; // 立即设置状态，防止重连逻辑触发

    // 清理定时器
    if (timer) { clearInterval(timer); timer = undefined; }

    // 停止弹幕客户端
    client.value?.Stop();
    client.value = undefined;
    danmakuClientState.value = 'stopped';
    danmakuServerUrl.value = undefined;

    // 停止 SignalR 连接
    signalRClient.value?.stop();
    signalRClient.value = undefined;
    signalRConnectionId.value = undefined;

    // 清理状态
    startedAt.value = undefined;
    events.length = 0; // 清空事件队列
    // resetSessionStats(); // 会话统计在下次 Start 时重置

    logInfo(prefix.value + '已停止');
  }

  /** 重置会话统计数据 */
  function resetSessionStats() {
    sessionEventCount.value = 0;
    sessionEventTypeCounts.value = {};
    successfulUploads.value = 0;
    failedUploads.value = 0;
    bytesSentSession.value = 0;
  }

  /**
   * 连接弹幕客户端
   */
  async function connectDanmakuClient(
    type: 'openlive' | 'direct',
    directConnectInfo?: DirectClientAuthInfo
  ) {
    if (client.value?.state === 'connected' || client.value?.state === 'connecting') {
      logInfo(prefix.value + '弹幕客户端已连接或正在连接');
      return { success: true, message: '弹幕客户端已启动' };
    }

    logInfo(prefix.value + '正在连接弹幕客户端...');
    danmakuClientState.value = 'connecting';

    // 如果实例存在但已停止，先清理
    if (client.value?.state === 'disconnected') {
      client.value = undefined;
    }

    // 创建实例并添加事件监听 (仅在首次创建时)
    if (!client.value) {
      if (type === 'openlive') {
        client.value = new OpenLiveClient();
      } else {
        if (!directConnectInfo) {
          danmakuClientState.value = 'stopped';
          logError(prefix.value + '未提供直连弹幕客户端认证信息');
          return { success: false, message: '未提供弹幕客户端认证信息' };
        }
        client.value = new DirectClient(directConnectInfo);
        // 直连地址通常包含 host 和 port，可以从 directConnectInfo 获取
        //danmakuServerUrl.value = `${directConnectInfo.host}:${directConnectInfo.port}`;
      }

      // 监听所有事件，用于处理和转发
      client.value?.on('all', onGetDanmakus);
    }


    // 启动客户端连接
    const result = await client.value?.Start();

    if (result?.success) {
      logInfo(prefix.value + '弹幕客户端连接成功, 开始监听弹幕');
      danmakuClientState.value = 'connected'; // 明确设置状态
      danmakuServerUrl.value = client.value.serverUrl; // 获取服务器地址
      // 启动事件发送定时器 (如果之前没有启动)
      timer ??= setInterval(sendEvents, 1500); // 每 1.5 秒尝试发送一次事件
    } else {
      logError(prefix.value + '弹幕客户端启动失败: ' + result?.message);
      danmakuClientState.value = 'stopped';
      danmakuServerUrl.value = undefined;
      client.value = undefined; // 启动失败，清理实例，下次会重建
    }
    return result;
  }

  /**
   * 连接 SignalR 服务器
   */
  async function connectSignalR() {
    if (signalRClient.value && signalRClient.value.state !== signalR.HubConnectionState.Disconnected) {
      logInfo(prefix.value + "SignalR 已连接或正在连接");
      return true;
    }

    logInfo(prefix.value + '正在连接到 vtsuru 服务器...');
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(BASE_HUB_URL + 'web-fetcher?token=' + (route.query.token ?? account.value.token), { // 使用 account.token
        headers: { Authorization: `Bearer ${cookie.value}` },
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets
      })
      .withAutomaticReconnect([0, 2000, 10000, 30000]) // 自动重连策略
      .withHubProtocol(new msgpack.MessagePackHubProtocol()) // 使用 MessagePack 协议
      .build();

    // --- SignalR 事件监听 ---
    connection.onreconnecting(error => {
      logInfo(prefix.value + `与服务器断开，正在尝试重连... ${error?.message || ''}`);
      state.value = 'connecting'; // 更新状态为连接中
      signalRConnectionId.value = undefined; // 连接断开，ID失效
    });

    connection.onreconnected(connectionId => {
      logInfo(prefix.value + `与服务器重新连接成功! ConnectionId: ${connectionId}`);
      signalRConnectionId.value = connectionId ?? undefined;
      state.value = 'connected'; // 更新状态为已连接
      // 重连成功后可能需要重新发送标识
      if (isFromClient) {
        connection.send('SetAsVTsuruClient').catch(err => logError(prefix.value + "Send SetAsVTsuruClient failed: " + err));
      }
      connection.send('Reconnected').catch(err => logError(prefix.value + "Send Reconnected failed: " + err));
    });

    connection.onclose(async (error) => {
      // 只有在不是由 Stop() 或服务器明确要求断开时才记录错误并尝试独立重连（虽然 withAutomaticReconnect 应该处理）
      if (state.value !== 'disconnected' && !disconnectedByServer) {
        logError(prefix.value + `与服务器连接关闭: ${error?.message || '未知原因'}. 自动重连将处理.`);
        state.value = 'connecting'; // 标记为连接中，等待自动重连
        signalRConnectionId.value = undefined;
        // withAutomaticReconnect 会处理重连，这里不需要手动调用 reconnect
      } else if (disconnectedByServer) {
        logInfo(prefix.value + `连接已被服务器关闭.`);
        Stop(); // 服务器要求断开，则彻底停止
      } else {
        logInfo(prefix.value + `连接已手动关闭.`);
      }
    });

    connection.on('Disconnect', (reason: unknown) => {
      logInfo(prefix.value + '被服务器断开连接: ' + reason);
      disconnectedByServer = true; // 标记是服务器主动断开
      Stop(); // 服务器要求断开，调用 Stop 清理所有资源
    });

    // --- 尝试启动连接 ---
    try {
      await connection.start();
      logInfo(prefix.value + '已连接到 vtsuru 服务器, ConnectionId: ' + connection.connectionId);
      console.log(prefix.value + '已连接到 vtsuru 服务器, ConnectionId: ' + connection.connectionId); // 调试输出连接状态
      signalRConnectionId.value = connection.connectionId ?? undefined; // 保存连接ID
      await connection.send('Finished'); // 通知服务器已准备好
      if (isFromClient) {
        await connection.send('SetAsVTsuruClient'); // 如果是客户端，发送标识
      }
      signalRClient.value = connection; // 保存实例
      // state.value = 'connected'; // 状态将在 Start 函数末尾统一设置
      return true;
    } catch (e) {
      logError(prefix.value + '无法连接到 vtsuru 服务器: ' + e);
      signalRConnectionId.value = undefined;
      signalRClient.value = undefined;
      // state.value = 'disconnected'; // 保持 connecting 或由 Start 控制
      return false;
    }
  }

  //   async function reconnect() { // withAutomaticReconnect 存在时，此函数通常不需要手动调用
  //     if (disconnectedByServer || state.value === 'disconnected') return;
  //     logInfo(prefix.value + '尝试手动重连...');
  //     try {
  //       await signalRClient.value?.start();
  //       logInfo(prefix.value + '手动重连成功');
  //       signalRConnectionId.value = signalRClient.value?.connectionId ?? null;
  //       state.value = 'connected';
  //       if (isFromClient) {
  //         await signalRClient.value?.send('SetAsVTsuruClient');
  //       }
  //       await signalRClient.value?.send('Reconnected');
  //     } catch (err) {
  //       logError(prefix.value + '手动重连失败: ' + err);
  //       setTimeout(reconnect, 10000); // 失败后10秒再次尝试
  //     }
  //   }

  /**
   * 接收到弹幕事件时的处理函数
   */
  function onGetDanmakus(command: any) {
    if (isFromClient) {
      // 1. 解析事件类型
      const eventType = getEventType(command);

      // 2. 记录到每日统计 (调用 statistics 模块)
      recordEvent(eventType);

      // 3. 更新会话统计
      sessionEventCount.value++;
      sessionEventTypeCounts.value[eventType] = (sessionEventTypeCounts.value[eventType] || 0) + 1;
    }
    // 4. 加入待发送队列 (确保是字符串)
    const eventString = typeof command === 'string' ? command : JSON.stringify(command);
    if (isDev) {
      //console.log(prefix.value + '收到弹幕事件: ' + eventString); // 开发模式下打印所有事件 (可选)
    }
    if (events.length >= 10000) {
      events.shift(); // 如果队列过长，移除最旧的事件
    }
    events.push(eventString);
  }

  /**
   * 定期将队列中的事件发送到服务器
   */
  async function sendEvents() {
    // 确保 SignalR 已连接
    if (!signalRClient.value || signalRClient.value.state !== signalR.HubConnectionState.Connected) {
      return;
    }
    // 如果没有事件，则不发送
    if (events.length === 0) {
      return;
    }

    // 批量处理事件，每次最多发送20条
    const batchSize = 20;
    const batch = events.slice(0, batchSize);

    try {

      const result = await signalRClient.value.invoke<{ Success: boolean; Message: string; }>(
        'UploadEvents', batch, webfetcherType.value === 'direct'? true : false
      );
      if (result?.Success) {
        events.splice(0, batch.length); // 从队列中移除已成功发送的事件
        successfulUploads.value++;
        bytesSentSession.value += new TextEncoder().encode(batch.join()).length;
      } else {
        failedUploads.value++;
        logError(prefix.value + '上传弹幕失败: ' + result?.Message);
      }
    } catch (err) {
      failedUploads.value++;
      logError(prefix.value + '发送事件时出错: ' + err);
    }
  }

  // --- 暴露给外部使用的状态和方法 ---
  return {
    Start,
    Stop,
    // restartDanmakuClient, // 如果需要重启单独的弹幕客户端，可以保留或实现

    // 状态
    state, // Overall SignalR state
    startedAt,
    isStreaming: computed(() => streamingInfo.value?.status === 'streaming'), // 从 statistics 模块获取
    webfetcherType,

    // 连接详情
    danmakuClientState,
    danmakuServerUrl,
    //signalRConnectionId,
    // heartbeatLatency, // 暂不暴露

    // 会话统计
    sessionEventCount,
    sessionEventTypeCounts,
    successfulUploads,
    failedUploads,
    bytesSentSession,

    // 实例 (谨慎暴露，主要用于调试或特定场景)
    signalRClient: computed(() => signalRClient.value), // 返回计算属性以防直接修改
    client: computed(() => client.value),

  };
});