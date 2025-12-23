import type { APIRoot, PointOrderStatus, ResponsePointOrder2OwnerModel } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { ORG_API_URL, POINT_API_URL } from '@/data/constants'

export type PointOrderScope =
  | { kind: 'owner' }
  | { kind: 'org', orgId: number, streamerId?: number, customer?: number }

function unwrapOk<T>(resp: APIRoot<T>, failMessage: string): T {
  if (resp.code !== 200) throw new Error(resp.message || failMessage)
  return resp.data
}

export async function fetchOwnerOrders(scope: PointOrderScope): Promise<ResponsePointOrder2OwnerModel[]> {
  if (scope.kind === 'owner') {
    return unwrapOk(
      await QueryGetAPI<ResponsePointOrder2OwnerModel[]>(`${POINT_API_URL}get-orders`),
      '获取订单失败',
    )
  }

  return unwrapOk(
    await QueryGetAPI<ResponsePointOrder2OwnerModel[]>(
      `${ORG_API_URL}${scope.orgId}/points/orders`,
      {
        ...(scope.streamerId ? { streamerId: scope.streamerId } : {}),
        ...(scope.customer ? { customerId: scope.customer } : {}),
      },
    ),
    '获取订单失败',
  )
}

export async function updateOrdersStatus(scope: PointOrderScope, ids: number[], status: PointOrderStatus): Promise<void> {
  if (!ids.length) return

  if (scope.kind === 'owner') {
    unwrapOk(
      await QueryPostAPI<number[]>(`${POINT_API_URL}batch-update-order-status`, { orderIds: ids, status }),
      '更新订单状态失败',
    )
    return
  }

  unwrapOk(
    await QueryPostAPI<number>(`${ORG_API_URL}${scope.orgId}/points/orders/status`, { orderIds: ids, status }),
    '更新订单状态失败',
  )
}

export async function updateOrderExpress(
  scope: PointOrderScope,
  orderId: number,
  trackingNumber: string,
  expressCompany?: string,
): Promise<void> {
  const tn = trackingNumber.trim()
  if (!tn) throw new Error('请填写快递单号')

  if (scope.kind === 'owner') {
    unwrapOk(
      await QueryPostAPI<void>(`${POINT_API_URL}update-order-express`, {
        id: orderId,
        trackingNumber: tn,
        expressCompany: (expressCompany ?? '').trim(),
      }),
      '更新快递信息失败',
    )
    return
  }

  unwrapOk(
    await QueryPostAPI<number>(`${ORG_API_URL}${scope.orgId}/points/orders/express`, {
      orderId,
      trackingNumber: tn,
      expressCompany: expressCompany?.trim() || undefined,
    }),
    '更新快递信息失败',
  )
}
