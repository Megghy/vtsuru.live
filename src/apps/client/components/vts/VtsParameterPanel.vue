<script setup lang="ts">
import { Plus, RotateCcw, Square } from 'lucide-vue-next'
import { computed, onUnmounted } from 'vue'

import type { VtsParamSlot } from '@/apps/client/store/useVtsStore'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/ui/accordion'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Slider } from '@/shared/ui/slider'
import { Switch } from '@/shared/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

import { useVtsAction } from './useVtsAction'

const vts = useVtsStore()
const { run } = useVtsAction()

const paramOptions = computed(() =>
  vts.inputParameters.map((p) => ({
    label: `${p.name} [${p.min}~${p.max}]${p.isCustom ? ' (自定义)' : ''}`,
    value: p.name,
  })),
)

const persistTimers = new Map<string, number>()

function schedulePersist(slot: VtsParamSlot) {
  window.clearTimeout(persistTimers.get(slot.id))
  const timer = window.setTimeout(() => {
    persistTimers.delete(slot.id)
    void vts.upsertParamSlot({ ...slot })
  }, 250)
  persistTimers.set(slot.id, timer)
}

onUnmounted(() => {
  for (const timer of persistTimers.values()) window.clearTimeout(timer)
  persistTimers.clear()
})

function safeBounds(slot: VtsParamSlot) {
  const min = Number.isFinite(slot.min) ? slot.min : 0
  const max = Number.isFinite(slot.max) && slot.max > min ? slot.max : min + 1
  const step = Number.isFinite(slot.step) && slot.step > 0 ? slot.step : 0.01
  return { min, max, step }
}

async function updateSlot(next: VtsParamSlot) {
  const { min, max, step } = safeBounds(next)
  const sanitized: VtsParamSlot = {
    ...next,
    min,
    max,
    step,
    value: Math.min(max, Math.max(min, next.value)),
  }
  await vts.upsertParamSlot(sanitized)
  if (sanitized.hold) {
    vts.startParamHold(sanitized.id)
  } else {
    vts.stopParamHold(sanitized.id)
  }
}

function onSliderInput(slot: VtsParamSlot, val: number[] | undefined) {
  if (val?.[0] === undefined) return
  slot.value = val[0]
  schedulePersist(slot)
}

function selectVtsParam(slot: VtsParamSlot, paramName: string) {
  const info = vts.inputParameters.find((p) => p.name === paramName)
  if (!info) return
  void updateSlot({
    ...slot,
    name: slot.name === 'NewParam' || slot.name === slot.parameterId ? info.name : slot.name,
    parameterId: info.name,
    min: info.min,
    max: info.max > info.min ? info.max : info.min + 1,
    defaultValue: info.defaultValue,
    value: info.defaultValue,
  })
}

function injectOnce(slot: VtsParamSlot) {
  run(
    () =>
      vts.injectParameters([{ id: slot.parameterId, value: slot.value, weight: slot.weight }], {
        mode: slot.mode ?? 'add',
      }),
    '已注入',
  )
}

function resetSlotValue(slot: VtsParamSlot) {
  const target = slot.defaultValue ?? 0
  slot.value = target
  void updateSlot({ ...slot, value: target })
  if (vts.connected) injectOnce({ ...slot, value: target })
}

function addSlot() {
  run(() => vts.createParamSlot(), '已添加参数槽')
}

const hasAnyHold = computed(() => vts.paramSlots.some((s) => s.hold))
</script>

<template>
  <Card>
    <CardHeader class="p-3 border-b flex flex-row items-center justify-between gap-2 flex-wrap">
      <div class="flex items-center gap-2">
        <CardTitle>参数控制</CardTitle>
        <Badge
          v-if="vts.paramSlots.length > 0"
          variant="secondary"
          size="xs"
          class="tabular-nums"
        >
          {{ vts.paramSlots.length }}
        </Badge>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-[11px] text-muted-foreground">Hold 模式持续注入且不刷屏操作记录</span>
        <Button
          size="xs"
          variant="outline"
          class="gap-1"
          :disabled="!hasAnyHold"
          @click="run(() => vts.stopAllParamHolds(), '已停止全部持有')"
        >
          <Square class="size-3" />
          全部停止持有
        </Button>
        <Button
          class="gap-1.5"
          @click="addSlot"
        >
          <Plus class="size-3.5" />
          添加参数槽
        </Button>
      </div>
    </CardHeader>

    <CardContent class="p-3 space-y-3">
      <div
        v-if="vts.paramSlots.length === 0"
        class="py-6"
      >
        <Empty description="添加参数槽以实时微调脸红、张嘴、身体偏移等 Live2D 输入参数" />
      </div>

      <div
        v-for="slot in vts.paramSlots"
        :key="slot.id"
        class="p-2.5 sm:px-3 border border-border rounded-md bg-muted/30 space-y-2.5"
      >
        <div class="flex-between gap-2 flex-wrap">
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-foreground">
              {{ slot.name || slot.parameterId }}
            </span>
            <span
              v-if="slot.name && slot.name !== slot.parameterId"
              class="text-[11px] text-muted-foreground font-mono"
            >
              {{ slot.parameterId }}
            </span>
            <Badge
              variant="outline"
              size="xs"
            >
              {{ slot.mode === 'set' ? '覆写' : '叠加' }}
            </Badge>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <label class="flex items-center gap-1.5 cursor-pointer select-none">
              <Switch
                :checked="slot.hold"
                :disabled="!vts.connected"
                @update:checked="(val) => updateSlot({ ...slot, hold: val })"
              />
              <span class="text-xs text-muted-foreground">Hold</span>
            </label>
            <Button
              size="xs"
              variant="ghost"
              class="gap-1"
              title="复位默认值"
              @click="resetSlotValue(slot)"
            >
              <RotateCcw class="size-3" />
              复位
            </Button>
            <Button
              size="xs"
              variant="outline"
              :disabled="!vts.connected"
              @click="injectOnce(slot)"
            >
              注入
            </Button>
            <Popconfirm
              title="确认删除此参数槽？"
              @confirm="vts.removeParamSlot(slot.id)"
            >
              <Button
                size="xs"
                variant="outline"
                class="border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                删除
              </Button>
            </Popconfirm>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <div class="flex-1 min-w-[200px]">
            <Slider
              :model-value="[slot.value]"
              :min="safeBounds(slot).min"
              :max="safeBounds(slot).max"
              :step="safeBounds(slot).step"
              :disabled="!vts.connected"
              @update:model-value="(val) => onSliderInput(slot, val)"
            />
          </div>
          <NumberField
            :model-value="slot.value"
            :min="safeBounds(slot).min"
            :max="safeBounds(slot).max"
            :step="safeBounds(slot).step"
            :disabled="!vts.connected"
            class="w-28"
            @update:model-value="
              (val) => {
                slot.value = Number(val ?? 0)
                schedulePersist(slot)
              }
            "
          />
        </div>

        <Accordion
          type="single"
          collapsible
          class="text-xs pt-1 border-t border-border/60"
        >
          <AccordionItem
            value="config"
            class="border-b-0"
          >
            <AccordionTrigger class="py-1 text-muted-foreground hover:text-foreground hover:no-underline">
              参数配置
            </AccordionTrigger>
            <AccordionContent class="pt-2 pb-1 space-y-2.5">
              <div
                v-if="paramOptions.length > 0"
                class="flex items-center gap-2"
              >
                <span class="text-muted-foreground shrink-0">从 VTS 选择:</span>
                <Select
                  :model-value="slot.parameterId"
                  @update:model-value="(val) => selectVtsParam(slot, String(val ?? ''))"
                >
                  <SelectTrigger class="flex-1 max-w-sm">
                    <SelectValue placeholder="选择 VTS 输入参数并自动填充范围" />
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

              <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                <FormField
                  label="显示名"
                  class="min-w-0"
                >
                  <Input
                    v-model="slot.name"
                    placeholder="显示名"
                    @blur="updateSlot({ ...slot })"
                  />
                </FormField>
                <FormField
                  label="参数 ID"
                  class="min-w-0"
                >
                  <Input
                    v-model="slot.parameterId"
                    placeholder="参数 ID"
                    @blur="updateSlot({ ...slot })"
                  />
                </FormField>
                <FormField
                  label="注入模式"
                  class="min-w-0"
                >
                  <ToggleGroup
                    type="single"
                    class="w-full grid grid-cols-2"
                    :model-value="slot.mode ?? 'add'"
                    @update:model-value="(v) => v && updateSlot({ ...slot, mode: v as 'add' | 'set' })"
                  >
                    <ToggleGroupItem value="add">叠加</ToggleGroupItem>
                    <ToggleGroupItem value="set">覆写</ToggleGroupItem>
                  </ToggleGroup>
                </FormField>
                <FormField
                  label="最小值"
                  class="min-w-0"
                >
                  <NumberField
                    v-model="slot.min"
                    :step="0.1"
                    @update:model-value="updateSlot({ ...slot })"
                  />
                </FormField>
                <FormField
                  label="最大值"
                  class="min-w-0"
                >
                  <NumberField
                    v-model="slot.max"
                    :step="0.1"
                    @update:model-value="updateSlot({ ...slot })"
                  />
                </FormField>
                <FormField
                  label="权重 / 步长"
                  class="min-w-0"
                >
                  <div class="flex items-center gap-1">
                    <NumberField
                      v-model="slot.weight"
                      :min="0"
                      :max="1"
                      :step="0.1"
                      :show-buttons="false"
                      title="权重"
                      @update:model-value="updateSlot({ ...slot })"
                    />
                    <NumberField
                      v-model="slot.step"
                      :min="0.0001"
                      :step="0.01"
                      :show-buttons="false"
                      title="步长"
                      @update:model-value="updateSlot({ ...slot })"
                    />
                  </div>
                </FormField>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </CardContent>
  </Card>
</template>
