<script setup lang="ts">
import type { VtsPreset } from '@/apps/client/store/useVtsStore'
import { NButton, NCard, NDivider, NFlex, NInput, NInputNumber, NModal, NPopconfirm, NText, useMessage } from 'naive-ui';
import { computed, reactive, ref } from 'vue'
import { useVtsStore } from '@/apps/client/store/useVtsStore'

const vts = useVtsStore()
const message = useMessage()

const editing = ref<VtsPreset | null>(null)
const showEdit = ref(false)
const form = reactive<VtsPreset>({
  id: '',
  name: '',
  timeInSeconds: 0.2,
  positionX: 0,
  positionY: 0,
  rotation: 0,
  size: 0,
})

function openEdit(preset: VtsPreset) {
  editing.value = preset
  Object.assign(form, preset)
  showEdit.value = true
}

async function saveEdit() {
  await vts.upsertPreset({ ...form })
  showEdit.value = false
  message.success('已保存预设')
}

async function addPreset() {
  const p = await vts.createPreset()
  openEdit(p)
}

const canReadCurrent = computed(() => !!vts.currentModelTransform)

function fillFromCurrent() {
  if (!vts.currentModelTransform) {
    throw new Error('暂无当前模型位姿数据（请先连接并鉴权，等待 ModelMovedEvent）')
  }
  form.positionX = vts.currentModelTransform.positionX
  form.positionY = vts.currentModelTransform.positionY
  form.rotation = vts.currentModelTransform.rotation
  form.size = vts.currentModelTransform.size
}

async function addPresetFromCurrent() {
  const p = await vts.createPreset()
  openEdit(p)
  fillFromCurrent()
}

function handleFillFromCurrent() {
  try {
    fillFromCurrent()
    message.success('已填入当前位姿')
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
}

async function applyPreset(presetId: string) {
  try {
    await vts.applyPreset(presetId)
    message.success('已应用预设')
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
}
</script>

<template>
  <NCard size="small" title="机位预设（MoveModel）">
    <NFlex vertical :size="8">
      <NFlex align="center" :wrap="true" :size="8">
        <NButton size="small" @click="addPreset">
          新增预设
        </NButton>
        <NButton size="small" :disabled="!canReadCurrent" @click="addPresetFromCurrent">
          从当前创建
        </NButton>
        <NText depth="3">
          支持在编辑弹窗内一键填入当前模型位姿（来自 ModelMovedEvent）。
        </NText>
      </NFlex>

      <NDivider style="margin: 4px 0" />

      <NFlex v-for="p in vts.presets" :key="p.id" align="center" justify="space-between" :wrap="true" :size="8">
        <NFlex align="center" :wrap="true" :size="8">
          <NText strong>
            {{ p.name }}
          </NText>
          <NText depth="3">
            x={{ p.positionX }}, y={{ p.positionY }}, rot={{ p.rotation }}, size={{ p.size }}, t={{ p.timeInSeconds }}s
          </NText>
        </NFlex>
        <NFlex :wrap="true" :size="8">
          <NButton size="small" type="primary" :disabled="!vts.canOperate" @click="applyPreset(p.id)">
            应用
          </NButton>
          <NButton size="small" @click="openEdit(p)">
            编辑
          </NButton>
          <NPopconfirm @positive-click="vts.removePreset(p.id)">
            <template #trigger>
              <NButton size="small" type="error">
                删除
              </NButton>
            </template>
            确认删除该预设？
          </NPopconfirm>
        </NFlex>
      </NFlex>
    </NFlex>
  </NCard>

  <NModal v-model:show="showEdit" preset="card" title="编辑预设" style="width: 560px">
    <NCard size="small" :bordered="false">
      <NFlex vertical :size="10">
        <NInput v-model:value="form.name" placeholder="预设名称" />
        <NFlex align="center" :wrap="true" :size="8">
          <NButton size="small" :disabled="!canReadCurrent" @click="handleFillFromCurrent">
            填入当前位姿
          </NButton>
          <NText depth="3">
            需要 VTS 已鉴权并收到模型移动事件。
          </NText>
        </NFlex>
        <NFlex :wrap="true" :size="10">
          <NInputNumber v-model:value="form.timeInSeconds" :min="0" :step="0.05" placeholder="timeInSeconds" style="width: 160px" />
          <NInputNumber v-model:value="form.positionX" :step="0.01" placeholder="positionX" style="width: 160px" />
          <NInputNumber v-model:value="form.positionY" :step="0.01" placeholder="positionY" style="width: 160px" />
          <NInputNumber v-model:value="form.rotation" :step="0.1" placeholder="rotation" style="width: 160px" />
          <NInputNumber v-model:value="form.size" :step="0.5" placeholder="size" style="width: 160px" />
        </NFlex>
        <NFlex justify="end" :size="8">
          <NButton @click="showEdit = false">
            取消
          </NButton>
          <NButton type="primary" @click="saveEdit">
            保存
          </NButton>
        </NFlex>
      </NFlex>
    </NCard>
  </NModal>
</template>
