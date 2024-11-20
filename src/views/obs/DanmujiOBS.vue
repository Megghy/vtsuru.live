<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import MessageRender from './blivechat/MessageRender.vue';
import { useDanmakuClient } from '@/store/useDanmakuClient';
// @ts-ignore
import * as constants from './blivechat/constants';
// @ts-ignore
import * as chatModels from './blivechat/models';
// @ts-ignore
import * as pronunciation from './blivechat/utils/pronunciation'
// @ts-ignore
import * as trie from './blivechat/utils/trie'
import { DanmakuInfo, GiftInfo, GuardInfo, SCInfo } from '@/data/DanmakuClient';
import { EventModel } from '@/api/api-models';
import { DownloadConfig, useAccount } from '@/api/account';
import { useWebRTC } from '@/store/useRTC';
import { QueryGetAPI } from '@/api/query';
import { OPEN_LIVE_API_URL, VTSURU_API_URL } from '@/data/constants';
import { CustomChart } from 'echarts/charts';

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
const props = defineProps<{
  customCss?: string
}>()

const messageRender = ref()
const client = await useDanmakuClient().initClient()
const pronunciationConverter = new pronunciation.PronunciationConverter()
const accountInfo = useAccount()


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
} as DanmujiConfig
let textEmoticons: { keyword: string, url: string }[] = []
const config = ref<DanmujiConfig>(JSON.parse(JSON.stringify(defaultConfig)))
const rtc = useWebRTC().Init('slave')

const emoticonsTrie = computed(() => {
  let res = new trie.Trie()
  for (let emoticons of [config.value.emoticons, textEmoticons]) {
    for (let emoticon of emoticons) {
      if (emoticon.keyword !== '' && emoticon.url !== '') {
        res.set(emoticon.keyword, emoticon)
      }
    }
  }
  return res
})
const blockKeywordsTrie = computed(() => {
  let blockKeywords = config.value.blockKeywords.split('\n')
  let res = new trie.Trie()
  for (let keyword of blockKeywords) {
    if (keyword !== '') {
      res.set(keyword, true)
    }
  }
  return res
})

function setCss(css: string) {
  messageRender.value?.setCss(css)
}

/** @param {chatModels.AddTextMsg} data */
async function onAddText(data: DanmakuInfo, command: unknown) {
  if (!config.value.showDanmaku || !filterTextMessage(data)) {
    return
  }

  let richContent = await getRichContent(data)
  // 合并要放在异步调用后面，因为异步调用后可能有新的消息，会漏合并
  if (mergeSimilarText(data.msg)) {
    return
  }
  let message = {
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
/** @param {chatModels.AddGiftMsg} data */
function onAddGift(data: GiftInfo, command: any) {
  if (!config.value.showGift) {
    return
  }
  let price = (data.price * data.gift_num) / 1000
  if (mergeSimilarGift(data.uname, price, !data.paid ? price : 0, data.gift_name, data.gift_num)) {
    return
  }
  if (price < (config.value.minGiftPrice ?? 0)) { // 丢人
    return
  }
  let message = {
    id: data.msg_id,
    type: constants.MESSAGE_TYPE_GIFT,
    avatarUrl: data.uface,
    time: new Date(data.timestamp * 1000),
    authorName: data.uname,
    authorNamePronunciation: getPronunciation(data.uname),
    price: price,
    // freePrice: data.totalFreeCoin, // 暂时没用到
    giftName: data.gift_name,
    num: data.gift_num
  }
  messageRender.value.addMessage(message)
}
/** @param {chatModels.AddMemberMsg} data */
function onAddMember(data: GuardInfo, command: any) {
  if (!config.value.showGift || !filterNewMemberMessage(data)) {
    return
  }
  let message = {
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
/** @param {chatModels.AddSuperChatMsg} data */
function onAddSuperChat(data: SCInfo) {
  if (!config.value.showGift || !filterSuperChatMessage(data)) {
    return
  }
  if (data.rmb < (config.value.minGiftPrice ?? 0)) { // 丢人
    return
  }
  let message = {
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
/** @param {chatModels.DelSuperChatMsg} data */
function onDelSuperChat(data: any) {
  messageRender.value.deleteMessage(data.id)
}
function getAuthorType(open_id: string, guard_level: number) {
  let authorType
  if (open_id === client.authInfo?.anchor_info.open_id) {
    authorType = 3
  } else if (guard_level !== 0) {
    authorType = 1
  } else {
    authorType = 0
  }
}
type RichContentType = {
  type: string,
  text: string,
  url?: string,
  width?: number,
  height?: number
}
async function getRichContent(data: DanmakuInfo) {
  let richContent: RichContentType[] = []
  // 官方的非文本表情
  if (data.emoji_img_url) {
    richContent.push({
      type: constants.CONTENT_TYPE_IMAGE,
      text: data.msg,
      url: data.emoji_img_url + '@256w_256h_1e_1c',
      width: 256,
      height: 256
    })
    //await fillImageContentSizes(richContent)
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
    let remainContent = data.msg.substring(pos)
    let matchEmoticon = emoticonsTrie.value.lazyMatch(remainContent)
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
async function fillImageContentSizes(richContent: RichContentType[]) {
  let urlSizeMap = new Map()
  for (let content of richContent) {
    if (content.type === constants.CONTENT_TYPE_IMAGE) {
      urlSizeMap.set(content.url, { width: 0, height: 0 })
    }
  }
  if (urlSizeMap.size === 0) {
    return
  }

  let promises = []
  for (let url of urlSizeMap.keys()) {
    let urlInClosure = url
    promises.push(new Promise(
      resolve => {
        let img = document.createElement('img')
        img.onload = () => {
          let size = urlSizeMap.get(urlInClosure)
          size.width = img.naturalWidth
          size.height = img.naturalHeight
          // @ts-expect-error 忽略这里测错误
          resolve()
        }
        // 获取失败了默认为0
        img.onerror = resolve
        // 超时保底
        window.setTimeout(resolve, 5000)
        img.src = urlInClosure
      }
    ))
  }
  await Promise.all(promises)

  for (let content of richContent) {
    if (content.type === constants.CONTENT_TYPE_IMAGE) {
      let size = urlSizeMap.get(content.url)
      content.width = size.width
      content.height = size.height
    }
  }
}
function getPronunciation(text: string) {
  if (pronunciationConverter === null) {
    return ''
  }
  return pronunciationConverter.getPronunciation(text)
}
function filterSuperChatMessage(data: SCInfo) {
  return filterByContent(data.message) && filterByAuthorName(data.uname)
}
function filterNewMemberMessage(data: GuardInfo) {
  return filterByAuthorName(data.user_info.uname)
}
function filterByContent(content: string) {
  for (let i = 0; i < content.length; i++) {
    let remainContent = content.substring(i)
    if (blockKeywordsTrie.value.lazyMatch(remainContent) !== null) {
      return false
    }
  }
  return true
}
function filterByAuthorName(id: string) {
  return Object.keys(accountInfo.value.biliBlackList).indexOf(id) === -1
}
function filterTextMessage(data: DanmakuInfo) {
  if (config.value.blockLevel > 0 && data.guard_level < config.value.blockLevel) {
    return false
  } else if (config.value.blockMedalLevel > 0 && data.fans_medal_level < config.value.blockMedalLevel) {
    return false
  }
  return filterByContent(data.msg) && filterByAuthorName(data.uname)
}
function mergeSimilarText(content: string) {
  if (!config.value.mergeSimilarDanmaku) {
    return false
  }
  return messageRender.value.mergeSimilarText(content)
}
function mergeSimilarGift(authorName: string, price: number, freePrice: number, giftName: string, num: number) {
  if (!config.value.mergeGift) {
    return false
  }
  return messageRender.value.mergeSimilarGift(authorName, price, freePrice, giftName, num)
}

function onReceiveConfig(data: DanmujiConfig) {
  config.value = data
}

onMounted(async () => {
  client.on('danmaku', onAddText)
  client.on('gift', onAddGift)
  client.on('sc', onAddSuperChat)
  //client.onEvent('delsc', onSuperChatDel)
  client.on('guard', onAddMember)

  rtc?.on('danmuji.config', onReceiveConfig)

  QueryGetAPI<{ keyword: string, url: string }[]>(VTSURU_API_URL + 'blivechat/emoticon').then((data) => {
    if (data.code === 200) {
      textEmoticons = data.data
    }
  })
  return
  while (true) {
    const result = await DownloadConfig('OBS.Danmuji')
    if (result.msg === undefined) {
      config.value = result.data as DanmujiConfig
      break
    }
    else {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
})
onUnmounted(() => {
  client.off('danmaku', onAddText)
  client.off('gift', onAddGift)
  client.off('sc', onAddSuperChat)
  //client.offEvent('delsc', onSuperChatDel)
  client.off('guard', onAddMember)

  rtc?.off('danmuji.config', onReceiveConfig)
})
</script>

<template>
  <MessageRender ref="messageRender" :customCss="customCss" :showGiftName="config.showGiftName" style="height: 100%; width: 100%"/>
</template>