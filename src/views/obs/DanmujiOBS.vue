<script setup lang="ts">
import { useDanmakuClient } from '@/store/useDanmakuClient';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import MessageRender from './blivechat/MessageRender.vue';
// @ts-ignore
import * as constants from './blivechat/constants';
// @ts-ignore
import * as pronunciation from './blivechat/utils/pronunciation';
import { DownloadConfig, useAccount } from '@/api/account';
import { QueryGetAPI } from '@/api/query';
import { VTSURU_API_URL } from '@/data/constants';
import { DanmakuInfo, GiftInfo, GuardInfo, SCInfo } from '@/data/DanmakuClients/OpenLiveClient';
import { useWebRTC } from '@/store/useRTC';
import { NAlert } from 'naive-ui';
import { useRoute } from 'vue-router';
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

defineExpose({ setCss })
const { customCss, isOBS = true } = defineProps<{
  customCss?: string
  isOBS?: boolean,
  active?: boolean,
  visible?: boolean,
}>()

const messageRender = ref()
const client = await useDanmakuClient().initOpenlive()
const pronunciationConverter = new pronunciation.PronunciationConverter()
const accountInfo = useAccount()
const route = useRoute()

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

let textEmoticons: { keyword: string, url: string }[] = []
const config = ref<DanmujiConfig>(JSON.parse(JSON.stringify(defaultConfig)))
const rtc = await useWebRTC().Init('slave')

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
async function onAddText(data: DanmakuInfo, command: unknown) {
  if (!config.value.showDanmaku || !filterTextMessage(data)) {
    return
  }

  const richContent = await getRichContent(data)
  // 合并要放在异步调用后面，因为异步调用后可能有新的消息，会漏合并
  if (mergeSimilarText(data.msg)) {
    return
  }

  const message = {
    id: data.msg_id,
    type: constants.MESSAGE_TYPE_TEXT,
    avatarUrl: data.uface,
    time: new Date(data.timestamp * 1000),
    authorName: data.uname,
    authorType: getAuthorType(data.open_id, data.guard_level),
    content: data.msg,
    richContent: richContent,
    privilegeType: data.guard_level,
    repeated: 1,
    translation: ''
  }
  messageRender.value.addMessage(message)
}

/**
 * 处理礼物消息
 */
function onAddGift(data: GiftInfo, command: unknown) {
  if (!config.value.showGift) {
    return
  }

  const price = (data.price * data.gift_num) / 1000
  // 价格过滤
  if (price < (config.value.minGiftPrice ?? 0)) {
    return
  }

  // 尝试合并相似礼物
  if (mergeSimilarGift(data.uname, price, !data.paid ? price : 0, data.gift_name, data.gift_num)) {
    return
  }

  const message = {
    id: data.msg_id,
    type: constants.MESSAGE_TYPE_GIFT,
    avatarUrl: data.uface,
    time: new Date(data.timestamp * 1000),
    authorName: data.uname,
    authorNamePronunciation: getPronunciation(data.uname),
    price: price,
    giftName: data.gift_name,
    num: data.gift_num
  }
  messageRender.value.addMessage(message)
}

/**
 * 处理舰长上舰消息
 */
function onAddMember(data: GuardInfo, command: unknown) {
  if (!config.value.showGift || !filterNewMemberMessage(data)) {
    return
  }

  const message = {
    id: data.msg_id,
    type: constants.MESSAGE_TYPE_MEMBER,
    avatarUrl: data.user_info.uface,
    time: new Date(data.timestamp * 1000),
    authorName: data.user_info.uname,
    authorNamePronunciation: getPronunciation(data.user_info.uname),
    privilegeType: data.guard_level,
    title: '新舰长'
  }
  messageRender.value.addMessage(message)
}

/**
 * 处理醒目留言消息
 */
function onAddSuperChat(data: SCInfo) {
  if (!config.value.showGift || !filterSuperChatMessage(data)) {
    return
  }

  if (data.rmb < (config.value.minGiftPrice ?? 0)) {
    return
  }

  const message = {
    id: data.msg_id,
    type: constants.MESSAGE_TYPE_SUPER_CHAT,
    avatarUrl: data.uface,
    authorName: data.uname,
    authorNamePronunciation: getPronunciation(data.uname),
    price: data.rmb,
    time: new Date(data.timestamp * 1000),
    content: data.msg_id.trim(),
    translation: ''
  }
  messageRender.value.addMessage(message)
}

/**
 * 处理SC撤回
 */
function onDelSuperChat(data: { id: string }) {
  messageRender.value.deleteMessage(data.id)
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
async function getRichContent(data: DanmakuInfo): Promise<RichContentType[]> {
  const richContent: RichContentType[] = []

  // 官方的非文本表情
  if (data.emoji_img_url) {
    richContent.push({
      type: constants.CONTENT_TYPE_IMAGE,
      text: data.msg,
      url: data.emoji_img_url + '@256w_256h_1e_1c',
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
function filterSuperChatMessage(data: SCInfo): boolean {
  return filterByContent(data.message) && filterByAuthorName(data.uname)
}

/**
 * 过滤新舰长消息
 */
function filterNewMemberMessage(data: GuardInfo): boolean {
  return filterByAuthorName(data.user_info.uname)
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
  return !(id in accountInfo.value.biliBlackList)
}

/**
 * 过滤弹幕消息
 */
function filterTextMessage(data: DanmakuInfo): boolean {
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

/**
 * 接收配置更新
 */
function onReceiveConfig(data: DanmujiConfig) {
  config.value = data
}

onMounted(async () => {
  // 注册事件监听
  client.on('danmaku', onAddText)
  client.on('gift', onAddGift)
  client.on('sc', onAddSuperChat)
  client.on('guard', onAddMember)

  // 注册RTC配置接收
  if (rtc) {
    rtc.on('danmuji.config', onReceiveConfig)
  }

  // 加载表情包
  try {
    const result = await QueryGetAPI<{ keyword: string, url: string }[]>(VTSURU_API_URL + 'blivechat/emoticon')
    if (result.code === 200) {
      textEmoticons = result.data
    }
  } catch (error) {
    console.error('加载表情包失败:', error)
  }
})

onUnmounted(() => {
  // 取消事件监听
  client.off('danmaku', onAddText)
  client.off('gift', onAddGift)
  client.off('sc', onAddSuperChat)
  client.off('guard', onAddMember)

  // 取消RTC配置接收
  if (rtc) {
    rtc.off('danmuji.config', onReceiveConfig)
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