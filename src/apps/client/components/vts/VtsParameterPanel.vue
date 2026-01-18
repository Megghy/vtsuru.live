<script setup lang="ts">
import { NButton, NCard, NDivider, NFlex, NInput, NInputNumber, NPopconfirm, NSlider, NSwitch, NText, useMessage } from 'naive-ui';
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import type { VtsParamSlot } from '@/apps/client/store/useVtsStore'

const vts = useVtsStore()
const message = useMessage()

async function updateSlot(next: VtsParamSlot) {
  await vts.upsertParamSlot(next)
  if (next.hold) {
    vts.startParamHold(next.id)
  } else {
    vts.stopParamHold(next.id)
  }
}

async function injectOnce(slot: VtsParamSlot) {
  try {
    await vts.injectParametersAdd([{ id: slot.parameterId, value: slot.value, weight: slot.weight }])
    message.success('已注入')
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
}

async function addSlot() {
  await vts.createParamSlot()
  message.success('已新增参数槽')
}
</script>

<template>
  <NCard size="small" title="参数手动控制（mode=add）">
    <NFlex vertical :size="8">
      <NFlex align="center" :wrap="true" :size="8">
        <NButton size="small" @click="addSlot">
          新增参数槽
        </NButton>
        <NButton size="small" :disabled="!vts.canOperate" @click="vts.stopAllParamHolds">
          一键解除全部持有
        </NButton>
        <NText depth="3">
          参数 ID 需按模型实际填写；持有(Hold)会持续注入，失败将自动停止并报错。
        </NText>
      </NFlex>

      <NDivider style="margin: 4px 0" />

      <NFlex v-for="slot in vts.paramSlots" :key="slot.id" vertical :size="10" class="param-slot">
        <NFlex align="center" justify="space-between" :wrap="true" :size="8">
          <NText strong>
            {{ slot.name }}
          </NText>
          <NFlex :wrap="true" :size="8" align="center">
            <NText depth="3">
              {{ slot.parameterId }}
            </NText>
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
              注入一次
            </NButton>
            <NPopconfirm @positive-click="vts.removeParamSlot(slot.id)">
              <template #trigger>
                <NButton size="small" type="error">
                  删除
                </NButton>
              </template>
              确认删除该参数槽？
            </NPopconfirm>
          </NFlex>
        </NFlex>

        <NFlex :wrap="true" :size="10" align="center">
          <NInput v-model:value="slot.name" placeholder="显示名" style="width: 160px" @blur="updateSlot({ ...slot })" />
          <NInput v-model:value="slot.parameterId" placeholder="参数 ID" style="width: 200px" @blur="updateSlot({ ...slot })" />
          <NInputNumber v-model:value="slot.weight" :min="0" :step="0.1" style="width: 140px" @blur="updateSlot({ ...slot })" />
          <NInputNumber v-model:value="slot.min" :step="0.1" style="width: 140px" @blur="updateSlot({ ...slot })" />
          <NInputNumber v-model:value="slot.max" :step="0.1" style="width: 140px" @blur="updateSlot({ ...slot })" />
          <NInputNumber v-model:value="slot.step" :min="0.0001" :step="0.01" style="width: 140px" @blur="updateSlot({ ...slot })" />
        </NFlex>

        <NFlex align="center" :wrap="true" :size="12">
          <NSlider
            style="min-width: 360px"
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
            style="width: 160px"
            @update:value="(val) => { slot.value = (val ?? 0) as number }"
            @blur="() => updateSlot({ ...slot })"
          />
        </NFlex>
      </NFlex>
    </NFlex>
  </NCard>
</template>

<style scoped>
.param-slot {
  padding: 10px;
  border: 1px solid var(--n-border-color);
  border-radius: var(--n-border-radius);
}
</style>
