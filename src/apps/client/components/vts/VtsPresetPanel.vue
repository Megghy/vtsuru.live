<script setup lang="ts">
import type { VtsPreset } from '@/apps/client/store/useVtsStore'
import { NButton, NCard, NDivider, NFlex, NInput, NInputNumber, NModal, NPopconfirm, NText } from 'naive-ui'
import { computed, reactive, ref } from 'vue'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { useVtsAction } from './useVtsAction'

const vts = useVtsStore()
const { run } = useVtsAction()

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
  Object.assign(form, preset)
  showEdit.value = true
}

function saveEdit() {
  run(() => vts.upsertPreset({ ...form }), '已保存')
  showEdit.value = false
}

function addPreset() {
  run(async () => {
    const p = await vts.createPreset()
    openEdit(p)
  })
}

const canReadCurrent = computed(() => !!vts.currentModelTransform)

function fillFromCurrent() {
  if (!vts.currentModelTransform) throw new Error('暂无模型位姿数据，请先连接并等待模型移动事件')
  form.positionX = vts.currentModelTransform.positionX
  form.positionY = vts.currentModelTransform.positionY
  form.rotation = vts.currentModelTransform.rotation
  form.size = vts.currentModelTransform.size
}

function addFromCurrent() {
  run(async () => {
    const p = await vts.createPreset()
    openEdit(p)
    fillFromCurrent()
  })
}
</script>

<template>
  <NCard size="small" bordered title="机位预设">
    <NFlex vertical :size="8">
      <NFlex align="center" :wrap="true" :size="8">
        <NButton size="small" @click="addPreset">
          新建预设
        </NButton>
        <NButton size="small" :disabled="!canReadCurrent" @click="addFromCurrent">
          从当前位置创建
        </NButton>
      </NFlex>

      <NDivider style="margin: 4px 0" />

      <NFlex v-for="p in vts.presets" :key="p.id" align="center" justify="space-between" :wrap="true" :size="8">
        <NFlex align="center" :wrap="true" :size="8">
          <NText strong>
            {{ p.name }}
          </NText>
          <NText depth="3">
            x={{ p.positionX.toFixed(2) }} y={{ p.positionY.toFixed(2) }} rot={{ p.rotation.toFixed(1) }} size={{ p.size.toFixed(1) }} t={{ p.timeInSeconds }}s
          </NText>
        </NFlex>
        <NFlex :wrap="true" :size="8">
          <NButton size="small" type="primary" :disabled="!vts.canOperate" @click="run(() => vts.applyPreset(p.id), '已应用')">
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
            确认删除此预设?
          </NPopconfirm>
        </NFlex>
      </NFlex>
    </NFlex>
  </NCard>

  <NModal v-model:show="showEdit" preset="card" title="编辑机位预设" style="width: 560px">
    <NFlex vertical :size="12">
      <NInput v-model:value="form.name" placeholder="预设名称" />
      <NFlex align="center" :wrap="true" :size="8">
        <NButton size="small" :disabled="!canReadCurrent" @click="run(() => { fillFromCurrent() }, '已填入当前位姿')">
          填入当前位置
        </NButton>
        <NText depth="3">
          需要 VTS 已鉴权且模型有移动事件
        </NText>
      </NFlex>
      <NFlex :wrap="true" :size="12">
        <NInputNumber v-model:value="form.timeInSeconds" :min="0" :step="0.05" placeholder="过渡时间(s)" style="width: 150px" />
        <NInputNumber v-model:value="form.positionX" :step="0.01" placeholder="X" style="width: 130px" />
        <NInputNumber v-model:value="form.positionY" :step="0.01" placeholder="Y" style="width: 130px" />
        <NInputNumber v-model:value="form.rotation" :step="0.1" placeholder="旋转" style="width: 130px" />
        <NInputNumber v-model:value="form.size" :step="0.5" placeholder="大小" style="width: 130px" />
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
  </NModal>
</template>
