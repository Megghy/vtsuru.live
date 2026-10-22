<script setup lang="ts">
import { useSpeechService } from '@/store/useSpeechService'
import { Empty } from '@/shared/ui/empty'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { formatTime } from '@/apps/manage/composables/formatters'

const { spokenHistory, rejectedHistory } = useSpeechService()
</script>

<template>
  <div class="history">
    <Tabs
      default-value="spoken"
      class="w-full"
    >
      <TabsList class="grid grid-cols-2 w-full">
        <TabsTrigger
          value="spoken"
          class="text-xs"
        >
          已播报 ({{ spokenHistory.length }})
        </TabsTrigger>
        <TabsTrigger
          value="rejected"
          class="text-xs"
        >
          已拒绝 ({{ rejectedHistory.length }})
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value="spoken"
        class="mt-2"
      >
        <Empty
          v-if="spokenHistory.length === 0"
          description="暂无记录"
          class="py-8"
        />
        <ScrollArea
          v-else
          class="max-h-[260px] pr-2"
        >
          <div class="items">
            <div
              v-for="(item, i) in spokenHistory"
              :key="i"
              class="item"
            >
              <span class="uname">{{ item.uname }}</span>
              <span class="text text-muted-foreground">
                {{ item.text }}
              </span>
              <span class="time">{{ formatTime(item.time) }}</span>
            </div>
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent
        value="rejected"
        class="mt-2"
      >
        <Empty
          v-if="rejectedHistory.length === 0"
          description="暂无记录"
          class="py-8"
        />
        <ScrollArea
          v-else
          class="max-h-[260px] pr-2"
        >
          <div class="items">
            <div
              v-for="(item, i) in rejectedHistory"
              :key="i"
              class="item"
            >
              <span class="uname">{{ item.uname }}</span>
              <span class="reason text-destructive">
                {{ item.reason }}
              </span>
              <span class="time">{{ formatTime(item.time) }}</span>
            </div>
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  </div>
</template>

<style scoped>
.history {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  font-size: 11px;
  border-radius: 4px;
}
.item:hover {
  background: var(--muted, rgba(0, 0, 0, 0.03));
}
.uname {
  font-weight: 500;
  flex-shrink: 0;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.reason {
  flex: 1;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.time {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--muted-foreground);
}
</style>
