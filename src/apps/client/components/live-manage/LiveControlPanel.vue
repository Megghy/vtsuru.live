<script setup lang="ts">
import {
  AlertTriangle,
  Play,
  RefreshCw,
  Square,
  Video,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'

import type { LiveControl } from '@/apps/client/composables/useLiveControl'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

import LiveCoverUpload from './LiveCoverUpload.vue'

const props = defineProps<{ control: LiveControl }>()
const c = props.control
const obsStore = c.obsStore

// 分区两级级联联动
const customParentId = ref<string>('')

// 所有可用的一级大类分区
const parentAreas = computed(() => {
  const map = new Map<number, string>()
  c.liveAreas.value.forEach((a) => {
    if (!map.has(a.parent_id)) {
      map.set(a.parent_id, a.parent_name)
    }
  })
  return Array.from(map.entries()).map(([id, name]) => ({
    label: name,
    value: String(id),
  }))
})

// 当前激活的一级大类
const currentParentId = computed<string>({
  get() {
    if (customParentId.value) return customParentId.value
    if (c.liveAreaId.value) {
      const matched = c.liveAreas.value.find((a) => a.id === c.liveAreaId.value)
      if (matched) return String(matched.parent_id)
    }
    return ''
  },
  set(val: string) {
    customParentId.value = val
  },
})

// 当前激活的一级大类下的所有子分区
const subAreas = computed(() => {
  if (!currentParentId.value) return []
  const pid = Number(currentParentId.value)
  return c.liveAreas.value
    .filter((a) => a.parent_id === pid)
    .map((a) => ({
      label: a.name,
      value: String(a.id),
    }))
})

// 当前选中的子分区字符串绑定
const currentSubAreaId = computed<string>({
  get() {
    return c.liveAreaId.value ? String(c.liveAreaId.value) : ''
  },
  set(val: string) {
    const num = Number(val)
    if (num && c.liveAreaId.value !== num) {
      c.liveAreaId.value = num
      c.markAreaEdited()
    }
  },
})

function handleParentChange(newPid: any) {
  const str = String(newPid ?? '')
  customParentId.value = str
  // 如果切换了大类后，当前子分区不在新大类内，则清空已选子分区
  const exists = c.liveAreas.value.some((a) => a.parent_id === Number(str) && a.id === c.liveAreaId.value)
  if (!exists) {
    c.liveAreaId.value = 0
    c.markAreaEdited()
  }
}

function handleSubAreaChange(val: any) {
  const str = String(val ?? '')
  currentSubAreaId.value = str
}
</script>

<template>
  <Card class="border bg-card">
    <CardHeader class="p-3 pb-2 border-b">
      <CardTitle class="text-sm font-semibold">直播控制</CardTitle>
    </CardHeader>

    <CardContent class="p-3 space-y-4">
      <!-- 状态与控制栏 -->
      <div class="flex flex-wrap items-center gap-2.5">
        <!-- 直播状态徽章 -->
        <div
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border"
          :class="
            c.isLiving.value
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
              : 'bg-muted text-muted-foreground border-border'
          "
        >
          <span
            class="size-2 rounded-full"
            :class="c.isLiving.value ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/60'"
          />
          {{ c.isLiving.value ? '直播中' : '未开播' }}
        </div>

        <!-- 开始/停止直播操作 -->
        <template v-if="!c.isLiving.value">
          <Popconfirm
            v-if="c.needUpdateBeforeLive.value"
            title="开播确认"
            positive-text="更新并开播"
            negative-text="直接开播"
            @positive-click="c.handleStartLiveWithUpdate"
            @negative-click="c.handleStartLive"
          >
            <template #trigger>
              <Button
                type="button"
                class="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                :disabled="!c.liveAreaId.value"
              >
                <Play class="size-3.5 fill-current" />
                开始直播
              </Button>
            </template>
            检测到直播标题或分区已修改，是否先更新直播间信息再开播？
          </Popconfirm>

          <Button
            v-else
            type="button"
            class="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            :disabled="!c.liveAreaId.value"
            @click="c.handleStartLive"
          >
            <Play class="size-3.5 fill-current" />
            开始直播
          </Button>
        </template>

        <Button
          v-else
          type="button"
          variant="destructive"
          class="gap-1.5"
          @click="c.handleStopLive"
        >
          <Square class="size-3.5 fill-current" />
          停止直播
        </Button>

        <!-- OBS 推流控制 -->
        <TooltipProvider v-if="obsStore.obsConnected && !c.isLiving.value">
          <Tooltip>
            <TooltipTrigger as-child>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  disabled
                  class="gap-1.5"
                >
                  <Video class="size-3.5" />
                  {{ obsStore.obsStreamActive ? '停止 OBS 推流' : '开始 OBS 推流' }}
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent class="text-xs">
              请先开始直播后再控制 OBS 推流
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Button
          v-else-if="obsStore.obsConnected && c.isLiving.value"
          type="button"
          :variant="obsStore.obsStreamActive ? 'destructive' : 'default'"
          class="gap-1.5"
          :disabled="obsStore.isTogglingObsStream"
          @click="obsStore.handleObsToggleStream"
        >
          <Video class="size-3.5" />
          {{ obsStore.obsStreamActive ? '停止 OBS 推流' : '开始 OBS 推流' }}
        </Button>

        <!-- 更新直播间信息 -->
        <Button
          v-if="!c.isLiving.value && c.liveTitle.value"
          type="button"
          variant="outline"
          class="gap-1.5"
          :disabled="!c.liveAreaId.value && !c.liveTitle.value"
          @click="c.handleUpdateRoom"
        >
          <RefreshCw class="size-3.5" />
          更新直播间信息
        </Button>
      </div>

      <div class="h-px bg-border" />

      <!-- 直播间设置：标题与两级分区 -->
      <div class="space-y-3">
        <span class="text-xs font-semibold text-foreground block">直播间基础设置</span>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <!-- 标题 -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="text-xs text-muted-foreground flex items-center gap-1.5">
                直播间标题
                <span
                  v-if="c.titleChanged.value"
                  class="text-[10px] text-amber-500 font-medium"
                >
                  (已修改未同步)
                </span>
              </label>
              <span class="text-[11px] text-muted-foreground">{{ (c.liveTitle.value || '').length }} / 40</span>
            </div>
            <Input
              :model-value="c.liveTitle.value"
              placeholder="输入直播间标题"
              maxlength="40"
              :class="c.titleChanged.value ? 'border-amber-500/50' : ''"
              @update:model-value="
                c.liveTitle.value = String($event);
                c.markTitleEdited();
              "
            />
          </div>

          <!-- 分区 (大类 + 子分区) -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="text-xs text-muted-foreground flex items-center gap-1.5">
                直播分区
                <span
                  v-if="c.areaChanged.value"
                  class="text-[10px] text-amber-500 font-medium"
                >
                  (已修改未同步)
                </span>
              </label>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <!-- 一级大类 -->
              <Select
                :model-value="currentParentId"
                @update:model-value="handleParentChange"
              >
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="大类分区" />
                </SelectTrigger>
                <SelectContent class="max-h-60">
                  <SelectItem
                    v-for="p in parentAreas"
                    :key="p.value"
                    :value="p.value"
                  >
                    {{ p.label }}
                  </SelectItem>
                </SelectContent>
              </Select>

              <!-- 二级具体分区 -->
              <Select
                :model-value="currentSubAreaId"
                :disabled="!currentParentId"
                @update:model-value="handleSubAreaChange"
              >
                <SelectTrigger
                  class="w-full"
                  :class="c.areaChanged.value ? 'border-amber-500/50' : ''"
                >
                  <SelectValue :placeholder="currentParentId ? '具体子分区' : '请先选大类'" />
                </SelectTrigger>
                <SelectContent class="max-h-60">
                  <SelectItem
                    v-for="s in subAreas"
                    :key="s.value"
                    :value="s.value"
                  >
                    {{ s.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div class="h-px bg-border" />

      <!-- 直播间公告 -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <label class="text-xs font-semibold text-foreground block">直播间公告</label>
          <span class="text-[11px] text-muted-foreground">{{ (c.roomAnnouncement.value || '').length }} / 60</span>
        </div>
        <Textarea
          :model-value="c.roomAnnouncement.value"
          placeholder="输入直播间公告（最多 60 个字符）"
          maxlength="60"
          rows="2"
          class="min-h-[56px] text-xs resize-y"
          @update:model-value="c.roomAnnouncement.value = String($event)"
        />
        <div class="flex justify-end">
          <Button
            type="button"
            variant="outline"
            :disabled="c.isUpdatingAnnouncement.value"
            @click="c.handleUpdateAnnouncement"
          >
            {{ c.isUpdatingAnnouncement.value ? '正在更新...' : '更新公告' }}
          </Button>
        </div>
      </div>

      <div class="h-px bg-border" />

      <!-- 直播封面 -->
      <LiveCoverUpload :control="c" />
    </CardContent>
  </Card>
</template>
