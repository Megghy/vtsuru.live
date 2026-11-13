<script setup lang="ts">
import ArrowDownload24Regular from '@vicons/fluent/es/ArrowDownload24Regular'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import type { ResponsePointOrder2UserModel } from '@/api/generated/model'
import { GoodsTypes } from '@/api/generated/model'
import { getApiPointUserOrderAttachment } from '@/api/generated/point/point'
import { toast } from '@/shared/utils'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { ScrollArea } from '@/shared/ui/scroll-area'

defineProps<{ orders: ResponsePointOrder2UserModel[] }>()
const show = defineModel<boolean>('show', { required: true })
const router = useRouter()
const downloadingId = ref<number | null>(null)

async function downloadAttachment(orderId: number, fileId: number) {
  downloadingId.value = fileId
  try {
    const res = await getApiPointUserOrderAttachment({ orderId, fileId })
    if (res.code === 200 && res.data) {
      window.open(res.data, '_blank', 'noopener,noreferrer')
    } else {
      toast.error(res.message || '获取下载链接失败')
    }
  } catch {
    toast.error('获取下载链接失败')
  } finally {
    downloadingId.value = null
  }
}
</script>

<template>
  <Dialog v-model:open="show">
    <DialogContent class="sm:max-w-md max-h-[80vh] flex flex-col p-4 gap-3">
      <DialogHeader class="pb-2 border-b border-border/60">
        <DialogTitle class="text-sm text-emerald-600">
          兑换成功！{{ orders.length > 1 ? `共 ${orders.length} 个订单` : '' }}
        </DialogTitle>
      </DialogHeader>

      <ScrollArea class="flex-1 min-h-0">
        <div class="space-y-2.5 text-xs">
          <div
            v-for="order in orders"
            :key="order.id"
            class="space-y-1.5 p-2.5 rounded-lg border border-border/60"
          >
            <div class="flex-between gap-2">
              <strong class="font-medium text-foreground truncate">{{ order.goods?.name }}</strong>
              <span class="text-muted-foreground font-mono shrink-0">#{{ order.id }}</span>
            </div>
            <p
              v-if="order.selectedSubItems?.length"
              class="text-muted-foreground"
            >
              {{ order.selectedSubItems.map((s) => `${s.nameSnapshot}×${s.quantity}`).join('、') }}
            </p>
            <Alert size="sm" v-if="order.type === GoodsTypes.Virtual && order.goods?.content" class="bg-muted/40 whitespace-pre-wrap break-words">
              <AlertDescription>{{ order.goods.content }}</AlertDescription>
            </Alert>
            <div
              v-if="order.type === GoodsTypes.Virtual && order.privateAttachments?.length"
              class="space-y-1 pt-1"
            >
              <div
                v-for="file in order.privateAttachments"
                :key="file.id"
                class="flex-between px-2 py-1.5 rounded border border-border bg-muted/30"
              >
                <span class="truncate pr-2">{{ file.name }}</span>
                <Button
                  size="xs"
                  variant="outline"
                  :loading="downloadingId === file.id"
                  @click="downloadAttachment(order.id, file.id)"
                >
                  <component :is="ArrowDownload24Regular" class="size-3.5 mr-1" />
                  下载
                </Button>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      <DialogFooter class="pt-2 border-t border-border/60">
        <Button
          variant="outline"
          @click="show = false"
        >
          关闭
        </Button>
        <Button @click="((show = false), router.push({ name: 'bili-user-orders' }))">查看我的订单</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
