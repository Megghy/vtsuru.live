import type { ResponsePointHisrotyModel } from '@/api/api-models'
import { QueryGetAPI, unwrapOk } from '@/api/query'
import { POINT_API_URL } from '@/shared/config'

/** ouid 即后端 OUId（见 GuidUtils.toOuid）；有 uid 时按 uid 给分，后端可借此关联已认证用户 */
export interface PointUserRef {
  uid: number
  ouid: string
}

/** 按时间倒序；积分为各条 point 之和 */
export async function getUserPointHistories(user: PointUserRef) {
  return unwrapOk(
    await QueryGetAPI<ResponsePointHisrotyModel[]>(`${POINT_API_URL}get-user-histories`, { id: user.ouid }),
    '获取积分记录失败',
  )
}

/** count 可为负；返回操作后的总积分 */
export async function giveUserPoint(user: PointUserRef, count: number, reason: string) {
  return unwrapOk(
    await QueryGetAPI<{ totalPoint: number }>(`${POINT_API_URL}give-point`, {
      ...(user.uid > 0 ? { uId: user.uid } : { oId: user.ouid }),
      count,
      reason,
    }),
    '修改积分失败',
  )
}
