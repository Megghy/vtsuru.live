import { ResponsePointGoodModel } from "@/api/api-models";
import { QueryGetAPI } from "@/api/query";
import { POINT_API_URL } from "@/data/constants";
import { MessageApiInjection } from "naive-ui/es/message/src/MessageProvider";
import { defineStore } from "pinia";
import { useAuthStore } from "./useAuthStore";

export const usePointStore = defineStore('point', () => {
  const useAuth = useAuthStore()

  async function GetSpecificPoint(id: number) {
    try {
      const data = await useAuth.QueryBiliAuthGetAPI<number>(POINT_API_URL + 'user/get-point', { id: id })
      if (data.code == 200) {
        return data.data
      } else {
        console.error('[point] 无法获取在指定直播间拥有的积分: ' + data.message)
      }
    } catch (err) {
      console.error('[point] 无法获取在指定直播间拥有的积分: ' + err)
    }
    return null
  }
  async function GetGoods(id: number | undefined = undefined, message?: MessageApiInjection) {
    if (!id) {
      return []
    }
    try {
      const resp = await QueryGetAPI<ResponsePointGoodModel[]>(POINT_API_URL + 'get-goods', {
        id: id,
      })
      if (resp.code == 200) {
        return resp.data
      } else {
        message?.error('无法获取数据: ' + resp.message)
        console.error('无法获取数据: ' + resp.message)
      }
    } catch (err) {
      message?.error('无法获取数据: ' + err)
      console.error('无法获取数据: ' + err)
    }
    return []
  }

  return {
    GetSpecificPoint,
    GetGoods
  }
})