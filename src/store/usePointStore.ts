import type { MessageApiInjection } from 'naive-ui/es/message/src/MessageProvider'
import type { ResponsePointGoodModel } from '@/api/api-models'
import { defineStore } from 'pinia'
import { QueryGetAPI } from '@/api/query'
import { POINT_API_URL } from '@/data/constants'
import { GuidUtils } from '@/Utils'
import { useBiliAuth } from './useBiliAuth'

export const usePointStore = defineStore('point', () => {
  const useAuth = useBiliAuth()

  async function GetSpecificPoint(id: number) {
    try {
      const data = await useAuth.QueryBiliAuthGetAPI<number>(`${POINT_API_URL}user/get-point`, { id })
      if (data.code == 200) {
        return data.data
      } else {
        console.error(`[point] 无法获取在指定直播间拥有的积分: ${data.message}`)
      }
    } catch (err) {
      console.error(`[point] 无法获取在指定直播间拥有的积分: ${err}`)
    }
    return null
  }
  async function GetGoods(id: number | undefined = undefined, message?: MessageApiInjection) {
    if (!id) {
      return []
    }
    try {
      const resp = await QueryGetAPI<ResponsePointGoodModel[]>(`${POINT_API_URL}get-goods`, {
        id,
      })
      if (resp.code == 200) {
        return resp.data
      } else {
        message?.error(`无法获取数据: ${resp.message}`)
        console.error(`无法获取数据: ${resp.message}`)
      }
    } catch (err) {
      message?.error(`无法获取数据: ${err}`)
      console.error(`无法获取数据: ${err}`)
    }
    return []
  }
  /**
   * 给用户添加或扣除积分
   * @param userId 用户ID
   * @param count 积分数量（正数为增加，负数为减少）
   * @param reason 积分变动原因
   * @param remark 备注信息
   * @returns 成功时返回修改后的积分值，失败时返回null
   */
  async function addPoints(userId: string, count: number, reason: string, remark?: string) {
    if (count === 0) {
      console.warn('[point] 积分变动数量不能为0')
      return null
    }

    try {
      // 根据用户ID构建参数
      const params: Record<string, any> = GuidUtils.isGuidFromUserId(userId)
        ? {
            uId: GuidUtils.guidToLong(userId),
            count,
            reason: reason || '',
          }
        : {
            oid: userId,
            count,
            reason: reason || '',
          }

      if (remark) {
        params.remark = remark
      }

      const data = await QueryGetAPI<number>(`${POINT_API_URL}give-point`, params)

      if (data.code === 200) {
        console.log(`[point] 用户 ${userId} 积分${count > 0 ? '增加' : '减少'} ${Math.abs(count)} 成功，当前积分：${data.data}`)
        return data.data // 返回修改后的积分值
      } else {
        console.error('[point] 积分操作失败:', data.message)
        return null
      }
    } catch (err) {
      console.error('[point] 积分操作出错:', err)
      return null
    }
  }

  return {
    GetSpecificPoint,
    GetGoods,
    addPoints,
  }
})
