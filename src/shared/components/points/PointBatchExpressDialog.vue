<script setup lang="ts">
import ArrowDownload24Regular from '@vicons/fluent/es/ArrowDownload24Regular'
import { format } from 'date-fns'
import { saveAs } from 'file-saver'
import { Upload } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import type { ResponsePointOrder2OwnerModel } from '@/api/generated/model'
import { GoodsTypes, PointOrderStatus } from '@/api/generated/model'
import { postApiPointBatchUpdateExpress } from '@/api/generated/point/point'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Textarea } from '@/shared/ui/textarea'
import { objectsToCSV, toast } from '@/shared/utils'

interface ParsedExpressRow {
  lineNo: number
  orderId: number | null
  expressCompany: string
  trackingNumber: string
  matchedOrder?: ResponsePointOrder2OwnerModel
  error?: string
}

const props = defineProps<{
  orders: ResponsePointOrder2OwnerModel[]
  defaultExpressCompany?: string
}>()

const emit = defineEmits<{
  updated: [
    updatedIds: number[],
    updates: Record<number, { expressCompany: string; trackingNumber: string }>,
    markShipped: boolean,
  ]
}>()

const open = defineModel<boolean>('open', { required: true })

const rawInput = ref('')
const markShipped = ref(true)
const isSubmitting = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) {
      rawInput.value = ''
      markShipped.value = true
    }
  },
)

const pendingPhysicalOrders = computed(() =>
  props.orders.filter(
    (o) =>
      o.type === GoodsTypes.Physical &&
      !o.trackingNumber &&
      o.status !== PointOrderStatus.Cancelled &&
      o.status !== PointOrderStatus.Rejected &&
      o.status !== PointOrderStatus.Completed,
  ),
)

const orderMap = computed(() => new Map(props.orders.map((o) => [Number(o.id), o])))

function parseLineCells(line: string): string[] {
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

const parsedRows = computed<ParsedExpressRow[]>(() => {
  const lines = rawInput.value
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (!lines.length) return []

  const firstCells = parseLineCells(lines[0]).map((c) => c.toLowerCase())
  let orderCol = 0
  let companyCol = 1
  let trackingCol = 2
  let startIndex = 0

  const hasHeader =
    firstCells.some((c) => c.includes('订单') || c === 'orderid' || c === 'id') ||
    firstCells.some((c) => c.includes('单号') || c.includes('快递'))

  if (hasHeader) {
    startIndex = 1
    const foundOrder = firstCells.findIndex((c) => c.includes('订单') || c === 'orderid' || c === 'id')
    const foundCompany = firstCells.findIndex(
      (c) => c.includes('快递公司') || c.includes('物流公司') || c.includes('公司'),
    )
    const foundTracking = firstCells.findIndex((c) => c.includes('单号') || c.includes('tracking'))
    if (foundOrder >= 0) orderCol = foundOrder
    if (foundCompany >= 0) companyCol = foundCompany
    if (foundTracking >= 0) trackingCol = foundTracking
    else if (firstCells.length >= 3) trackingCol = firstCells.length - 1
  }

  const fallbackCompany = props.defaultExpressCompany?.trim() || '顺丰'
  const rows: ParsedExpressRow[] = []

  for (let i = startIndex; i < lines.length; i++) {
    const cells = parseLineCells(lines[i])
    const rawId = (cells[orderCol] ?? '').replace(/^#/, '').trim()
    const orderId = /^\d+$/.test(rawId) ? Number(rawId) : null

    let expressCompany = ''
    let trackingNumber = ''

    if (!hasHeader && cells.length === 2) {
      expressCompany = fallbackCompany
      trackingNumber = cells[1] ?? ''
    } else {
      expressCompany = (cells[companyCol] ?? '') || fallbackCompany
      trackingNumber = cells[trackingCol] ?? ''
    }

    const matchedOrder = orderId != null ? orderMap.value.get(orderId) : undefined
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
})

const validRows = computed(() => parsedRows.value.filter((r) => !r.error && r.orderId != null))

function exportPendingTemplate() {
  if (!pendingPhysicalOrders.value.length) {
    toast.warning('当前没有待填写单号的实体订单')
    return
  }

  const csv = objectsToCSV(
    pendingPhysicalOrders.value.map((o) => ({
      订单号: o.id,
      用户名: o.customer.name || '',
      礼物: o.goods?.name || '',
      收件人: o.address?.name || '',
      联系电话: o.address?.phone || '',
      收货地址: o.address
        ? `${o.address.province}${o.address.city}${o.address.district}${o.address.street}${o.address.address}`
        : '',
      快递公司: o.expressCompany || props.defaultExpressCompany || '顺丰',
      快递单号: '',
    })),
  )

  const BOM = new Uint8Array([0xef, 0xbb, 0xbf])
  saveAs(
    new Blob([BOM, new TextEncoder().encode(csv)], { type: 'text/csv;charset=utf-8;' }),
    `待填单号订单模板_${format(Date.now(), 'yyyy-MM-dd_HHmm')}.csv`,
  )
  toast.success(`已导出 ${pendingPhysicalOrders.value.length} 笔待填单号订单模板`)
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    rawInput.value = await file.text()
  } catch (err) {
    toast.error(`读取文件失败: ${err}`)
  } finally {
    input.value = ''
  }
}

async function submitImport() {
  if (!validRows.value.length) {
    toast.warning('没有可导入的有效单号行')
    return
  }

  isSubmitting.value = true
  try {
    const items = validRows.value.map((r) => ({
      orderId: r.orderId!,
      expressCompany: r.expressCompany,
      trackingNumber: r.trackingNumber,
    }))
    const res = await postApiPointBatchUpdateExpress({
      items,
      markShipped: markShipped.value,
    })

    if (res.code !== 200 || !res.data) {
      toast.error(res.message || '批量导入单号失败')
      return
    }

    const { updatedCount, updatedOrderIds, errors } = res.data
    const updates: Record<number, { expressCompany: string; trackingNumber: string }> = {}
    for (const item of items) {
      if (updatedOrderIds.includes(item.orderId)) {
        updates[item.orderId] = {
          expressCompany: item.expressCompany,
          trackingNumber: item.trackingNumber,
        }
      }
    }

    emit('updated', updatedOrderIds, updates, markShipped.value)

    if (errors?.length) {
      toast.warning(`已更新 ${updatedCount} 笔订单，${errors.length} 笔跳过: ${errors[0]}`)
    } else {
      toast.success(`已成功回填 ${updatedCount} 笔订单的快递单号`)
    }
    open.value = false
  } catch (err) {
    toast.error(`导入失败: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-3xl max-h-[88vh] flex flex-col p-0 overflow-hidden">
      <DialogHeader class="px-5 py-3.5 border-b border-border/70">
        <DialogTitle class="text-sm font-semibold">批量导入快递单号</DialogTitle>
      </DialogHeader>

      <div class="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4 text-xs scrollbar-thin">
        <div class="p-3 rounded-lg border border-border/70 bg-muted/20 flex-between flex-wrap gap-2">
          <div class="space-y-0.5">
            <div class="font-medium text-foreground">
              当前有
              <span class="font-mono text-primary font-semibold">{{ pendingPhysicalOrders.length }}</span>
              笔待填单号实体订单
            </div>
            <div class="text-[11px] text-muted-foreground">
              支持导出模板填入单号后上传 CSV，或直接从 Excel 复制「订单号、快递公司、快递单号」三列粘贴。
            </div>
          </div>

          <div class="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="xs"
              class="gap-1"
              @click="exportPendingTemplate"
            >
              <ArrowDownload24Regular class="size-3.5" />
              导出待填单模板
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xs"
              class="gap-1"
              @click="fileInputRef?.click()"
            >
              <Upload class="size-3.5" />
              上传 CSV 文件
            </Button>
            <input
              ref="fileInputRef"
              type="file"
              accept=".csv,.tsv,.txt"
              class="hidden"
              @change="onFileSelected"
            />
          </div>
        </div>

        <div class="space-y-1.5">
          <div class="flex-between">
            <label class="font-medium text-foreground">粘贴表格内容或 CSV 文本</label>
            <span class="text-[11px] text-muted-foreground">示例: 1024,顺丰,SF1234567890</span>
          </div>
          <Textarea
            v-model="rawInput"
            :rows="5"
            placeholder="订单号,快递公司,快递单号&#10;1024,顺丰,SF1234567890"
            class="font-mono text-xs"
          />
        </div>

        <div
          v-if="parsedRows.length > 0"
          class="space-y-2"
        >
          <div class="flex-between">
            <span class="font-medium text-foreground">解析预览</span>
            <span class="text-[11px] text-muted-foreground">
              有效 <strong class="text-emerald-600 font-mono">{{ validRows.length }}</strong> / 共
              <strong class="font-mono">{{ parsedRows.length }}</strong> 行
            </span>
          </div>

          <div class="max-h-56 overflow-y-auto rounded-lg border border-border/70 scrollbar-thin">
            <table class="w-full text-left border-collapse text-[11px]">
              <thead class="bg-muted/40 sticky top-0 text-muted-foreground">
                <tr>
                  <th class="py-1.5 px-2.5 font-medium">订单号</th>
                  <th class="py-1.5 px-2.5 font-medium">买家 / 礼物</th>
                  <th class="py-1.5 px-2.5 font-medium">快递公司</th>
                  <th class="py-1.5 px-2.5 font-medium">快递单号</th>
                  <th class="py-1.5 px-2.5 font-medium text-right">校验</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border/50">
                <tr
                  v-for="row in parsedRows"
                  :key="`${row.lineNo}-${row.orderId}`"
                  :class="row.error ? 'bg-destructive/5' : ''"
                >
                  <td class="py-1.5 px-2.5 font-mono">#{{ row.orderId ?? '-' }}</td>
                  <td class="py-1.5 px-2.5 truncate max-w-[180px]">
                    {{
                      row.matchedOrder
                        ? `${row.matchedOrder.customer.name || '未知'} · ${row.matchedOrder.goods?.name || ''}`
                        : '-'
                    }}
                  </td>
                  <td class="py-1.5 px-2.5">{{ row.expressCompany }}</td>
                  <td class="py-1.5 px-2.5 font-mono">{{ row.trackingNumber || '-' }}</td>
                  <td class="py-1.5 px-2.5 text-right">
                    <Badge
                      :variant="row.error ? 'destructive' : 'success'"
                      size="xs"
                    >
                      {{ row.error || '就绪' }}
                    </Badge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <label class="flex items-center gap-2 cursor-pointer select-none">
          <Checkbox
            :checked="markShipped"
            @update:checked="markShipped = Boolean($event)"
          />
          <span class="text-foreground">导入单号后自动将「待处理」实体订单状态变更为「已发货」</span>
        </label>
      </div>

      <DialogFooter class="px-5 py-3 border-t bg-muted/20">
        <Button
          type="button"
          variant="ghost"
          @click="open = false"
        >
          取消
        </Button>
        <Button
          type="button"
          :loading="isSubmitting"
          :disabled="validRows.length === 0"
          @click="submitImport"
        >
          导入并更新 ({{ validRows.length }})
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
