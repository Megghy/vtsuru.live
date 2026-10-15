import type { PointOrderStatus } from '@/api/api-models'
import {
  getApiOrgOrgIdPointsOrders,
  postApiOrgOrgIdPointsOrdersExpress,
  postApiOrgOrgIdPointsOrdersStatus,
} from '@/api/generated/org/org'
import {
  getApiPointGetOrders,
  postApiPointBatchUpdateOrderStatus,
  postApiPointUpdateOrderExpress,
} from '@/api/generated/point/point'
import { unwrapOk } from '@/api/query'

export type PointOrderScope = { kind: 'owner' } | { kind: 'org'; orgId: number; streamerId?: number; customer?: number }

export async function fetchOwnerOrders(scope: PointOrderScope) {
  if (scope.kind === 'owner') {
    return unwrapOk(await getApiPointGetOrders(), '获取订单失败')
  }

  return unwrapOk(
    await getApiOrgOrgIdPointsOrders(scope.orgId, {
      ...(scope.streamerId ? { streamerId: scope.streamerId } : {}),
      ...(scope.customer ? { customerId: scope.customer } : {}),
    }),
    '获取订单失败',
  )
}

export async function updateOrdersStatus(
  scope: PointOrderScope,
  ids: number[],
  status: PointOrderStatus,
): Promise<void> {
  if (!ids.length) return

  if (scope.kind === 'owner') {
    unwrapOk(
      await postApiPointBatchUpdateOrderStatus({ orderIds: ids, status }),
      '更新订单状态失败',
    )
    return
  }

  unwrapOk(
    await postApiOrgOrgIdPointsOrdersStatus(scope.orgId, { orderIds: ids, status }),
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
      await postApiPointUpdateOrderExpress({
        id: orderId,
        trackingNumber: tn,
        expressCompany: (expressCompany ?? '').trim(),
      }),
      '更新快递信息失败',
    )
    return
  }

  unwrapOk(
    await postApiOrgOrgIdPointsOrdersExpress(scope.orgId, {
      orderId,
      trackingNumber: tn,
      expressCompany: expressCompany?.trim() || undefined,
    }),
    '更新快递信息失败',
  )
}
