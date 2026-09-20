<script setup lang="ts">
import { NAlert } from 'naive-ui'
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

// @ts-ignore
import { DownloadConfig, GetConfigHash, useAccount } from '@/api/account'
import type { EventModel } from '@/api/api-models'
import { EventDataTypes } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
// @ts-ignore
import * as constants from '@/apps/obs/components/blivechat/constants'
import MessageRender from '@/apps/obs/components/blivechat/MessageRender.vue'
// @ts-ignore
import * as pronunciation from '@/apps/obs/components/blivechat/utils/pronunciation'
// @ts-ignore
import * as trie from '@/apps/obs/components/blivechat/utils/trie'
import { VTSURU_API_URL } from '@/shared/config'
import { defaultDanmujiCss } from '@/shared/config/defaultDanmujiCss'
import { type DanmujiConfig, defaultDanmujiConfig, normalizeDanmujiConfig } from '@/shared/danmujiConfig'
import type { AuthInfo } from '@/shared/services/DanmakuClients/OpenLiveClient'
import { usePersistedStorage } from '@/shared/storage/persist'
import { getDeletedSuperChatIds } from '@/shared/utils/danmakuWindowEvents'
import { useDanmakuClient } from '@/store/useDanmakuClient'

export type { DanmujiConfig }

const props = withDefaults(
  defineProps<{
    active?: boolean
    visible?: boolean
    preview?: boolean
    config?: DanmujiConfig
    customCss?: string
    openLiveAuth?: AuthInfo
  }>(),
  {
    preview: false,
  },
)

const emit = defineEmits<{
  (e: 'ready'): void
}>()

const persistedCss = usePersistedStorage('danmuji-css', '')

const isOBS = computed(() => {
  // @ts-ignore
  return typeof window !== 'undefined' && window.obsstudio !== undefined
})

const effectiveCss = computed(() => {
  if (props.customCss !== undefined && props.customCss !== null) {
    return props.customCss
  }
  return persistedCss.value || defaultDanmujiCss
})

const internalConfig = ref<DanmujiConfig>({ ...defaultDanmujiConfig })


const effectiveConfig = computed(() => props.config ?? internalConfig.value)
const messageRender = ref<InstanceType<typeof MessageRender> | null>(null)
const danmakuClient = useDanmakuClient()
let client: Awaited<ReturnType<typeof danmakuClient.initOpenlive>> | null = null
let disposed = false
const pronunciationConverter = new pronunciation.PronunciationConverter()
const accountInfo = useAccount()

let textEmoticons: { keyword: string; url: string }[] = []


// 表情词典树计算
const emoticonsTrie = computed(() => {
  const res = new trie.Trie()
  for (const emoticons of [effectiveConfig.value.emoticons, textEmoticons]) {
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
  const blockKeywords = (effectiveConfig.value.blockKeywords || '').split('\n')
  const res = new trie.Trie()
  for (const keyword of blockKeywords) {
    const trimmed = keyword.trim()
    if (trimmed !== '') {
      res.set(trimmed, true)
    }
  }
  return res
})

// 屏蔽用户名单计算
const blockUsersSet = computed(() => {
  const text = effectiveConfig.value.blockUsers || ''
  const list = text
    .split('\n')
    .map((u) => u.trim())
    .filter(Boolean)
  return new Set(list)
})

/**
 * 设置自定义CSS
 */
function setCss(css: string) {
  messageRender.value?.setCss(css)
}

/**
 * 清空已显示与缓冲的消息
 */
function clearMessages() {
  messageRender.value?.clearMessages()
}

/**
 * 处理弹幕消息
 */
async function onAddText(event: EventModel, _command: unknown) {
  if (!effectiveConfig.value.showDanmaku || !filterTextMessage(event)) {
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
    richContent,
    privilegeType: event.guard_level,
    repeated: 1,
    translation: '',
  }
  messageRender.value?.addMessage(message)
}

/**
 * 处理礼物消息
 */
function onAddGift(event: EventModel, _command: unknown) {
  if (!effectiveConfig.value.showGift || !filterByAuthor(event.uname, event.uid)) {
    return
  }

  const price = (event.price * event.num) / 1000
  // 价格过滤
  if (price < (effectiveConfig.value.minGiftPrice ?? 0)) {
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
    price,
    giftName: event.msg,
    num: event.num,
  }
  messageRender.value?.addMessage(message)
}

/**
 * 处理舰长上舰消息
 */
function onAddMember(event: EventModel, _command: unknown) {
  if (!effectiveConfig.value.showGift || !filterNewMemberMessage(event)) {
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
    title: '新舰长',
  }
  messageRender.value?.addMessage(message)
}

/**
 * 处理醒目留言消息
 */
function onAddSuperChat(event: EventModel, _command: unknown) {
  if (!effectiveConfig.value.showGift || !filterSuperChatMessage(event)) {
    return
  }

  if (event.price < (effectiveConfig.value.minGiftPrice ?? 0)) {
    return
  }

  const message = {
    id: event.id === undefined ? `${event.type}-${new Date().getTime()}-${event.uid}` : String(event.id),
    type: constants.MESSAGE_TYPE_SUPER_CHAT,
    avatarUrl: event.uface,
    authorName: event.uname,
    authorNamePronunciation: getPronunciation(event.uname),
    price: event.price,
    time: new Date(),
    content: event.msg.trim(),
    translation: '',
  }
  messageRender.value?.addMessage(message)
}

/**
 * 处理SC撤回
 */
function onDelSuperChat(event: EventModel, _command: unknown) {
  const messageIdsToDelete = getDeletedSuperChatIds(event)
  if (messageIdsToDelete.size > 0) {
    console.log(`正在删除SC，ID: ${[...messageIdsToDelete].join(', ')}`)
    messageIdsToDelete.forEach((id) => messageRender.value?.deleteMessage(id))
  } else {
    console.warn('收到删除SC事件但无法确定要删除的消息ID', event)
  }
}

/**
 * 获取用户类型：0-普通用户，1-舰长，3-主播
 */
function getAuthorType(open_id: string, guard_level: number): number {
  if (client?.authInfo?.anchor_info?.open_id && open_id === client.authInfo.anchor_info.open_id) {
    return 3 // 主播
  } else if (guard_level !== 0) {
    return 1 // 舰长
  } else {
    return 0 // 普通用户
  }
}

interface RichContentType {
  type: number
  text: string
  url?: string
  width?: number
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
      url: `${data.emoji}@256w_256h_1e_1c`,
      width: 256,
      height: 256,
    })
    return richContent
  }

  // 没有文本表情，只能是纯文本
  if (effectiveConfig.value.emoticons.length === 0 && textEmoticons.length === 0) {
    richContent.push({
      type: constants.CONTENT_TYPE_TEXT,
      text: data.msg,
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
        text: data.msg.slice(startPos, pos),
      })
    }

    // 加入表情
    richContent.push({
      type: constants.CONTENT_TYPE_IMAGE,
      text: matchEmoticon.keyword,
      url: matchEmoticon.url,
      width: 0,
      height: 0,
    })
    pos += matchEmoticon.keyword.length
    startPos = pos
  }

  // 加入尾部的文本
  if (pos !== startPos) {
    richContent.push({
      type: constants.CONTENT_TYPE_TEXT,
      text: data.msg.slice(startPos, pos),
    })
  }

  await fillImageContentSizes(richContent)
  return richContent
}

/**
 * 填充图片内容的尺寸信息
 */
async function fillImageContentSizes(richContent: RichContentType[]) {
  if (typeof document === 'undefined') {
    return
  }

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
    promises.push(
      new Promise<void>((resolve) => {
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
      }),
    )
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
  return filterByContent(data.msg) && filterByAuthor(data.uname, data.uid)
}

/**
 * 过滤新舰长消息
 */
function filterNewMemberMessage(data: EventModel): boolean {
  return filterByAuthor(data.uname, data.uid)
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
 * 根据用户名或UID过滤消息（黑名单）
 */
function filterByAuthor(name?: string, uid?: string | number): boolean {
  if (name && blockUsersSet.value.has(name)) {
    return false
  }
  if (uid !== undefined && uid !== null && blockUsersSet.value.has(String(uid))) {
    return false
  }
  if (name && accountInfo.value?.biliBlackList && name in accountInfo.value.biliBlackList) {
    return false
  }
  return true
}

/**
 * 过滤弹幕消息
 */
function filterTextMessage(data: EventModel): boolean {
  // 舰长等级过滤
  if (effectiveConfig.value.blockLevel > 0 && data.guard_level < effectiveConfig.value.blockLevel) {
    return false
  }
  // 粉丝牌等级过滤
  else if (effectiveConfig.value.blockMedalLevel > 0 && data.fans_medal_level < effectiveConfig.value.blockMedalLevel) {
    return false
  }
  return filterByContent(data.msg) && filterByAuthor(data.uname, data.uid)
}

/**
 * 合并相似文本
 */
function mergeSimilarText(content: string): boolean {
  if (!effectiveConfig.value.mergeSimilarDanmaku || !messageRender.value) {
    return false
  }
  return messageRender.value.mergeSimilarText(content)
}

/**
 * 合并相似礼物
 */
function mergeSimilarGift(
  authorName: string,
  price: number,
  freePrice: number,
  giftName: string,
  num: number,
): boolean {
  if (!effectiveConfig.value.mergeGift || !messageRender.value) {
    return false
  }
  return messageRender.value.mergeSimilarGift(authorName, price, freePrice, giftName, num)
}

/**
 * 用于测试与仿真，手动触发消息添加
 * @param rawEventData 测试用的 EventModel 部分数据和可选的 data 负载
 */
async function testAddMessage(rawEventData: Partial<EventModel> & { type: EventDataTypes; data?: any }) {
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
    ...(rawEventData.data ? { data: rawEventData.data } : {}),
  }

  switch (event.type) {
    case EventDataTypes.Message:
      await onAddText(event, null)
      break
    case EventDataTypes.Gift:
      onAddGift(event, null)
      break
    case EventDataTypes.Guard:
      onAddMember(event, null)
      break
    case EventDataTypes.SC:
      onAddSuperChat(event, null)
      break
    case EventDataTypes.SCDel:
      onDelSuperChat(event, null)
      break
    default:
      console.warn('Unsupported test event type:', event.type)
  }
}

/**
 * 添加系统通知消息
 */
function addSystemNotice(message: string) {
  if (!messageRender.value) return

  const systemMessage = {
    id: `system-${Date.now()}`,
    type: constants.MESSAGE_TYPE_TEXT,
    avatarUrl: '',
    time: new Date(),
    authorName: '系统通知',
    authorType: 2, // 使用特殊类型标识系统消息
    content: message,
    richContent: [
      {
        type: constants.CONTENT_TYPE_TEXT,
        text: message,
      },
    ],
    privilegeType: 0,
    repeated: 1,
    translation: '',
    isSystem: true, // 添加标记以便在UI中特殊处理
  }

  messageRender.value.addMessage(systemMessage)
}

let configHashCheckTimer: ReturnType<typeof setInterval> | null = null
let currentConfigHash: string | null = null

// 从服务器获取配置
async function getConfigFromServer() {
  try {
    const result = await DownloadConfig<DanmujiConfig>('danmuji-config')
    if (result.status === 'success' && result.data) {
      internalConfig.value = normalizeDanmujiConfig(result.data)
      console.log('已从服务器获取弹幕姬配置')
      addSystemNotice('配置已从服务器更新')
      return true
    } else if (result.status === 'notfound') {
      console.log('服务器上未找到弹幕姬配置')
    } else {
      console.error(`获取配置失败: ${result.msg}`)
    }
  } catch (error) {
    console.error('获取配置文件出错:', error)
  }
  return false
}

// 检查配置文件哈希值
async function checkConfigHash() {
  if (!isOBS.value) return

  try {
    const hash = await GetConfigHash('danmuji-config')
    if (hash && hash !== currentConfigHash) {
      console.log('配置文件已更新，正在获取新配置...')
      currentConfigHash = hash
      await getConfigFromServer()
    }
  } catch (error) {
    console.error('检查配置哈希值出错:', error)
  }
}

// 启动定时检查配置
function startConfigHashCheck() {
  if (!isOBS.value) return

  GetConfigHash('danmuji-config').then((hash) => {
    currentConfigHash = hash
  })

  configHashCheckTimer = setInterval(checkConfigHash, 5000)
}

defineExpose({
  setCss,
  testAddMessage,
  pushTestEvent: testAddMessage,
  clearMessages,
})

onMounted(async () => {
  // 渲染器就绪通知
  nextTick(() => {
    emit('ready')
  })


  // 加载通用静态表情包
  try {
    const result = await QueryGetAPI<{ keyword: string; url: string }[]>(`${VTSURU_API_URL}blivechat/emoticon`)
    if (result.code === 200 && Array.isArray(result.data)) {
      textEmoticons = result.data
    }
  } catch (error) {
    console.error('加载表情包失败:', error)
  }

  // 预览模式：不建立真实弹幕连接、不拉取远端配置、不发系统消息、不轮询
  if (props.preview || disposed) {
    return
  }

  // 真实弹幕客户端连接
  client = danmakuClient.connected ? danmakuClient : await danmakuClient.initOpenlive(props.openLiveAuth)
  if (disposed) return
  client.onEvent('danmaku', onAddText)
  client.onEvent('gift', onAddGift)
  client.onEvent('sc', onAddSuperChat)
  client.onEvent('guard', onAddMember)
  client.onEvent('scDel', onDelSuperChat)
  addSystemNotice('加载完成')

  // OBS 运行时环境配置拉取与定时比对
  if (isOBS.value) {
    await getConfigFromServer()
    if (!disposed) startConfigHashCheck()
  }
})

onUnmounted(() => {
  disposed = true
  if (client) {
    client.offEvent('danmaku', onAddText)
    client.offEvent('gift', onAddGift)
    client.offEvent('sc', onAddSuperChat)
    client.offEvent('guard', onAddMember)
    client.offEvent('scDel', onDelSuperChat)
  }

  if (configHashCheckTimer) {
    clearInterval(configHashCheckTimer)
    configHashCheckTimer = null
  }
})
</script>

<template>
  <NAlert
    v-if="!preview && isOBS && !$route?.query?.token"
    type="error"
  >
    未携带token参数
  </NAlert>
  <MessageRender
    v-else
    ref="messageRender"
    :custom-css="effectiveCss"
    :max-number="effectiveConfig.maxNumber"
    :show-gift-name="effectiveConfig.showGiftName"
    style="height: 100%; width: 100%"
  />
</template>

<style scoped>
.body {
  background-color: transparent;
}
</style>
