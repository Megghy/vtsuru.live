import { biliPostFormJson } from './bili-auth-http'

/**
 * 在 B 站视频评论区发表一级评论（需要主播/UP主 Cookie）
 * @param aid 视频 AV 号（oid）
 * @param message 评论正文（最多 1000 字符）
 * @returns 新发表评论的 rpid
 */
export async function postBiliVideoComment(aid: number, message: string): Promise<{ rpid: number }> {
  if (!aid || aid <= 0) throw new Error('缺少有效的视频 AID')
  const trimmed = message.trim()
  if (!trimmed) throw new Error('评论内容不能为空')

  const data = await biliPostFormJson<{ rpid?: number; rpid_str?: string }>(
    'https://api.bilibili.com/x/v2/reply/add',
    {
      type: 1,
      oid: aid,
      message: trimmed.slice(0, 1000),
      plat: 1,
    },
    {
      referer: `https://www.bilibili.com/video/av${aid}`,
      origin: 'https://www.bilibili.com',
    },
  )

  return { rpid: Number(data?.rpid ?? data?.rpid_str ?? 0) }
}

/**
 * 置顶或取消置顶视频评论区的一级评论（仅 UP 主本人可用）
 */
export async function topBiliVideoComment(aid: number, rpid: number, action: 1 | 0 = 1): Promise<void> {
  if (!aid || aid <= 0 || !rpid || rpid <= 0) throw new Error('无效的视频 AID 或评论 ID')
  await biliPostFormJson(
    'https://api.bilibili.com/x/v2/reply/top',
    {
      type: 1,
      oid: aid,
      rpid,
      action,
    },
    {
      referer: `https://www.bilibili.com/video/av${aid}`,
      origin: 'https://www.bilibili.com',
    },
  )
}
