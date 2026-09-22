<script setup lang="ts">
import { NAlert } from 'naive-ui'
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

// @ts-ignore
import { useAccount } from '@/api/account'
import type { EventModel } from '@/api/api-models'
import { EventDataTypes } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
// @ts-ignore
import * as constants from '@/apps/obs/components/blivechat/constants'
import { getRichContent } from '@/apps/obs/components/blivechat/richContent'
import MessageRender from '@/apps/obs/components/blivechat/MessageRender.vue'
// @ts-ignore
import * as pronunciation from '@/apps/obs/components/blivechat/utils/pronunciation'
// @ts-ignore
import * as trie from '@/apps/obs/components/blivechat/utils/trie'
import { VTSURU_API_URL } from '@/shared/config'
import { buildDanmujiCss } from '@/shared/danmujiStyle'
import { useDanmujiConfig } from '@/apps/obs/composables/useDanmujiConfig'
import { type DanmujiConfig } from '@/shared/danmujiConfig'
import type { AuthInfo } from '@/shared/services/DanmakuClients/OpenLiveClient'
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


const isOBS = computed(() => {
  // @ts-ignore
  return typeof window !== 'undefined' && window.obsstudio !== undefined
})

const effectiveConfig = useDanmujiConfig(props)
const effectiveCss = computed(() => props.customCss ?? buildDanmujiCss(effectiveConfig.value.style))
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

  const richContent = await getRichContent(event, emoticonsTrie.value)
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
    :appearance="effectiveConfig.style"
    :show-gift-name="effectiveConfig.showGiftName"
    style="height: 100%; width: 100%"
  />
</template>

<style scoped>
.body {
  background-color: transparent;
}
</style>
