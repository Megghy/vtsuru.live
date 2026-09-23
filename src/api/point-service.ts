import { unwrapOk, QueryGetAPI, QueryPostAPI } from '@/api/query'
import { ServiceFieldType, type ResponsePointOrder2OwnerModel, type ResponsePointOrder2UserModel, type ServiceConfig, type ServiceField, type ServiceOrderData } from './api-models'
import { POINT_API_URL } from '@/shared/config'

export type ServiceOrder = ResponsePointOrder2OwnerModel | ResponsePointOrder2UserModel
export type { ServiceConfig, ServiceField, ServiceOrderData }
export { ServiceFieldType }
export type OwnerServiceOrderUpdate = { orderId: number; status?: number; reason?: string; appointmentAt?: number; deliveryUrl?: string; message?: string }
export type UserServiceOrderUpdate = { orderId: number; cancel?: boolean; reason?: string; message?: string }

export async function fetchOwnerServiceOrder(id: number) {
  return unwrapOk(await QueryGetAPI<ResponsePointOrder2OwnerModel>(`${POINT_API_URL}service-order/owner`, { id }), '获取服务订单失败')
}
export async function fetchUserServiceOrder(id: number) {
  return unwrapOk(await QueryGetAPI<ResponsePointOrder2UserModel>(`${POINT_API_URL}service-order/user`, { id }), '获取服务订单失败')
}
export async function updateOwnerServiceOrder(body: OwnerServiceOrderUpdate) {
  return unwrapOk(await QueryPostAPI<ResponsePointOrder2OwnerModel>(`${POINT_API_URL}service-order/owner/update`, body), '更新服务订单失败')
}
export async function updateUserServiceOrder(body: UserServiceOrderUpdate) {
  return unwrapOk(await QueryPostAPI<ResponsePointOrder2UserModel>(`${POINT_API_URL}service-order/user/update`, body), '更新服务订单失败')
}
