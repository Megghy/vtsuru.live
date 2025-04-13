import { cookie, useAccount } from '@/api/account';
import { getEventType, recordEvent, streamingInfo } from '@/client/data/info';
import { BASE_HUB_URL, isDev, isTauri } from '@/data/constants';
import BaseDanmakuClient from '@/data/DanmakuClients/BaseDanmakuClient';
import DirectClient, { DirectClientAuthInfo } from '@/data/DanmakuClients/DirectClient';
import OpenLiveClient from '@/data/DanmakuClients/OpenLiveClient';
import * as signalR from '@microsoft/signalr';
import * as msgpack from '@microsoft/signalr-protocol-msgpack';
import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue'; // shallowRef 用于非深度响应对象
import { useRoute } from 'vue-router';
import { useWebRTC } from './useRTC';
import { QueryBiliAPI } from '@/client/data/utils';
import { platform, type, version } from '@tauri-apps/plugin-os';
import { ZstdCodec, ZstdInit } from '@oneidentity/zstd-js/wasm';

import { encode } from "@msgpack/msgpack";
import { getVersion } from '@tauri-apps/api/app';
import { onReceivedNotification } from '@/client/data/notification';
import { useDanmakuClient } from './useDanmakuClient';

export const useWebFetcher = defineStore('WebFetcher', () => {
  const route = useRoute();
  const account = useAccount();
  const rtc = useWebRTC();
  const webfetcherType = ref<'openlive' | 'direct'>('openlive'); // 弹幕客户端类型
  // --- 连接与状态 ---
  const state = ref<'disconnected' | 'connecting' | 'connected'>('disconnected'); // SignalR 连接状态
  const startedAt = ref<Date>(); // 本次启动时间
  const signalRClient = shallowRef<signalR.HubConnection>(); // SignalR 客户端实例 (浅响应)
  const signalRId = ref<string>(); // SignalR 连接 ID
  const client = useDanmakuClient();
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
  let zstd: ZstdCodec | undefined = undefined; // Zstd 编码器实例 (如果需要压缩)

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
      console.log(prefix.value + '已经启动，无需重复启动');
      return { success: true, message: '已启动' };
    }
    try {
      zstd ??= await ZstdInit();

    } catch (error) {
      console.error(prefix.value + '当前浏览器不支持zstd压缩, 回退到原始数据传输');
    }
    webfetcherType.value = type; // 设置弹幕客户端类型
    // 重置会话统计数据
    resetSessionStats();
    startedAt.value = new Date();
    isFromClient = _isFromClient;
    state.value = 'connecting'; // 设置为连接中状态

    // 使用 navigator.locks 确保同一时间只有一个 Start 操作执行
    const result = await navigator.locks.request('webFetcherStartLock', async () => {
      console.log(prefix.value + '开始启动...');
      while (!(await connectSignalR())) {
        console.log(prefix.value + '连接 SignalR 失败, 5秒后重试');
        await new Promise((resolve) => setTimeout(resolve, 5000));
        // 如果用户手动停止，则退出重试循环
        if (state.value === 'disconnected') return { success: false, message: '用户手动停止' };
      }

      let danmakuResult = await connectDanmakuClient(type, directAuthInfo);
      while (!danmakuResult?.success) {
        console.log(prefix.value + '弹幕客户端启动失败, 5秒后重试');
        await new Promise((resolve) => setTimeout(resolve, 5000));
        // 如果用户手动停止，则退出重试循环
        if (state.value === 'disconnected') return { success: false, message: '用户手动停止' };
        danmakuResult = await connectDanmakuClient(type, directAuthInfo);
      }

      // 只有在两个连接都成功后才设置为 connected
      state.value = 'connected';
      disconnectedByServer = false;
      console.log(prefix.value + '启动成功');
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

    console.log(prefix.value + '正在停止...');
    state.value = 'disconnected'; // 立即设置状态，防止重连逻辑触发

    // 清理定时器
    if (timer) { clearInterval(timer); timer = undefined; }

    // 停止弹幕客户端
    client.dispose();
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

    console.log(prefix.value + '已停止');
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
    if (client.state !== 'waiting') {
      console.log(prefix.value + '弹幕客户端已连接或正在连接');
      return { success: true, message: '弹幕客户端已启动' };
    }

    console.log(prefix.value + '正在连接弹幕客户端...');
    danmakuClientState.value = 'connecting';

    if (type === 'openlive') {
      await client.initOpenlive();
    } else {
      if (!directConnectInfo) {
        danmakuClientState.value = 'stopped';
        console.error(prefix.value + '未提供直连弹幕客户端认证信息');
        return { success: false, message: '未提供弹幕客户端认证信息' };
      }
      await client.initDirect(directConnectInfo);
    }

    // 监听所有事件，用于处理和转发
    client?.onEvent('all', onGetDanmakus);

    if (client.connected) {
      console.log(prefix.value + '弹幕客户端连接成功, 开始监听弹幕');
      danmakuClientState.value = 'connected'; // 明确设置状态
      danmakuServerUrl.value = client.danmakuClient!.serverUrl; // 获取服务器地址
      // 启动事件发送定时器 (如果之前没有启动)
      timer ??= setInterval(sendEvents, 1500); // 每 1.5 秒尝试发送一次事件
    } else {
      console.error(prefix.value + '弹幕客户端启动失败');
      danmakuClientState.value = 'stopped';
      danmakuServerUrl.value = undefined;
      client.dispose(); // 启动失败，清理实例，下次会重建
    }
  }

  /**
   * 连接 SignalR 服务器
   */
  async function connectSignalR() {
    if (signalRClient.value && signalRClient.value.state !== signalR.HubConnectionState.Disconnected) {
      console.log(prefix.value + "SignalR 已连接或正在连接");
      return true;
    }

    console.log(prefix.value + '正在连接到 vtsuru 服务器...');
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(BASE_HUB_URL + 'web-fetcher?token=' + (route.query.token ?? account.value.token), { // 使用 account.token
        headers: { Authorization: `Bearer ${cookie.value?.cookie}` },
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets
      })
      .withAutomaticReconnect([0, 2000, 10000, 30000]) // 自动重连策略
      .withHubProtocol(new msgpack.MessagePackHubProtocol()) // 使用 MessagePack 协议
      .build();

    // --- SignalR 事件监听 ---
    connection.onreconnecting(error => {
      console.log(prefix.value + `与服务器断开，正在尝试重连... ${error?.message || ''}`);
      state.value = 'connecting'; // 更新状态为连接中
      signalRConnectionId.value = undefined; // 连接断开，ID失效
    });

    connection.onreconnected(async connectionId => {
      console.log(prefix.value + `与服务器重新连接成功! ConnectionId: ${connectionId}`);
      signalRConnectionId.value = connectionId ?? undefined;
      state.value = 'connected'; // 更新状态为已连接
      signalRId.value = connectionId ?? await sendSelfInfo(connection); // 更新连接ID
      connection.send('Reconnected').catch(err => console.error(prefix.value + "Send Reconnected failed: " + err));
    });

    connection.onclose(async (error) => {
      // 只有在不是由 Stop() 或服务器明确要求断开时才记录错误并尝试独立重连（虽然 withAutomaticReconnect 应该处理）
      if (state.value !== 'disconnected' && !disconnectedByServer) {
        console.error(prefix.value + `与服务器连接关闭: ${error?.message || '未知原因'}. 自动重连将处理.`);
        state.value = 'connecting'; // 标记为连接中，等待自动重连
        signalRConnectionId.value = undefined;
        // withAutomaticReconnect 会处理重连，这里不需要手动调用 reconnect
      } else if (disconnectedByServer) {
        console.log(prefix.value + `连接已被服务器关闭.`);
        Stop(); // 服务器要求断开，则彻底停止
      } else {
        console.log(prefix.value + `连接已手动关闭.`);
      }
    });

    connection.on('Disconnect', (reason: unknown) => {
      console.log(prefix.value + '被服务器断开连接: ' + reason);
      disconnectedByServer = true; // 标记是服务器主动断开
      Stop(); // 服务器要求断开，调用 Stop 清理所有资源
    });
    connection.on('Request', async (url: string, method: string, body: string, useCookie: boolean) => onRequest(url, method, body, useCookie));
    connection.on('Notification', (type: string, data: any) => { onReceivedNotification(type, data); });
    // --- 尝试启动连接 ---
    try {
      await connection.start();
      console.log(prefix.value + '已连接到 vtsuru 服务器, ConnectionId: ' + connection.connectionId); // 调试输出连接状态
      signalRConnectionId.value = connection.connectionId ?? undefined; // 保存连接ID
      signalRId.value = await sendSelfInfo(connection); // 发送客户端信息
      await connection.send('Finished'); // 通知服务器已准备好
      signalRClient.value = connection; // 保存实例
      // state.value = 'connected'; // 状态将在 Start 函数末尾统一设置
      return true;
    } catch (e) {
      console.error(prefix.value + '无法连接到 vtsuru 服务器: ' + e);
      signalRConnectionId.value = undefined;
      signalRClient.value = undefined;
      // state.value = 'disconnected'; // 保持 connecting 或由 Start 控制
      return false;
    }
  }
  async function sendSelfInfo(client: signalR.HubConnection) {
    return client.invoke('SetSelfInfo',
      isFromClient ? `tauri ${platform()} ${version()}` : navigator.userAgent,
      isFromClient ? 'tauri' : 'web',
      isFromClient ? await getVersion() : '1.0.0',
      webfetcherType.value === 'direct');
  }
  type ResponseFetchRequestData = {
    Message: string;
    Success: boolean;
    Data: string;
  };
  async function onRequest(url: string, method: string, body: string, useCookie: boolean) {
    if (!isTauri) {
      console.error(prefix.value + '非Tauri环境下无法处理请求: ' + url);
      return {
        Message: '非Tauri环境',
        Success: false,
        Data: ''
      };
    }
    const result = await QueryBiliAPI(url, method, body, useCookie);
    console.log(`${prefix.value}请求 (${method})${url}: `, result.statusText);
    if (result.ok) {
      const data = await result.text();
      return {
        Message: '请求成功',
        Success: true,
        Data: data
      } as ResponseFetchRequestData;
    }
  }

  //   async function reconnect() { // withAutomaticReconnect 存在时，此函数通常不需要手动调用
  //     if (disconnectedByServer || state.value === 'disconnected') return;
  //     console.log(prefix.value + '尝试手动重连...');
  //     try {
  //       await signalRClient.value?.start();
  //       console.log(prefix.value + '手动重连成功');
  //       signalRConnectionId.value = signalRClient.value?.connectionId ?? null;
  //       state.value = 'connected';
  //       if (isFromClient) {
  //         await signalRClient.value?.send('SetAsVTsuruClient');
  //       }
  //       await signalRClient.value?.send('Reconnected');
  //     } catch (err) {
  //       console.error(prefix.value + '手动重连失败: ' + err);
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
  let updateCount = 0;
  /**
   * 定期将队列中的事件发送到服务器
   */
  async function sendEvents() {
    if (updateCount % 60 == 0) {
      // 每60秒更新一次连接信息
      if (signalRClient.value) {
        await sendSelfInfo(signalRClient.value);
      }
    }
    updateCount++;
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

      let result: { Success: boolean; Message: string; } = { Success: false, Message: '' };
      let length = 0;
      let eventCharLength = batch.map(event => event.length).reduce((a, b) => a + b, 0); // 计算字符长度
      if (zstd && eventCharLength > 100) {
        const data = zstd.ZstdSimple.compress(encode(batch), 11);
        length = data.length;
        result = await signalRClient.value.invoke<{ Success: boolean; Message: string; }>(
          'UploadEventsCompressedV2', data
        );
      }
      else {
        length = new TextEncoder().encode(batch.join()).length;
        result = await signalRClient.value.invoke<{ Success: boolean; Message: string; }>(
          'UploadEvents', batch, webfetcherType.value === 'direct' ? true : false
        );
      }

      if (result?.Success) {
        events.splice(0, batch.length); // 从队列中移除已成功发送的事件
        successfulUploads.value++;
        bytesSentSession.value += length;
      } else {
        failedUploads.value++;
        console.error(prefix.value + '上传弹幕失败: ' + result?.Message);
      }
    } catch (err) {
      failedUploads.value++;
      console.error(prefix.value + '发送事件时出错: ' + err);
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
    signalRId,

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
  };
});