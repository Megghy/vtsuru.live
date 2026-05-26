<script setup lang="ts">
import { Dismiss20Filled } from '@vicons/fluent'
import { NButton, NEmpty, NIcon, NScrollbar, NText } from 'naive-ui'
import { ref } from 'vue'
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
  <div class="queue-list">
    <div class="header">
      <NText strong style="font-size: 13px">
        播报队列
      </NText>
      <NText depth="3" style="font-size: 11px">
        {{ speakQueue.length }} 项
      </NText>
      <NButton
        v-if="speakQueue.length > 0"
        size="tiny" tertiary type="error"
        style="margin-left: auto"
        @click="speakQueue.splice(0)"
      >
        <template #icon>
          <NIcon :component="Dismiss20Filled" />
        </template>
        清空
      </NButton>
    </div>

    <NEmpty v-if="speakQueue.length === 0" description="队列为空" size="small" />

    <NScrollbar v-else style="max-height: 400px">
      <div class="items" @dragend="onDragEnd">
        <div
          v-for="(item, index) in speakQueue"
          :key="`${item.data.time}-${index}`"
          :class="{ 'drop-target': dropIndex === index }"
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
    </NScrollbar>
  </div>
</template>

<style scoped>
.queue-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.drop-target {
  border-top: 2px solid var(--n-primary-color);
  padding-top: 2px;
}
</style>
