<script setup lang="ts">
import { useRouter } from 'vue-router'

import type { ResponsePointOrder2UserModel } from '@/api/generated/model'
import { GoodsTypes } from '@/api/generated/model'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { ScrollArea } from '@/shared/ui/scroll-area'

defineProps<{ orders: ResponsePointOrder2UserModel[] }>()
const show = defineModel<boolean>('show', { required: true })
const router = useRouter()
</script>

<template>
  <Dialog v-model:open="show">
    <DialogContent class="sm:max-w-md max-h-[80vh] flex flex-col p-4 gap-3">
      <DialogHeader class="pb-2 border-b border-border/60">
        <DialogTitle class="text-sm font-semibold text-emerald-600">
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
            <div class="flex items-center justify-between gap-2">
              <strong class="font-medium text-foreground truncate">{{ order.goods?.name }}</strong>
              <span class="text-muted-foreground font-mono shrink-0">#{{ order.id }}</span>
            </div>
            <p
              v-if="order.selectedSubItems?.length"
              class="text-muted-foreground"
            >
              {{ order.selectedSubItems.map((s) => `${s.nameSnapshot}×${s.quantity}`).join('、') }}
            </p>
            <Alert
              v-if="order.type === GoodsTypes.Virtual && order.goods?.content"
              class="text-xs bg-muted/40 whitespace-pre-wrap break-words"
            >
              <AlertDescription class="text-xs">{{ order.goods.content }}</AlertDescription>
            </Alert>
          </div>
        </div>
      </ScrollArea>

      <DialogFooter class="pt-2 border-t border-border/60 flex items-center justify-end gap-2">
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
