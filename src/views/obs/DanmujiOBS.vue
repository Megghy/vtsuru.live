<script setup lang="ts">
import { useDanmakuClient } from '@/store/useDanmakuClient';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import MessageRender from './blivechat/MessageRender.vue';
// @ts-ignore
import * as constants from './blivechat/constants';
// @ts-ignore
import { useAccount, DownloadConfig, GetConfigHash } from '@/api/account';
import { QueryGetAPI } from '@/api/query';
import { defaultDanmujiCss, VTSURU_API_URL } from '@/data/constants';
import { useWebRTC } from '@/store/useRTC';
import { NAlert } from 'naive-ui';
import { useRoute } from 'vue-router';
// @ts-ignore
import * as pronunciation from './blivechat/utils/pronunciation';
import { EventDataTypes, EventModel } from '@/api/api-models';
// @ts-ignore
import * as trie from './blivechat/utils/trie';

export interface DanmujiConfig {
  minGiftPrice: number,
  showDanmaku: boolean,
  showGift: boolean,
  showGiftName: boolean,
  mergeSimilarDanmaku: boolean,
  mergeGift: boolean,
  maxNumber: number,

  blockLevel: number,
  blockKeywords: string,
  blockUsers: string,
  blockMedalLevel: number,

  giftUsernamePronunciation: string,
  importPresetCss: boolean

  emoticons: {
    keyword: string,
    url: string
  }[]
}

// 默认配置
const defaultConfig: DanmujiConfig = {
  minGiftPrice: 0.1,
  showDanmaku: true,
  showGift: true,
  showGiftName: true,
  mergeSimilarDanmaku: false,
  mergeGift: true,
  maxNumber: 60,

  blockLevel: 0,
  blockKeywords: '',
  blockUsers: '',
  blockMedalLevel: 0,

  giftUsernamePronunciation: '',
  importPresetCss: false,

  emoticons: []
}

defineExpose({ setCss, testAddMessage })
const props = defineProps<{
  active?: boolean,
  visible?: boolean,
  config?: DanmujiConfig
}>()

const customCss = useStorage('danmuji-css', '');

const isOBS = computed(() => {
  // @ts-ignore
  return window.obsstudio !== undefined
})

const messageRender = ref()
const client = await useDanmakuClient().initOpenlive()
const pronunciationConverter = new pronunciation.PronunciationConverter()
const accountInfo = useAccount()
const route = useRoute()

const config = computed(() => props.config ?? defaultConfig)

let textEmoticons: { keyword: string, url: string }[] = []

// 表情词典树计算
const emoticonsTrie = computed(() => {
  const res = new trie.Trie()
  for (const emoticons of [config.value.emoticons, textEmoticons]) {
    for (const emoticon of emoticons) {
      if (emoticon.keyword !== '' && emoticon.url !== '') {
        res.set(emoticon.keyword, emoticon)
      }
    }
  }
  return res
})

// 屏蔽关键词词典树计算
const blockKeywordsTrie = computed(() => {
  const blockKeywords = config.value.blockKeywords.split('\n')
  const res = new trie.Trie()
  for (const keyword of blockKeywords) {
    if (keyword !== '') {
      res.set(keyword, true)
    }
  }
  return res
})

/**
 * 设置自定义CSS
 */
function setCss(css: string) {
  messageRender.value?.setCss(css)
}

/**
 * 处理弹幕消息
 */
async function onAddText(event: EventModel, command: unknown) {
  if (!config.value.showDanmaku || !filterTextMessage(event)) {
    return
  }

  const richContent = await getRichContent(event)
  // 合并要放在异步调用后面，因为异步调用后可能有新的消息，会漏合并
  if (mergeSimilarText(event.msg)) {
    return
  }

  const message = {
    id: `msg-${new Date().getTime()}-${event.uid}`,
    type: constants.MESSAGE_TYPE_TEXT,
    avatarUrl: event.uface,
    time: new Date(),
    authorName: event.uname,
    authorType: getAuthorType(event.open_id, event.guard_level),
    content: event.msg,
    richContent: richContent,
    privilegeType: event.guard_level,
    repeated: 1,
    translation: ''
  }
  messageRender.value.addMessage(message)
}

/**
 * 处理礼物消息
 */
function onAddGift(event: EventModel, command: unknown) {
  if (!config.value.showGift) {
    return
  }

  const price = (event.price * event.num) / 1000
  // 价格过滤
  if (price < (config.value.minGiftPrice ?? 0)) {
    return
  }

  // 尝试合并相似礼物
  if (mergeSimilarGift(event.uname, price, !event.price ? price : 0, event.msg, event.num)) {
    return
  }

  const message = {
    id: `gift-${new Date().getTime()}-${event.uid}`,
    type: constants.MESSAGE_TYPE_GIFT,
    avatarUrl: event.uface,
    time: new Date(),
    authorName: event.uname,
    authorNamePronunciation: getPronunciation(event.uname),
    price: price,
    giftName: event.msg,
    num: event.num
  }
  messageRender.value.addMessage(message)
}

/**
 * 处理舰长上舰消息
 */
function onAddMember(event: EventModel, command: unknown) {
  if (!config.value.showGift || !filterNewMemberMessage(event)) {
    return
  }

  const message = {
    id: `${event.type}-${new Date().getTime()}-${event.uid}`,
    type: constants.MESSAGE_TYPE_MEMBER,
    avatarUrl: event.uface,
    time: new Date(),
    authorName: event.uname,
    authorNamePronunciation: getPronunciation(event.uname),
    privilegeType: event.guard_level,
    title: '新舰长'
  }
  messageRender.value.addMessage(message)
}

/**
 * 处理醒目留言消息
 */
function onAddSuperChat(event: EventModel, command: unknown) {
  if (!config.value.showGift || !filterSuperChatMessage(event)) {
    return
  }

  if (event.price < (config.value.minGiftPrice ?? 0)) {
    return
  }

  const message = {
    id: `${event.type}-${new Date().getTime()}-${event.uid}`,
    type: constants.MESSAGE_TYPE_SUPER_CHAT,
    avatarUrl: event.uface,
    authorName: event.uname,
    authorNamePronunciation: getPronunciation(event.uname),
    price: event.price,
    time: new Date(),
    content: event.msg.trim(),
    translation: ''
  }
  messageRender.value.addMessage(message)
}

/**
 * 处理SC撤回
 */
function onDelSuperChat(event: EventModel, command: unknown) {
  let messageIdsToDelete: string[] = [];

  // 尝试从command中获取需要删除的SC ID
  if (command && typeof command === 'object' && 'data' in command) {
    const commandData = command.data;
    if (commandData && typeof commandData === 'object') {
      if ('message_ids' in commandData && Array.isArray(commandData.message_ids)) {
        messageIdsToDelete = commandData.message_ids.map(id => String(id));
      } else if ('message_id' in commandData) {
        messageIdsToDelete.push(String(commandData.message_id));
      }
    }
  }
  // 尝试使用消息内容作为ID
  else if (event.msg) {
    messageIdsToDelete.push(event.msg);
  }

  if (messageIdsToDelete.length > 0) {
    console.log(`正在删除SC，ID: ${messageIdsToDelete.join(', ')}`);
    messageIdsToDelete.forEach(id => messageRender.value.deleteMessage(id));
  } else {
    console.warn("收到删除SC事件但无法确定要删除的消息ID", event, command);
  }
}

/**
 * 获取用户类型：0-普通用户，1-舰长，3-主播
 */
function getAuthorType(open_id: string, guard_level: number): number {
  if (open_id === client.authInfo?.anchor_info.open_id) {
    return 3 // 主播
  } else if (guard_level !== 0) {
    return 1 // 舰长
  } else {
    return 0 // 普通用户
  }
}

type RichContentType = {
  type: number,
  text: string,
  url?: string,
  width?: number,
  height?: number
}

/**
 * 获取富文本内容（处理表情等）
 */
async function getRichContent(data: EventModel): Promise<RichContentType[]> {
  const richContent: RichContentType[] = []

  // 官方的非文本表情
  if (data.emoji) {
    richContent.push({
      type: constants.CONTENT_TYPE_IMAGE,
      text: data.msg,
      url: data.emoji + '@256w_256h_1e_1c',
      width: 256,
      height: 256
    })
    return richContent
  }

  // 没有文本表情，只能是纯文本
  if (config.value.emoticons.length === 0 && textEmoticons.length === 0) {
    richContent.push({
      type: constants.CONTENT_TYPE_TEXT,
      text: data.msg
    })
    return richContent
  }

  // 可能含有文本表情，需要解析
  let startPos = 0
  let pos = 0
  while (pos < data.msg.length) {
    const remainContent = data.msg.substring(pos)
    const matchEmoticon = emoticonsTrie.value.lazyMatch(remainContent)
    if (matchEmoticon === null) {
      pos++
      continue
    }

    // 加入之前的文本
    if (pos !== startPos) {
      richContent.push({
        type: constants.CONTENT_TYPE_TEXT,
        text: data.msg.slice(startPos, pos)
      })
    }

    // 加入表情
    richContent.push({
      type: constants.CONTENT_TYPE_IMAGE,
      text: matchEmoticon.keyword,
      url: matchEmoticon.url,
      width: 0,
      height: 0
    })
    pos += matchEmoticon.keyword.length
    startPos = pos
  }

  // 加入尾部的文本
  if (pos !== startPos) {
    richContent.push({
      type: constants.CONTENT_TYPE_TEXT,
      text: data.msg.slice(startPos, pos)
    })
  }

  await fillImageContentSizes(richContent)
  return richContent
}

/**
 * 填充图片内容的尺寸信息
 */
async function fillImageContentSizes(richContent: RichContentType[]) {
  const urlSizeMap = new Map()

  // 收集所有需要获取尺寸的图片URL
  for (const content of richContent) {
    if (content.type === constants.CONTENT_TYPE_IMAGE && content.url) {
      urlSizeMap.set(content.url, { width: 0, height: 0 })
    }
  }

  if (urlSizeMap.size === 0) {
    return
  }

  // 并行加载所有图片获取尺寸
  const promises = []
  for (const url of urlSizeMap.keys()) {
    promises.push(new Promise<void>(resolve => {
      const img = document.createElement('img')
      img.onload = () => {
        const size = urlSizeMap.get(url)
        size.width = img.naturalWidth
        size.height = img.naturalHeight
        resolve()
      }
      // 获取失败了默认为0
      img.onerror = () => resolve()
      // 超时保底
      window.setTimeout(() => resolve(), 5000)
      img.src = url
    }))
  }

  await Promise.all(promises)

  // 应用获取的尺寸到富文本内容
  for (const content of richContent) {
    if (content.type === constants.CONTENT_TYPE_IMAGE && content.url) {
      const size = urlSizeMap.get(content.url)
      content.width = size.width
      content.height = size.height
    }
  }
}

/**
 * 获取名称发音
 */
function getPronunciation(text: string): string {
  if (!pronunciationConverter) {
    return ''
  }
  return pronunciationConverter.getPronunciation(text)
}

/**
 * 过滤SC消息
 */
function filterSuperChatMessage(data: EventModel): boolean {
  return filterByContent(data.msg) && filterByAuthorName(data.uname)
}

/**
 * 过滤新舰长消息
 */
function filterNewMemberMessage(data: EventModel): boolean {
  return filterByAuthorName(data.uname)
}

/**
 * 根据内容过滤消息
 */
function filterByContent(content: string): boolean {
  for (let i = 0; i < content.length; i++) {
    const remainContent = content.substring(i)
    if (blockKeywordsTrie.value.lazyMatch(remainContent) !== null) {
      return false
    }
  }
  return true
}

/**
 * 根据用户名过滤消息
 */
function filterByAuthorName(id: string): boolean {
  return !(accountInfo.value && accountInfo.value.biliBlackList && id in accountInfo.value.biliBlackList)
}

/**
 * 过滤弹幕消息
 */
function filterTextMessage(data: EventModel): boolean {
  // 舰长等级过滤
  if (config.value.blockLevel > 0 && data.guard_level < config.value.blockLevel) {
    return false
  }
  // 粉丝牌等级过滤
  else if (config.value.blockMedalLevel > 0 && data.fans_medal_level < config.value.blockMedalLevel) {
    return false
  }
  return filterByContent(data.msg) && filterByAuthorName(data.uname)
}

/**
 * 合并相似文本
 */
function mergeSimilarText(content: string): boolean {
  if (!config.value.mergeSimilarDanmaku) {
    return false
  }
  return messageRender.value.mergeSimilarText(content)
}

/**
 * 合并相似礼物
 */
function mergeSimilarGift(authorName: string, price: number, freePrice: number, giftName: string, num: number): boolean {
  if (!config.value.mergeGift) {
    return false
  }
  return messageRender.value.mergeSimilarGift(authorName, price, freePrice, giftName, num)
}

// --- 修改测试方法 ---
/**
 * 用于测试，手动触发消息添加
 * @param rawEventData 测试用的 EventModel 部分数据和可选的 data 负载
 */
async function testAddMessage(rawEventData: Partial<EventModel> & { type: EventDataTypes, data?: any }) {
  const event: EventModel = {
    type: rawEventData.type,
    uname: rawEventData.uname ?? '测试用户',
    uface: rawEventData.uface ?? '',
    uid: rawEventData.uid ?? 1000,
    open_id: rawEventData.open_id ?? 'test_open_id',
    msg: rawEventData.msg ?? '',
    time: rawEventData.time ?? Date.now() / 1000,
    num: rawEventData.num ?? 1,
    price: rawEventData.price ?? 0,
    guard_level: rawEventData.guard_level ?? 0,
    fans_medal_level: rawEventData.fans_medal_level ?? 0,
    fans_medal_name: rawEventData.fans_medal_name ?? '',
    fans_medal_wearing_status: rawEventData.fans_medal_wearing_status ?? false,
    emoji: rawEventData.emoji,
    ouid: rawEventData.ouid ?? '',
    ...(rawEventData.data ? { data: rawEventData.data } : {})
  };

  switch (event.type) {
    case EventDataTypes.Message:
      await onAddText(event, null);
      break;
    case EventDataTypes.Gift:
      onAddGift(event, null);
      break;
    case EventDataTypes.Guard:
      onAddMember(event, null);
      break;
    case EventDataTypes.SC:
      onAddSuperChat(event, null);
      break;
    case EventDataTypes.SCDel:
      onDelSuperChat(event, null);
      break;
    default:
      console.warn('Unsupported test event type:', event.type);
  }
}
// --- 结束修改测试方法 ---

/**
 * 添加系统通知消息
 */
function addSystemNotice(message: string) {
  if (!messageRender.value) return;

  const systemMessage = {
    id: `system-${Date.now()}`,
    type: constants.MESSAGE_TYPE_TEXT,
    avatarUrl: '',
    time: new Date(),
    authorName: '系统通知',
    authorType: 2, // 使用特殊类型标识系统消息
    content: message,
    richContent: [{
      type: constants.CONTENT_TYPE_TEXT,
      text: message
    }],
    privilegeType: 0,
    repeated: 1,
    translation: '',
    isSystem: true // 添加标记以便在UI中特殊处理
  }

  messageRender.value.addMessage(systemMessage)
}

let configHashCheckTimer: ReturnType<typeof setInterval> | null = null;
let currentConfigHash: string | null = null;

// 从服务器获取配置
async function getConfigFromServer() {
  try {
    const result = await DownloadConfig<DanmujiConfig>('danmuji-config');
    if (result.status === 'success' && result.data) {
      Object.assign(config.value, result.data);
      console.log('已从服务器获取弹幕姬配置');
      addSystemNotice('配置已从服务器更新');
      return true;
    } else if (result.status === 'notfound') {
      console.log('服务器上未找到弹幕姬配置');
    } else {
      console.error(`获取配置失败: ${result.msg}`);
    }
  } catch (error) {
    console.error('获取配置文件出错:', error);
  }
  return false;
}

// 检查配置文件哈希值
async function checkConfigHash() {
  if (!isOBS.value) return;

  try {
    const hash = await GetConfigHash('danmuji-config');
    if (hash && hash !== currentConfigHash) {
      console.log('配置文件已更新，正在获取新配置...');
      currentConfigHash = hash;
      await getConfigFromServer();
    }
  } catch (error) {
    console.error('检查配置哈希值出错:', error);
  }
}

// 启动定时检查配置
function startConfigHashCheck() {
  if (!isOBS.value) return;

  // 先获取一次当前哈希值
  GetConfigHash('danmuji-config').then(hash => {
    currentConfigHash = hash;
  });

  // 设置定时检查，每5秒检查一次
  configHashCheckTimer = setInterval(checkConfigHash, 5000);
}

onMounted(async () => {
  client.onEvent('danmaku', onAddText)
  client.onEvent('gift', onAddGift)
  client.onEvent('sc', onAddSuperChat)
  client.onEvent('guard', onAddMember)
  client.onEvent('scDel', onDelSuperChat)

  try {
    const result = await QueryGetAPI<{ keyword: string, url: string }[]>(VTSURU_API_URL + 'blivechat/emoticon')
    if (result.code === 200) {
      textEmoticons = result.data
    }
  } catch (error) {
    console.error('加载表情包失败:', error)
  }

  // 监听CSS变化
  watch(customCss, (newVal) => {
    messageRender.value?.setCss(newVal)
  })

  // 显示弹幕姬加载完成的通知
  setTimeout(() => {
    addSystemNotice('加载完成');
  }, 300);

  // 在OBS环境下，获取配置并启动配置检查
  // @ts-ignore
  if (window.obsstudio) {
    await getConfigFromServer();
    startConfigHashCheck();

    messageRender.value?.setCss(defaultDanmujiCss)
    console.log('设置默认CSS')
  } else {
    messageRender.value?.setCss(customCss.value)
  }
})

onUnmounted(() => {
  client.offEvent('danmaku', onAddText)
  client.offEvent('gift', onAddGift)
  client.offEvent('sc', onAddSuperChat)
  client.offEvent('guard', onAddMember)
  client.offEvent('scDel', onDelSuperChat)

  // 清除定时器
  if (configHashCheckTimer) {
    clearInterval(configHashCheckTimer);
    configHashCheckTimer = null;
  }
})
</script>

<template>
  <NAlert
    v-if="!$route.query.token && isOBS"
    type="error"
  >
    未携带token参数
  </NAlert>
  <MessageRender
    v-else
    ref="messageRender"
    :custom-css="customCss"
    :show-gift-name="config.showGiftName"
    style="height: 100%; width: 100%"
  />
</template>

<style scoped>
.body {
  background-color: transparent;
}
</style>

