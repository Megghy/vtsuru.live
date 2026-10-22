<script setup lang="ts">
import { Dismiss20Filled } from '@vicons/fluent'
import { ref } from 'vue'

import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { useSpeechService } from '@/store/useSpeechService'

import QueueItem from './QueueItem.vue'

const speechService = useSpeechService()
const { speakQueue } = speechService

const dragIndex = ref<number | null>(null)
const dropIndex = ref<number | null>(null)

function onDragStart(index: number) {
  dragIndex.value = index
}

function onDragOver(e: DragEvent, index: number) {
  e.preventDefault()
  dropIndex.value = index
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  if (dragIndex.value !== null && dropIndex.value !== null) {
    speechService.moveQueueItem(dragIndex.value, dropIndex.value)
  }
  dragIndex.value = null
  dropIndex.value = null
}

function onDragEnd() {
  dragIndex.value = null
  dropIndex.value = null
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-2">
      <span class="font-semibold text-xs text-foreground"> 播报队列 </span>
      <span class="text-xs text-muted-foreground"> {{ speakQueue.length }} 项 </span>
      <Button
        v-if="speakQueue.length > 0"
        variant="ghost"
        size="sm"
        class="h-6 text-xs text-destructive hover:bg-destructive/10 ml-auto gap-1 px-2"
        @click="speakQueue.splice(0)"
      >
        <Dismiss20Filled class="size-3.5" />
        清空
      </Button>
    </div>

    <Empty
      v-if="speakQueue.length === 0"
      description="队列为空"
      class="py-8"
    />

    <ScrollArea
      v-else
      class="max-h-[400px] pr-2"
    >
      <div
        class="flex flex-col gap-1"
        @dragend="onDragEnd"
      >
        <div
          v-for="(item, index) in speakQueue"
          :key="`${item.data.time}-${index}`"
          :class="{ 'border-t-2 border-primary pt-0.5': dropIndex === index }"
          @dragover="onDragOver($event, index)"
          @drop="onDrop"
        >
          <QueueItem
            :item="item"
            :index="index"
            @dragstart="onDragStart"
          />
        </div>
      </div>
    </ScrollArea>
  </div>
</template>
