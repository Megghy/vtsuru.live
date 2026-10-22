<script setup lang="ts">
import { computed } from 'vue'

import { formatTime } from '@/apps/manage/composables/formatters'
import type { LotteryHistory } from '@/apps/open-live/components/lottery/lotteryTypes'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { ScrollArea } from '@/shared/ui/scroll-area'

const props = defineProps<{
  show: boolean
  history: LotteryHistory[]
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'clear'): void
  (e: 'remove', time: number): void
}>()

const showModel = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
})
</script>

<template>
  <Dialog v-model:open="showModel">
    <DialogContent class="max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col p-6">
      <DialogHeader class="flex flex-row items-center justify-between pb-2 border-b">
        <DialogTitle class="text-base font-semibold">抽奖结果</DialogTitle>
        <Button
          variant="destructive"
          class="mr-6"
          @click="emit('clear')"
        >
          清空
        </Button>
      </DialogHeader>

      <ScrollArea
        v-if="history.length > 0"
        class="max-h-[75vh] pr-4 mt-2"
      >
        <div class="flex flex-col gap-3">
          <Card
            v-for="item in history"
            :key="item.time"
            class="overflow-hidden"
          >
            <CardHeader class="py-2 px-3 border-b flex flex-row items-center justify-between bg-muted/30">
              <span class="text-xs text-muted-foreground font-mono">{{ formatTime(item.time) }}</span>
              <Button
                variant="ghost"
                class="text-destructive hover:bg-destructive/10"
                @click="emit('remove', item.time)"
              >
                删除
              </Button>
            </CardHeader>
            <CardContent class="p-3 flex flex-col gap-2">
              <div
                v-for="user in item.users"
                :key="user.openId"
                class="flex items-center gap-2.5 text-xs"
              >
                <Avatar class="size-6">
                  <AvatarImage :src="`${user.avatar}@64w_64h`" />
                  <AvatarFallback class="text-[10px]">{{ user.name.slice(0, 1) }}</AvatarFallback>
                </Avatar>
                <span class="font-medium">{{ user.name }}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
      <Empty
        v-else
        description="暂无记录"
        class="py-12"
      />
    </DialogContent>
  </Dialog>
</template>
