<script setup lang="ts">
import { NButton, NCard, NCollapse, NCollapseItem, NDivider, NFlex, NInput, NInputNumber, NPopconfirm, NSlider, NSwitch, NText } from 'naive-ui'
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
  <NCard size="small" bordered title="参数控制">
    <NFlex vertical :size="8">
      <NFlex align="center" :wrap="true" :size="8">
        <NButton size="small" @click="addSlot">
          添加参数槽
        </NButton>
        <NButton size="small" :disabled="!vts.canOperate" @click="vts.stopAllParamHolds">
          全部停止持有
        </NButton>
        <NText depth="3">
          Hold 模式会持续注入参数值
        </NText>
      </NFlex>

      <NDivider style="margin: 4px 0" />

      <div v-for="slot in vts.paramSlots" :key="slot.id" class="param-slot">
        <NFlex align="center" justify="space-between" :wrap="true" :size="8">
          <NFlex align="center" :size="8">
            <NText strong>
              {{ slot.name || slot.parameterId }}
            </NText>
            <NText v-if="slot.name" depth="3">
              {{ slot.parameterId }}
            </NText>
          </NFlex>
          <NFlex :wrap="true" :size="8" align="center">
            <NSwitch
              :value="slot.hold"
              :disabled="!vts.canOperate"
              @update:value="(val) => updateSlot({ ...slot, hold: val })"
            >
              <template #checked>
                Hold
              </template>
              <template #unchecked>
                Hold
              </template>
            </NSwitch>
            <NButton size="small" :disabled="!vts.canOperate" @click="injectOnce(slot)">
              注入
            </NButton>
            <NPopconfirm @positive-click="vts.removeParamSlot(slot.id)">
              <template #trigger>
                <NButton size="small" type="error">
                  删除
                </NButton>
              </template>
              确认删除?
            </NPopconfirm>
          </NFlex>
        </NFlex>

        <NFlex align="center" :wrap="true" :size="12" style="margin-top: 8px">
          <NSlider
            style="min-width: 320px; flex: 1"
            :value="slot.value"
            :min="slot.min"
            :max="slot.max"
            :step="slot.step"
            :disabled="!vts.canOperate"
            @update:value="(val) => { slot.value = val as number }"
            @change="() => updateSlot({ ...slot })"
          />
          <NInputNumber
            :value="slot.value"
            :min="slot.min"
            :max="slot.max"
            :step="slot.step"
            :disabled="!vts.canOperate"
            style="width: 140px"
            @update:value="(val) => { slot.value = (val ?? 0) as number }"
            @blur="() => updateSlot({ ...slot })"
          />
        </NFlex>

        <NCollapse style="margin-top: 6px">
          <NCollapseItem title="参数配置" name="config">
            <NFlex :wrap="true" :size="12" align="center">
              <NInput v-model:value="slot.name" placeholder="显示名" style="width: 140px" @blur="updateSlot({ ...slot })" />
              <NInput v-model:value="slot.parameterId" placeholder="参数 ID" style="width: 180px" @blur="updateSlot({ ...slot })" />
              <NInputNumber v-model:value="slot.weight" :min="0" :step="0.1" placeholder="权重" style="width: 120px" @blur="updateSlot({ ...slot })" />
              <NInputNumber v-model:value="slot.min" :step="0.1" placeholder="最小值" style="width: 120px" @blur="updateSlot({ ...slot })" />
              <NInputNumber v-model:value="slot.max" :step="0.1" placeholder="最大值" style="width: 120px" @blur="updateSlot({ ...slot })" />
              <NInputNumber v-model:value="slot.step" :min="0.0001" :step="0.01" placeholder="步长" style="width: 120px" @blur="updateSlot({ ...slot })" />
            </NFlex>
          </NCollapseItem>
        </NCollapse>
      </div>
    </NFlex>
  </NCard>
</template>

<style scoped>
.param-slot {
  padding: 12px;
  border: 1px solid var(--n-border-color);
  border-radius: var(--n-border-radius);
}
</style>