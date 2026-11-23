<script setup lang="ts">
import { Info, RefreshCw } from 'lucide-vue-next'
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'

import { VTS_ACTION_TYPES } from '@/apps/client/store/autoAction/types'
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { ActionType } from '@/apps/client/store/useAutoAction'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { isTauri } from '@/shared/config'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { ColorPicker } from '@/shared/ui/color-picker'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const props = defineProps<{
  action: AutoActionItem
}>()

const vts = useVtsStore()
const isDesktop = isTauri()

const isVtsAction = computed(() => VTS_ACTION_TYPES.has(props.action.actionType))

const hotkeyOptions = computed(() => vts.hotkeys.map((hk) => ({ label: hk.name || hk.hotkeyID, value: hk.hotkeyID })))
const expressionOptions = computed(() => vts.expressions.map((e) => ({ label: e.name, value: e.file })))
const presetOptions = computed(() => vts.presets.map((p) => ({ label: p.name, value: p.id })))
const itemFileOptions = computed(() =>
  vts.availableItemFiles.map((f) => ({ label: `${f.fileName} (${f.loadedCount})`, value: f.fileName })),
)
const macroOptions = computed(() =>
  vts.macros.map((m) => ({ label: `${m.name} (${m.steps?.length ?? 0} 步)`, value: m.id })),
)
const accessoryOptions = computed(() => vts.accessories.map((a) => ({ label: a.name, value: a.id })))
const paramOptions = computed(() =>
  vts.inputParameters.map((p) => ({
    label: `${p.name} [${p.min}~${p.max}]`,
    value: p.name,
  })),
)
const postProcessingPresetOptions = computed(() =>
  (vts.postProcessing?.presets ?? []).map((p) => ({ label: p, value: p })),
)

const tintMode = computed<'color' | 'rainbow' | 'reset'>({
  get: () => {
    if (props.action.actionConfig.vtsTintReset) return 'reset'
    if (props.action.actionConfig.vtsTintRainbow) return 'rainbow'
    return 'color'
  },
  set: (mode) => {
    props.action.actionConfig.vtsTintReset = mode === 'reset'
    props.action.actionConfig.vtsTintRainbow = mode === 'rainbow'
  },
})

onMounted(() => {
  if (!vts.connected) return
  if (props.action.actionType === ActionType.VTS_DROP_ITEM && vts.availableItemFiles.length === 0) {
    void vts.refreshItems({ includeFiles: true }).catch(() => {})
  }
})
</script>

<template>
  <div v-if="isVtsAction">
    <Card>
      <CardHeader class="p-3 border-b flex flex-row items-center justify-between space-y-0">
        <CardTitle class="text-xs font-semibold">VTS 动作配置</CardTitle>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Info class="size-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent>需要桌面客户端连接并授权 VTube Studio</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>

      <CardContent class="p-3 space-y-3">
        <Alert
          v-if="!isDesktop"
          size="sm"
          variant="warning"
        >
          <AlertDescription class="m-0">
            VTS 联动仅在桌面客户端中可执行，当前网页端仅支持编辑和保存配置。
          </AlertDescription>
        </Alert>
        <Alert
          v-else-if="!vts.connected"
          size="sm"
          variant="warning"
        >
          <AlertDescription class="m-0 flex-between gap-2">
            <span>VTube Studio 尚未连接，部分列表选项可能为空。</span>
            <RouterLink
              :to="{ name: 'client-vts' }"
              class="text-primary hover:underline shrink-0 font-medium"
            >
              前往连接 VTS →
            </RouterLink>
          </AlertDescription>
        </Alert>

        <!-- 热键 -->
        <FormField
          v-if="action.actionType === ActionType.VTS_HOTKEY"
          label="热键"
        >
          <div class="flex items-center gap-1.5">
            <div class="flex-1 min-w-0">
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
              size="icon-sm"
              variant="ghost"
              :disabled="!vts.connected"
              aria-label="刷新热键列表"
              @click="vts.refreshHotkeys()"
            >
              <RefreshCw class="size-3.5" />
            </Button>
          </div>
        </FormField>

        <!-- 表情 -->
        <template v-if="action.actionType === ActionType.VTS_EXPRESSION">
          <FormField label="目标表情">
            <div class="flex items-center gap-1.5">
              <div class="flex-1 min-w-0">
                <Select v-model="action.actionConfig.vtsExpressionFile">
                  <SelectTrigger class="w-full">
                    <SelectValue placeholder="选择表情" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="opt in expressionOptions"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                :disabled="!vts.connected"
                aria-label="刷新表情列表"
                @click="vts.refreshExpressions()"
              >
                <RefreshCw class="size-3.5" />
              </Button>
            </div>
          </FormField>
          <SettingRow
            type="switch"
            variant="compact"
            :title="action.actionConfig.vtsExpressionActive !== false ? '操作: 开启表情' : '操作: 关闭表情'"
            :model-value="action.actionConfig.vtsExpressionActive !== false"
            @update:model-value="action.actionConfig.vtsExpressionActive = $event"
          />
        </template>

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
              <div class="flex-1 min-w-0">
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
                size="icon-sm"
                variant="ghost"
                :disabled="!vts.connected"
                aria-label="刷新道具列表"
                @click="vts.refreshItems({ includeFiles: true })"
              >
                <RefreshCw class="size-3.5" />
              </Button>
            </div>
          </FormField>

          <SettingRow
            type="switch"
            variant="compact"
            title="随机 X 落点"
            hint="开启后在画面横向 [-0.6, 0.6] 范围内随机掉落"
            v-model="action.actionConfig.vtsItemRandomX"
          />

          <div class="grid grid-cols-2 gap-2.5">
            <FormField
              v-if="!action.actionConfig.vtsItemRandomX"
              label="水平位置 X"
              class="min-w-0"
            >
              <NumberField
                :model-value="action.actionConfig.vtsItemDropX ?? 0"
                :step="0.05"
                :min="-1"
                :max="1"
                @update:model-value="action.actionConfig.vtsItemDropX = $event"
              />
            </FormField>
            <FormField
              label="缩放大小"
              class="min-w-0"
            >
              <NumberField
                :model-value="action.actionConfig.vtsItemDropSize ?? 0.32"
                :step="0.02"
                :min="0.05"
                :max="1"
                @update:model-value="action.actionConfig.vtsItemDropSize = $event"
              />
            </FormField>
          </div>
        </template>

        <!-- 参数调节 -->
        <template v-if="action.actionType === ActionType.VTS_PARAM_ADD">
          <FormField label="参数 ID">
            <div class="space-y-1.5">
              <Input
                v-model="action.actionConfig.vtsParamId"
                placeholder="输入或下方选择，如 Blush、EyeOpen"
              />
              <Select
                v-if="paramOptions.length > 0"
                :model-value="action.actionConfig.vtsParamId"
                @update:model-value="(val) => (action.actionConfig.vtsParamId = String(val ?? ''))"
              >
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="从当前 VTS 参数列表快速填入" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="opt in paramOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </FormField>

          <FormField label="注入模式">
            <ToggleGroup
              type="single"
              class="w-full grid grid-cols-2"
              :model-value="action.actionConfig.vtsParamMode ?? 'add'"
              @update:model-value="(v) => v && (action.actionConfig.vtsParamMode = v as 'add' | 'set')"
            >
              <ToggleGroupItem value="add">叠加 (add)</ToggleGroupItem>
              <ToggleGroupItem value="set">覆写 (set)</ToggleGroupItem>
            </ToggleGroup>
          </FormField>

          <div class="grid grid-cols-2 gap-2.5">
            <FormField
              label="数值"
              class="min-w-0"
            >
              <NumberField
                :model-value="action.actionConfig.vtsParamValue ?? 0"
                :step="0.05"
                @update:model-value="action.actionConfig.vtsParamValue = $event"
              />
            </FormField>
            <FormField
              label="权重"
              class="min-w-0"
            >
              <NumberField
                :model-value="action.actionConfig.vtsParamWeight ?? 1"
                :step="0.1"
                :min="0"
                :max="1"
                @update:model-value="action.actionConfig.vtsParamWeight = $event"
              />
            </FormField>
          </div>
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

        <!-- 配饰（对齐运行时默认 ?? true） -->
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
            variant="compact"
            :title="action.actionConfig.vtsAccessoryVisible !== false ? '操作: 显示配饰' : '操作: 隐藏配饰'"
            :model-value="action.actionConfig.vtsAccessoryVisible !== false"
            @update:model-value="action.actionConfig.vtsAccessoryVisible = $event"
          />
        </template>

        <!-- 模型染色 -->
        <template v-if="action.actionType === ActionType.VTS_COLOR_TINT">
          <FormField label="染色模式">
            <ToggleGroup
              type="single"
              class="w-full grid grid-cols-3"
              :model-value="tintMode"
              @update:model-value="(v) => v && (tintMode = v as 'color' | 'rainbow' | 'reset')"
            >
              <ToggleGroupItem value="color">指定颜色</ToggleGroupItem>
              <ToggleGroupItem value="rainbow">彩虹循环</ToggleGroupItem>
              <ToggleGroupItem value="reset">恢复原色</ToggleGroupItem>
            </ToggleGroup>
          </FormField>

          <FormField
            v-if="tintMode === 'color'"
            label="目标颜色"
          >
            <ColorPicker
              :model-value="action.actionConfig.vtsTintColor || '#ff6b9d'"
              @update:model-value="(v: string) => (action.actionConfig.vtsTintColor = v)"
            />
          </FormField>
        </template>

        <!-- 后处理滤镜 -->
        <template v-if="action.actionType === ActionType.VTS_POST_PROCESSING">
          <SettingRow
            type="switch"
            variant="compact"
            :title="action.actionConfig.vtsPostProcessingEnabled !== false ? '开启后处理滤镜' : '关闭后处理滤镜'"
            :model-value="action.actionConfig.vtsPostProcessingEnabled !== false"
            @update:model-value="action.actionConfig.vtsPostProcessingEnabled = $event"
          />

          <template v-if="action.actionConfig.vtsPostProcessingEnabled !== false">
            <FormField label="滤镜预设">
              <Select
                :model-value="action.actionConfig.vtsPostProcessingPreset || '__none__'"
                @update:model-value="
                  (v) => (action.actionConfig.vtsPostProcessingPreset = v === '__none__' ? undefined : String(v))
                "
              >
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="保持当前预设或选择预设" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">仅开启（不切换预设）</SelectItem>
                  <SelectItem
                    v-for="opt in postProcessingPresetOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="过渡时长 (秒)">
              <NumberField
                :model-value="action.actionConfig.vtsPostProcessingFadeTime ?? 0.3"
                :min="0"
                :max="5"
                :step="0.1"
                @update:model-value="action.actionConfig.vtsPostProcessingFadeTime = $event"
              />
            </FormField>
          </template>
        </template>
      </CardContent>
    </Card>
  </div>
</template>
