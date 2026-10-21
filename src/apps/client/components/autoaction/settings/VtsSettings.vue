<script setup lang="ts">
import { ArrowClockwise16Filled, Info16Regular } from '@vicons/fluent'
import { computed } from 'vue'

import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { ActionType } from '@/apps/client/store/useAutoAction'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const props = defineProps<{
  action: AutoActionItem
}>()

const vts = useVtsStore()

const isVtsAction = computed(() =>
  [
    ActionType.VTS_HOTKEY,
    ActionType.VTS_PRESET,
    ActionType.VTS_DROP_ITEM,
    ActionType.VTS_PARAM_ADD,
    ActionType.VTS_MACRO,
    ActionType.VTS_ACCESSORY,
  ].includes(props.action.actionType),
)

const hotkeyOptions = computed(() => vts.hotkeys.map((hk) => ({ label: hk.name || hk.hotkeyID, value: hk.hotkeyID })))
const presetOptions = computed(() => vts.presets.map((p) => ({ label: p.name, value: p.id })))
const itemFileOptions = computed(() =>
  vts.availableItemFiles.map((f) => ({ label: `${f.fileName} (${f.loadedCount})`, value: f.fileName })),
)
const macroOptions = computed(() =>
  vts.macros.map((m) => ({ label: `${m.name} (${m.steps?.length ?? 0} 步)`, value: m.id })),
)
const accessoryOptions = computed(() => vts.accessories.map((a) => ({ label: a.name, value: a.id })))
</script>

<template>
  <div v-if="isVtsAction">
    <Card class="border bg-card">
      <CardHeader class="p-3 pb-2 border-b flex flex-row items-center justify-between">
        <CardTitle class="text-sm font-semibold">VTS 动作配置</CardTitle>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Info16Regular class="size-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent class="text-xs">
              需要 VTS 已连接且已授权
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>

      <CardContent class="p-3 space-y-3">
        <!-- 热键 -->
        <div
          v-if="action.actionType === ActionType.VTS_HOTKEY"
          class="space-y-1"
        >
          <span class="text-xs text-muted-foreground">热键</span>
          <div class="flex items-center gap-1.5">
            <div class="flex-1">
              <Select v-model="action.actionConfig.vtsHotkeyId">
                <SelectTrigger class="h-8 text-xs w-full">
                  <SelectValue placeholder="选择热键" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="opt in hotkeyOptions"
                    :key="opt.value"
                    :value="opt.value"
                    class="text-xs"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              size="xs"
              variant="ghost"
              class="h-8 w-8 p-0"
              title="刷新"
              @click="vts.refreshHotkeys()"
            >
              <ArrowClockwise16Filled class="size-3.5" />
            </Button>
          </div>
        </div>

        <!-- 机位预设 -->
        <div
          v-if="action.actionType === ActionType.VTS_PRESET"
          class="space-y-1"
        >
          <span class="text-xs text-muted-foreground">机位预设</span>
          <Select v-model="action.actionConfig.vtsPresetId">
            <SelectTrigger class="h-8 text-xs w-full">
              <SelectValue placeholder="选择预设" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in presetOptions"
                :key="opt.value"
                :value="opt.value"
                class="text-xs"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- 掉落道具 -->
        <template v-if="action.actionType === ActionType.VTS_DROP_ITEM">
          <div class="space-y-1">
            <span class="text-xs text-muted-foreground">道具文件</span>
            <div class="flex items-center gap-1.5">
              <div class="flex-1">
                <Select v-model="action.actionConfig.vtsItemFileName">
                  <SelectTrigger class="h-8 text-xs w-full">
                    <SelectValue placeholder="选择道具文件" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="opt in itemFileOptions"
                      :key="opt.value"
                      :value="opt.value"
                      class="text-xs"
                    >
                      {{ opt.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="xs"
                variant="ghost"
                class="h-8 w-8 p-0"
                :disabled="!vts.connected"
                title="刷新"
                @click="vts.refreshItems({ includeFiles: true })"
              >
                <ArrowClockwise16Filled class="size-3.5" />
              </Button>
            </div>
          </div>

          <div class="flex items-center justify-between p-2.5 rounded border bg-muted/20">
            <span class="text-xs font-medium text-foreground">位置与缩放</span>
            <div class="flex items-center gap-2">
              <div class="flex items-center gap-1 text-xs">
                <span class="text-muted-foreground">X:</span>
                <NInputNumber
                  :value="action.actionConfig.vtsItemDropX"
                  placeholder="X"
                  :step="0.05"
                  size="small"
                  class="w-24"
                  @update:value="action.actionConfig.vtsItemDropX = $event"
                />
              </div>
              <div class="flex items-center gap-1 text-xs">
                <span class="text-muted-foreground">S:</span>
                <NInputNumber
                  :value="action.actionConfig.vtsItemDropSize"
                  placeholder="大小"
                  :step="0.01"
                  :min="0"
                  :max="1"
                  size="small"
                  class="w-24"
                  @update:value="action.actionConfig.vtsItemDropSize = $event"
                />
              </div>
            </div>
          </div>
        </template>

        <!-- 参数调节 -->
        <template v-if="action.actionType === ActionType.VTS_PARAM_ADD">
          <div class="space-y-1">
            <span class="text-xs text-muted-foreground">参数 ID</span>
            <Input
              v-model="action.actionConfig.vtsParamId"
              placeholder="如 Blush, EyeOpen"
              class="h-8 text-xs"
            />
          </div>

          <div class="flex items-center justify-between p-2.5 rounded border bg-muted/20">
            <span class="text-xs font-medium text-foreground">数值与权重</span>
            <div class="flex items-center gap-2">
              <div class="flex items-center gap-1 text-xs">
                <span class="text-muted-foreground">值:</span>
                <NInputNumber
                  :value="action.actionConfig.vtsParamValue"
                  placeholder="值"
                  :step="0.01"
                  size="small"
                  class="w-24"
                  @update:value="action.actionConfig.vtsParamValue = $event"
                />
              </div>
              <div class="flex items-center gap-1 text-xs">
                <span class="text-muted-foreground">W:</span>
                <NInputNumber
                  :value="action.actionConfig.vtsParamWeight"
                  placeholder="权重"
                  :step="0.1"
                  :min="0"
                  :max="1"
                  size="small"
                  class="w-24"
                  @update:value="action.actionConfig.vtsParamWeight = $event"
                />
              </div>
            </div>
          </div>
        </template>

        <!-- 宏 -->
        <div
          v-if="action.actionType === ActionType.VTS_MACRO"
          class="space-y-1"
        >
          <span class="text-xs text-muted-foreground">宏</span>
          <Select v-model="action.actionConfig.vtsMacroId">
            <SelectTrigger class="h-8 text-xs w-full">
              <SelectValue placeholder="选择要运行的宏" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in macroOptions"
                :key="opt.value"
                :value="opt.value"
                class="text-xs"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- 配饰 -->
        <template v-if="action.actionType === ActionType.VTS_ACCESSORY">
          <div class="space-y-1">
            <span class="text-xs text-muted-foreground">配饰</span>
            <Select v-model="action.actionConfig.vtsAccessoryId">
              <SelectTrigger class="h-8 text-xs w-full">
                <SelectValue placeholder="选择配饰" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in accessoryOptions"
                  :key="opt.value"
                  :value="opt.value"
                  class="text-xs"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="flex items-center justify-between p-2.5 rounded border bg-muted/20">
            <span class="text-xs font-medium text-foreground">
              {{ action.actionConfig.vtsAccessoryVisible ? '操作: 显示' : '操作: 隐藏' }}
            </span>
            <Switch v-model:checked="action.actionConfig.vtsAccessoryVisible" />
          </div>
        </template>
      </CardContent>
    </Card>
  </div>
</template>
