import type { CloudEventModel } from '@/api/live'
import { GuidUtils } from '@/shared/utils'

import type { DashboardEvent } from './types'
import { GUARD_NAMES } from './types'

/** 同一事件本地与云端时间戳来源不同，允许的误差 */
const MATCH_WINDOW_MS = 10_000

function guardLevelOf(msg: string) {
  const entry = Object.entries(GUARD_NAMES).find(([, name]) => msg.includes(name))
  return entry ? Number(entry[0]) : 0
}

/** 后端只保存 SC 与大航海，且不含勋章等展示字段 */
export function cloudToEvent(model: CloudEventModel): DashboardEvent {
  const uid = model.uid ?? 0
  return {
    key: `cloud:${model.id}`,
    type: model.type,
    time: model.time < 1e12 ? model.time * 1000 : model.time,
    uid,
    ouid: GuidUtils.toOuid(uid, model.open_id),
    uname: model.uname,
    uface: model.uface ?? '',
    msg: model.msg ?? '',
    price: Math.max(0, model.price ?? 0),
    num: model.num ?? 1,
    guardLevel: guardLevelOf(model.msg ?? ''),
    medalLevel: 0,
    medalName: '',
    medalWearing: false,
    read: false,
    deleted: false,
  }
}

/**
 * 实时事件的 key 由原始报文哈希得到，与云端主键无关；
 * 按类型 + 用户名 + 金额 + 时间窗口判定为同一事件，返回本地缺失的云端事件
 */
export function missingCloudEvents(local: readonly DashboardEvent[], cloud: readonly DashboardEvent[]) {
  const buckets = new Map<string, number[]>()
  const bucketOf = (e: DashboardEvent) => `${e.type}:${e.uname}:${Math.round(e.price * 100)}`
  for (const event of local) {
    const key = bucketOf(event)
    const times = buckets.get(key) ?? []
    times.push(event.time)
    buckets.set(key, times)
  }
  return cloud.filter((event) => !buckets.get(bucketOf(event))?.some((t) => Math.abs(t - event.time) <= MATCH_WINDOW_MS))
}
