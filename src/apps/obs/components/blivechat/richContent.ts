import type { EventModel } from '@/api/api-models'
import * as constants from './constants'

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
export async function getRichContent(data: EventModel, emoticonsTrie: { lazyMatch(text: string): { keyword: string; url: string } | null }): Promise<RichContentType[]> {
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

  // 可能含有文本表情，需要解析
  let startPos = 0
  let pos = 0
  while (pos < data.msg.length) {
    const remainContent = data.msg.substring(pos)
    const matchEmoticon = emoticonsTrie.lazyMatch(remainContent)
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

