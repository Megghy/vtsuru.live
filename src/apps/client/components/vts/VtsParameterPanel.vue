<script setup lang="ts">
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import type { VtsParamSlot } from '@/apps/client/store/useVtsStore'

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
  <UCard
    size="small"
    bordered
    title="参数控制"
  >
    <div
      vertical
      :size="8"
    >
      <div
        align="center"
        :wrap="true"
        :size="8"
      >
        <UButton
          size="small"
          @click="addSlot"
        >
          添加参数槽
        </UButton>
        <UButton
          size="small"
          :disabled="!vts.canOperate"
          @click="vts.stopAllParamHolds"
        >
          全部停止持有
        </UButton>
        <span depth="3"> Hold 模式会持续注入参数值 </span>
      </div>

      <USeparator style="margin: 4px 0" />

      <div
        v-for="slot in vts.paramSlots"
        :key="slot.id"
        class="param-slot"
      >
        <div
          align="center"
          justify="space-between"
          :wrap="true"
          :size="8"
        >
          <div
            align="center"
            :size="8"
          >
            <span strong>
              {{ slot.name || slot.parameterId }}
            </span>
            <span
              v-if="slot.name"
              depth="3"
            >
              {{ slot.parameterId }}
            </span>
          </div>
          <div
            :wrap="true"
            :size="8"
            align="center"
          >
            <USwitch
              :model-value="slot.hold"
              :disabled="!vts.canOperate"
              @update:model-value="(val) => updateSlot({ ...slot, hold: val })"
            >
              <template v-if="false"> Hold </template>
              <template v-if="false"> Hold </template>
            </USwitch>
            <UButton
              size="small"
              :disabled="!vts.canOperate"
              @click="injectOnce(slot)"
            >
              注入
            </UButton>
            <UPopover>
              <UButton
                size="sm"
                color="error"
              >
                删除
              </UButton>
              <template #content="{ close }">
                <div class="space-y-3 p-3">
                  <div>确认删除?</div>
                  <div class="flex justify-end gap-2">
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      @click="close"
                      >取消</UButton
                    >
                    <UButton
                      size="xs"
                      color="error"
                      @click="(close(), vts.removeParamSlot(slot.id))"
                      >确认</UButton
                    >
                  </div>
                </div>
              </template>
            </UPopover>
          </div>
        </div>

        <div
          align="center"
          :wrap="true"
          :size="12"
          style="margin-top: 8px"
        >
          <USlider
            style="min-width: 320px; flex: 1"
            :value="slot.value"
            :min="slot.min"
            :max="slot.max"
            :step="slot.step"
            :disabled="!vts.canOperate"
            @update:value="
              (val) => {
                slot.value = val as number
              }
            "
            @change="() => updateSlot({ ...slot })"
          />
          <UInputNumber
            :value="slot.value"
            :min="slot.min"
            :max="slot.max"
            :step="slot.step"
            :disabled="!vts.canOperate"
            style="width: 140px"
            @update:value="
              (val) => {
                slot.value = (val ?? 0) as number
              }
            "
            @blur="() => updateSlot({ ...slot })"
          />
        </div>

        <div style="margin-top: 6px">
          <details
            title="参数配置"
            name="config"
          >
            <div
              :wrap="true"
              :size="12"
              align="center"
            >
              <UInput
                v-model="slot.name"
                placeholder="显示名"
                style="width: 140px"
                @blur="updateSlot({ ...slot })"
              />
              <UInput
                v-model="slot.parameterId"
                placeholder="参数 ID"
                style="width: 180px"
                @blur="updateSlot({ ...slot })"
              />
              <UInputNumber
                v-model="slot.weight"
                :min="0"
                :step="0.1"
                placeholder="权重"
                style="width: 120px"
                @blur="updateSlot({ ...slot })"
              />
              <UInputNumber
                v-model="slot.min"
                :step="0.1"
                placeholder="最小值"
                style="width: 120px"
                @blur="updateSlot({ ...slot })"
              />
              <UInputNumber
                v-model="slot.max"
                :step="0.1"
                placeholder="最大值"
                style="width: 120px"
                @blur="updateSlot({ ...slot })"
              />
              <UInputNumber
                v-model="slot.step"
                :min="0.0001"
                :step="0.01"
                placeholder="步长"
                style="width: 120px"
                @blur="updateSlot({ ...slot })"
              />
            </div>
          </details>
        </div>
      </div>
    </div>
  </UCard>
</template>

<style scoped>
.param-slot {
  padding: 12px;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
}
</style>
