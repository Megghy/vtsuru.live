import type { ServiceConfigData, ServiceField, ServiceOrderData } from '@/api/generated/model'
import { ServiceFieldType } from '@/api/generated/model'
import {
  getApiPointServiceOrderOwner,
  getApiPointServiceOrderUser,
  postApiPointServiceOrderOwnerUpdate,
  postApiPointServiceOrderUserUpdate,
} from '@/api/generated/point/point'
import { unwrapOk } from '@/api/query'

export type { ServiceConfigData, ServiceField, ServiceOrderData }
export { ServiceFieldType }
export type OwnerServiceOrderUpdate = {
  orderId: number
  status?: number
  reason?: string
  appointmentAt?: number
  deliveryUrl?: string
  message?: string
}
export type UserServiceOrderUpdate = { orderId: number; cancel?: boolean; reason?: string; message?: string }

export async function fetchOwnerServiceOrder(id: number) {
  return unwrapOk(await getApiPointServiceOrderOwner({ id }), '获取服务订单失败')
}
export async function fetchUserServiceOrder(id: number) {
  return unwrapOk(await getApiPointServiceOrderUser({ id }), '获取服务订单失败')
}
export async function updateOwnerServiceOrder(body: OwnerServiceOrderUpdate) {
  return unwrapOk(await postApiPointServiceOrderOwnerUpdate(body as never), '更新服务订单失败')
}
export async function updateUserServiceOrder(body: UserServiceOrderUpdate) {
  return unwrapOk(await postApiPointServiceOrderUserUpdate({ cancel: false, ...body } as never), '更新服务订单失败')
}
