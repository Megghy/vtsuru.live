import { GoodsTypes, type ResponsePointOrder2OwnerModel } from '@/api/generated/model'

export interface ParsedExpressRow {
  lineNo: number
  orderId: number | null
  expressCompany: string
  trackingNumber: string
  matchedOrder?: ResponsePointOrder2OwnerModel
  error?: string
}

export function parseExpressLineCells(line: string): string[] {
  if (line.includes('\t')) {
    return line.split('\t').map((s) => s.trim().replace(/^"|"$/g, ''))
  }
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

export function parseExpressCsvRows(
  rawInput: string,
  orderMap: Map<number, ResponsePointOrder2OwnerModel>,
  defaultExpressCompany?: string,
): ParsedExpressRow[] {
  const lines = rawInput
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (!lines.length) return []

  const firstCells = parseExpressLineCells(lines[0]).map((c) => c.toLowerCase())
  let orderCol = 0
  let companyCol = 1
  let trackingCol = 2
  let startIndex = 0

  const isOrderHeader = (c: string) => c.includes('订单') || c === 'orderid' || c === 'id'
  const isCompanyHeader = (c: string) =>
    c.includes('快递公司') || c.includes('物流公司') || c.includes('公司') || c === 'company' || c === 'express'
  const isTrackingHeader = (c: string) =>
    (c.includes('单号') && !c.includes('订单')) || c.includes('tracking') || c.includes('运单')

  const hasHeader = firstCells.some(isOrderHeader) || firstCells.some((c) => isTrackingHeader(c) || c.includes('快递'))

  if (hasHeader) {
    startIndex = 1
    const foundOrder = firstCells.findIndex(isOrderHeader)
    orderCol = foundOrder >= 0 ? foundOrder : 0

    // 先解析单号列与公司列，避免“订单号,快递单号”两列表头中默认 companyCol=1 抢占单号列
    trackingCol = firstCells.findIndex((c, idx) => idx !== orderCol && isTrackingHeader(c))
    companyCol = firstCells.findIndex((c, idx) => idx !== orderCol && idx !== trackingCol && isCompanyHeader(c))

    if (trackingCol < 0) {
      const remainingCols = firstCells
        .map((_, idx) => idx)
        .filter((idx) => idx !== orderCol && idx !== trackingCol && idx !== companyCol)
      if (companyCol < 0 && remainingCols.length >= 2) {
        companyCol = remainingCols[0]
        trackingCol = remainingCols[remainingCols.length - 1]
      } else if (remainingCols.length >= 1) {
        trackingCol = remainingCols[remainingCols.length - 1]
      }
    }
  }

  const fallbackCompany = defaultExpressCompany?.trim() || '顺丰'
  const rows: ParsedExpressRow[] = []

  for (let i = startIndex; i < lines.length; i++) {
    const cells = parseExpressLineCells(lines[i])
    const rawId = (cells[orderCol] ?? '').replace(/^#/, '').trim()
    const orderId = /^\d+$/.test(rawId) ? Number(rawId) : null

    let expressCompany = ''
    let trackingNumber = ''

    if (!hasHeader && cells.length === 2) {
      expressCompany = fallbackCompany
      trackingNumber = cells[1] ?? ''
    } else {
      expressCompany = (companyCol >= 0 ? cells[companyCol] : '') || fallbackCompany
      trackingNumber = trackingCol >= 0 ? (cells[trackingCol] ?? '') : ''
    }

    const matchedOrder = orderId != null ? orderMap.get(orderId) : undefined
    let error: string | undefined
    if (orderId == null) {
      error = '订单号格式无效'
    } else if (!matchedOrder) {
      error = '未找到此订单'
    } else if (matchedOrder.type === GoodsTypes.Service) {
      error = '服务订单不支持快递单号'
    } else if (!trackingNumber) {
      error = '缺少快递单号'
    }

    rows.push({
      lineNo: i + 1,
      orderId,
      expressCompany: expressCompany.slice(0, 20),
      trackingNumber: trackingNumber.slice(0, 100),
      matchedOrder,
      error,
    })
  }

  return rows
}
