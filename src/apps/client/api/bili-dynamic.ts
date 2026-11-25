import { biliGetJson, biliPostJson, biliPostMultipartJson, getMainBiliAuth } from './bili-auth-http'

export interface UploadedDynamicImage {
  image_url: string
  image_width: number
  image_height: number
  img_size: number
}

export interface MyBiliDynamicItem {
  idStr: string
  type: string
  pubTs: number
  pubTimeText: string
  text: string
  isTop: boolean
  images: string[]
}

/**
 * 上传单张图片至 B 站动态图床（BFS）
 */
export async function uploadBiliDynamicImage(blob: Blob, filename = 'image.png'): Promise<UploadedDynamicImage> {
  const auth = await getMainBiliAuth()
  const form = new FormData()
  form.append('file_up', blob, filename)
  form.append('biz', 'new_dyn')
  form.append('category', 'daily')
  form.append('csrf', auth.csrf)

  const data = await biliPostMultipartJson<{
    image_url?: string
    image_width?: number
    image_height?: number
    img_size?: number
  }>('https://api.bilibili.com/x/dynamic/feed/draw/upload_bfs', form, {
    auth,
    referer: 'https://t.bilibili.com/',
    origin: 'https://t.bilibili.com',
  })

  if (!data?.image_url) {
    throw new Error('上传图片成功但未返回图片地址')
  }

  return {
    image_url: data.image_url,
    image_width: Number(data.image_width ?? 0),
    image_height: Number(data.image_height ?? 0),
    img_size: Number(data.img_size ?? Math.round(blob.size / 1024)),
  }
}

/**
 * 发布 B 站文字或图文动态（最多 9 张图）
 * @returns 新发布的动态 ID 字符串
 */
export async function publishBiliDynamic(
  text: string,
  images: UploadedDynamicImage[] = [],
  options?: { reserveId?: number },
): Promise<string> {
  const trimmed = text.trim()
  if (!trimmed && images.length === 0) {
    throw new Error('动态正文与图片不能同时为空')
  }
  const auth = await getMainBiliAuth()
  const hasImages = images.length > 0

  const dynReq: Record<string, unknown> = {
    content: {
      contents: [
        {
          raw_text: trimmed,
          type: 1,
          biz_id: '',
        },
      ],
    },
    scene: hasImages ? 2 : 1,
    meta: {
      app_meta: {
        from: 'create.dynamic.web',
        mobi_app: 'web',
      },
    },
  }

  if (hasImages) {
    dynReq.pics = images.slice(0, 9).map((img) => ({
      img_src: img.image_url,
      img_width: img.image_width,
      img_height: img.image_height,
      img_size: img.img_size,
    }))
  }

  if (options?.reserveId && options.reserveId > 0) {
    dynReq.attach_card = {
      type: 1,
      biz_id: options.reserveId,
      reserve_source: 0,
      reserve_lottery: 0,
    }
  }

  const data = await biliPostJson<{ dyn_id_str?: string; dyn_id?: string | number }>(
    'https://api.bilibili.com/x/dynamic/feed/create/dyn',
    { dyn_req: dynReq },
    {
      auth,
      referer: 'https://t.bilibili.com/',
      origin: 'https://t.bilibili.com',
    },
  )

  const idStr = String(data?.dyn_id_str ?? data?.dyn_id ?? '')
  if (!idStr) {
    throw new Error('动态发布成功但未返回动态 ID')
  }
  return idStr
}

/**
 * 批量上传图片并发布图文动态的快捷封装
 */
export async function publishBiliDynamicWithBlobs(
  text: string,
  blobs: Array<{ blob: Blob; filename?: string }>,
  onProgress?: (uploaded: number, total: number) => void,
): Promise<string> {
  const uploaded: UploadedDynamicImage[] = []
  const targets = blobs.slice(0, 9)
  for (let i = 0; i < targets.length; i++) {
    const item = targets[i]
    const img = await uploadBiliDynamicImage(item.blob, item.filename ?? `image_${i + 1}.png`)
    uploaded.push(img)
    onProgress?.(i + 1, targets.length)
  }
  return publishBiliDynamic(text, uploaded)
}

/**
 * 删除自己发布的动态
 */
export async function deleteBiliDynamic(dynIdStr: string): Promise<void> {
  if (!dynIdStr) throw new Error('无效的动态 ID')
  const auth = await getMainBiliAuth()
  await biliPostJson(
    'https://api.bilibili.com/x/dynamic/feed/operate/remove',
    {
      dyn_id_str: dynIdStr,
      dyn_type: 1,
      rid_str: dynIdStr,
    },
    {
      auth,
      query: { platform: 'web' },
      referer: `https://space.bilibili.com/${auth.uid}/dynamic`,
      origin: 'https://space.bilibili.com',
    },
  )
}

/**
 * 置顶指定动态
 */
export async function setTopBiliDynamic(dynIdStr: string): Promise<void> {
  if (!dynIdStr) throw new Error('无效的动态 ID')
  const auth = await getMainBiliAuth()
  await biliPostJson(
    'https://api.bilibili.com/x/dynamic/feed/space/set_top',
    {
      dyn_str: dynIdStr,
    },
    {
      auth,
      referer: `https://space.bilibili.com/${auth.uid}/dynamic`,
      origin: 'https://space.bilibili.com',
    },
  )
}

/**
 * 取消置顶指定动态
 */
export async function removeTopBiliDynamic(dynIdStr: string): Promise<void> {
  if (!dynIdStr) throw new Error('无效的动态 ID')
  const auth = await getMainBiliAuth()
  await biliPostJson(
    'https://api.bilibili.com/x/dynamic/feed/space/rm_top',
    {
      dyn_str: dynIdStr,
    },
    {
      auth,
      referer: `https://space.bilibili.com/${auth.uid}/dynamic`,
      origin: 'https://space.bilibili.com',
    },
  )
}

/**
 * 获取主账号近期空间动态列表（供置顶/删除管理）
 */
export async function fetchMyRecentDynamics(): Promise<MyBiliDynamicItem[]> {
  const auth = await getMainBiliAuth()
  const data = await biliGetJson<{
    items?: Array<Record<string, any>>
  }>('https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space', {
    auth,
    useWbi: true,
    query: { host_mid: auth.uid, timezone_offset: -480 },
    referer: `https://space.bilibili.com/${auth.uid}/dynamic`,
    origin: 'https://space.bilibili.com',
  })

  const items = Array.isArray(data?.items) ? data.items : []
  return items.map((item) => {
    const author = item.modules?.module_author ?? {}
    const dyn = item.modules?.module_dynamic ?? {}
    const tagText = item.modules?.module_tag?.text ?? ''
    const major = dyn.major ?? {}
    const text =
      dyn.desc?.text ||
      major.opus?.summary?.text ||
      major.archive?.title ||
      major.live_rcmd?.content ||
      ''
    const pics: string[] = []
    if (Array.isArray(major.draw?.items)) {
      for (const p of major.draw.items) {
        if (p?.src) pics.push(String(p.src).replace(/^http:\/\//, 'https://'))
      }
    } else if (Array.isArray(major.opus?.pics)) {
      for (const p of major.opus.pics) {
        if (p?.url) pics.push(String(p.url).replace(/^http:\/\//, 'https://'))
      }
    }

    return {
      idStr: String(item.id_str ?? ''),
      type: String(item.type ?? ''),
      pubTs: Number(author.pub_ts ?? 0),
      pubTimeText: String(author.pub_time ?? ''),
      text: String(text),
      isTop: String(tagText).includes('置顶'),
      images: pics,
    }
  })
}
