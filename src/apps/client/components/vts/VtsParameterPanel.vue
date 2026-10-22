<script setup lang="ts">
import type { VtsParamSlot } from '@/apps/client/store/useVtsStore'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Slider } from '@/shared/ui/slider'
import { Switch } from '@/shared/ui/switch'

import { useVtsAction } from './useVtsAction'

const vts = useVtsStore()
const { run } = useVtsAction()

async function updateSlot(next: VtsParamSlot) {
  await vts.upsertParamSlot(next)
  if (next.hold) {
    vts.startParamHold(next.id)
  } else {
    vts.stopParamHold(next.id)
  }
}

function injectOnce(slot: VtsParamSlot) {
  run(() => vts.injectParametersAdd([{ id: slot.parameterId, value: slot.value, weight: slot.weight }]), '已注入')
}

function addSlot() {
  run(() => vts.createParamSlot(), '已添加')
}
</script>

<template>
  <Card class="border bg-card">
    <CardHeader class="p-3 pb-2 border-b flex flex-row items-center justify-between">
      <CardTitle class="text-sm font-semibold">参数控制</CardTitle>
      <div class="flex items-center gap-2">
        <Button @click="addSlot"> 添加参数槽 </Button>
        <Button
          variant="outline"
          :disabled="!vts.connected"
          @click="vts.stopAllParamHolds"
        >
          全部停止持有
        </Button>
        <span class="text-xs text-muted-foreground"> Hold 模式会持续注入参数值 </span>
      </div>
    </CardHeader>

    <CardContent class="p-3 space-y-3">
      <div
        v-for="slot in vts.paramSlots"
        :key="slot.id"
        class="param-slot space-y-2.5"
      >
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-foreground">
              {{ slot.name || slot.parameterId }}
            </span>
            <span
              v-if="slot.name"
              class="text-xs text-muted-foreground"
            >
              {{ slot.parameterId }}
            </span>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <div class="flex items-center gap-1.5 cursor-pointer select-none">
              <Switch
                :checked="slot.hold"
                :disabled="!vts.connected"
                @update:checked="(val) => updateSlot({ ...slot, hold: val })"
              />
              <span class="text-xs text-muted-foreground">Hold</span>
            </div>
            <Button
              size="xs"
              variant="outline"
              :disabled="!vts.connected"
              @click="injectOnce(slot)"
            >
              注入
            </Button>
            <Popconfirm
              title="确认删除"
              @positive-click="vts.removeParamSlot(slot.id)"
            >
              <template #trigger>
                <Button
                  size="xs"
                  variant="outline"
                  class="border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  删除
                </Button>
              </template>
              确认删除?
            </Popconfirm>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <div class="flex-1 min-w-[200px]">
            <Slider
              :model-value="[slot.value]"
              :min="slot.min"
              :max="slot.max"
              :step="slot.step"
              :disabled="!vts.connected"
              @update:model-value="
                (val) => {
                  if (val?.[0] !== undefined) {
                    slot.value = val[0]
                    updateSlot({ ...slot })
                  }
                }
              "
            />
          </div>
          <NInputNumber
            :value="slot.value"
            :min="slot.min"
            :max="slot.max"
            :step="slot.step"
            :disabled="!vts.connected"
            size="small"
            class="w-28"
            @update:value="
              (val) => {
                slot.value = (val ?? 0) as number
                updateSlot({ ...slot })
              }
            "
          />
        </div>

        <details class="group text-xs pt-1">
          <summary
            class="cursor-pointer font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 select-none"
          >
            <span>参数配置</span>
            <span class="transition-transform group-open:rotate-180 text-[10px]">▾</span>
          </summary>
          <div class="flex flex-wrap items-center gap-2 pt-2 border-t mt-2">
            <Input
              v-model="slot.name"
              placeholder="显示名"
              class="w-28"
              @blur="updateSlot({ ...slot })"
            />
            <Input
              v-model="slot.parameterId"
              placeholder="参数 ID"
              class="w-36"
              @blur="updateSlot({ ...slot })"
            />
            <div class="flex items-center gap-1">
              <span class="text-muted-foreground">权重:</span>
              <NInputNumber
                v-model="slot.weight"
                :min="0"
                :step="0.1"
                placeholder="权重"
                size="small"
                class="w-20"
                @update:value="updateSlot({ ...slot })"
              />
            </div>
            <div class="flex items-center gap-1">
              <span class="text-muted-foreground">最小:</span>
              <NInputNumber
                v-model="slot.min"
                :step="0.1"
                placeholder="最小值"
                size="small"
                class="w-20"
                @update:value="updateSlot({ ...slot })"
              />
            </div>
            <div class="flex items-center gap-1">
              <span class="text-muted-foreground">最大:</span>
              <NInputNumber
                v-model="slot.max"
                :step="0.1"
                placeholder="最大值"
                size="small"
                class="w-20"
                @update:value="updateSlot({ ...slot })"
              />
            </div>
            <div class="flex items-center gap-1">
              <span class="text-muted-foreground">步长:</span>
              <NInputNumber
                v-model="slot.step"
                :min="0.0001"
                :step="0.01"
                placeholder="步长"
                size="small"
                class="w-20"
                @update:value="updateSlot({ ...slot })"
              />
            </div>
          </div>
        </details>
      </div>
    </CardContent>
  </Card>
</template>

<style scoped>
.param-slot {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--muted);
}
</style>
