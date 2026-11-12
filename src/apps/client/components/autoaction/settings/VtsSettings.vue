<script setup lang="ts">
import ArrowClockwise16Filled from '@vicons/fluent/es/ArrowClockwise16Filled'
import Info16Regular from '@vicons/fluent/es/Info16Regular'
import { computed } from 'vue'

import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { ActionType } from '@/apps/client/store/useAutoAction'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
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
    <Card>
      <CardHeader class="p-3 border-b flex flex-row items-center justify-between">
        <CardTitle>VTS 动作配置</CardTitle>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Info16Regular class="size-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent> 需要 VTS 已连接且已授权 </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>

      <CardContent class="p-3 space-y-3">
        <!-- 热键 -->
        <FormField
          v-if="action.actionType === ActionType.VTS_HOTKEY"
          label="热键"
        >
          <div class="flex items-center gap-1.5">
            <div class="flex-1">
              <Select v-model="action.actionConfig.vtsHotkeyId">
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="选择热键" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="opt in hotkeyOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              size="xs"
              variant="ghost"
              class="w-8 p-0"
              aria-label="刷新"
              @click="vts.refreshHotkeys()"
            >
              <ArrowClockwise16Filled class="size-3.5" />
            </Button>
          </div>
        </FormField>

        <!-- 机位预设 -->
        <FormField
          v-if="action.actionType === ActionType.VTS_PRESET"
          type="select"
          label="机位预设"
          placeholder="选择预设"
          :options="presetOptions"
          v-model="action.actionConfig.vtsPresetId"
        />

        <!-- 掉落道具 -->
        <template v-if="action.actionType === ActionType.VTS_DROP_ITEM">
          <FormField label="道具文件">
            <div class="flex items-center gap-1.5">
              <div class="flex-1">
                <Select v-model="action.actionConfig.vtsItemFileName">
                  <SelectTrigger class="w-full">
                    <SelectValue placeholder="选择道具文件" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="opt in itemFileOptions"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="xs"
                variant="ghost"
                class="w-8 p-0"
                :disabled="!vts.connected"
                aria-label="刷新"
                @click="vts.refreshItems({ includeFiles: true })"
              >
                <ArrowClockwise16Filled class="size-3.5" />
              </Button>
            </div>
          </FormField>

          <SettingRow
            variant="compact"
            title="位置与缩放"
          >
            <div class="flex items-center gap-2">
              <div class="flex items-center gap-1 text-xs">
                <span class="text-muted-foreground">X:</span>
                <NumberField
                  :model-value="action.actionConfig.vtsItemDropX"
                  placeholder="X"
                  :step="0.05"
                  class="w-24"
                  @update:model-value="action.actionConfig.vtsItemDropX = $event"
                />
              </div>
              <div class="flex items-center gap-1 text-xs">
                <span class="text-muted-foreground">S:</span>
                <NumberField
                  :model-value="action.actionConfig.vtsItemDropSize"
                  placeholder="大小"
                  :step="0.01"
                  :min="0"
                  :max="1"
                  class="w-24"
                  @update:model-value="action.actionConfig.vtsItemDropSize = $event"
                />
              </div>
            </div>
          </SettingRow>
        </template>

        <!-- 参数调节 -->
        <template v-if="action.actionType === ActionType.VTS_PARAM_ADD">
          <FormField
            label="参数 ID"
            placeholder="如 Blush, EyeOpen"
            v-model="action.actionConfig.vtsParamId"
          />

          <SettingRow
            variant="compact"
            title="数值与权重"
          >
            <div class="flex items-center gap-2">
              <div class="flex items-center gap-1 text-xs">
                <span class="text-muted-foreground">值:</span>
                <NumberField
                  :model-value="action.actionConfig.vtsParamValue"
                  placeholder="值"
                  :step="0.01"
                  class="w-24"
                  @update:model-value="action.actionConfig.vtsParamValue = $event"
                />
              </div>
              <div class="flex items-center gap-1 text-xs">
                <span class="text-muted-foreground">W:</span>
                <NumberField
                  :model-value="action.actionConfig.vtsParamWeight"
                  placeholder="权重"
                  :step="0.1"
                  :min="0"
                  :max="1"
                  class="w-24"
                  @update:model-value="action.actionConfig.vtsParamWeight = $event"
                />
              </div>
            </div>
          </SettingRow>
        </template>

        <!-- 宏 -->
        <FormField
          v-if="action.actionType === ActionType.VTS_MACRO"
          type="select"
          label="宏"
          placeholder="选择要运行的宏"
          :options="macroOptions"
          v-model="action.actionConfig.vtsMacroId"
        />

        <!-- 配饰 -->
        <template v-if="action.actionType === ActionType.VTS_ACCESSORY">
          <FormField
            type="select"
            label="配饰"
            placeholder="选择配饰"
            :options="accessoryOptions"
            v-model="action.actionConfig.vtsAccessoryId"
          />

          <SettingRow
            type="switch"
            :title="action.actionConfig.vtsAccessoryVisible ? '操作: 显示' : '操作: 隐藏'"
            v-model="action.actionConfig.vtsAccessoryVisible"
          />
        </template>
      </CardContent>
    </Card>
  </div>
</template>
