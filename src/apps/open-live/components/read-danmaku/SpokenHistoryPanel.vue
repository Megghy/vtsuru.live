<script setup lang="ts">
import { formatTime } from '@/apps/manage/composables/formatters'
import { Empty } from '@/shared/ui/empty'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { useSpeechService } from '@/store/useSpeechService'

const { spokenHistory, rejectedHistory } = useSpeechService()
</script>

<template>
  <div class="flex flex-col gap-1.5">
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
          <div class="flex flex-col gap-0.5">
            <div
              v-for="(item, i) in spokenHistory"
              :key="i"
              class="flex items-center gap-1.5 py-1 px-1.5 text-[11px] rounded hover:bg-muted"
            >
              <span class="font-medium shrink-0 max-w-20 truncate">{{ item.uname }}</span>
              <span class="flex-1 min-w-0 truncate text-muted-foreground">
                {{ item.text }}
              </span>
              <span class="shrink-0 text-[10px] text-muted-foreground">{{ formatTime(item.time) }}</span>
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
          <div class="flex flex-col gap-0.5">
            <div
              v-for="(item, i) in rejectedHistory"
              :key="i"
              class="flex items-center gap-1.5 py-1 px-1.5 text-[11px] rounded hover:bg-muted"
            >
              <span class="font-medium shrink-0 max-w-20 truncate">{{ item.uname }}</span>
              <span class="flex-1 min-w-0 truncate text-[11px] text-destructive">
                {{ item.reason }}
              </span>
              <span class="shrink-0 text-[10px] text-muted-foreground">{{ formatTime(item.time) }}</span>
            </div>
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  </div>
</template>
