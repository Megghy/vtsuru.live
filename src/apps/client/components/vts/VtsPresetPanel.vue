<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

import type { VtsPreset } from '@/apps/client/store/useVtsStore'
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
  <UCard
    size="small"
    bordered
    title="机位预设"
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
          @click="addPreset"
        >
          新建预设
        </UButton>
        <UButton
          size="small"
          :disabled="!canReadCurrent"
          @click="addFromCurrent"
        >
          从当前位置创建
        </UButton>
      </div>

      <USeparator style="margin: 4px 0" />

      <div
        v-for="p in vts.presets"
        :key="p.id"
        align="center"
        justify="space-between"
        :wrap="true"
        :size="8"
      >
        <div
          align="center"
          :wrap="true"
          :size="8"
        >
          <span strong>
            {{ p.name }}
          </span>
          <span depth="3">
            x={{ p.positionX.toFixed(2) }} y={{ p.positionY.toFixed(2) }} rot={{ p.rotation.toFixed(1) }} size={{
              p.size.toFixed(1)
            }}
            t={{ p.timeInSeconds }}s
          </span>
        </div>
        <div
          :wrap="true"
          :size="8"
        >
          <UButton
            size="small"
            color="primary"
            :disabled="!vts.canOperate"
            @click="run(() => vts.applyPreset(p.id), '已应用')"
          >
            应用
          </UButton>
          <UButton
            size="small"
            @click="openEdit(p)"
          >
            编辑
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
                <div>确认删除此预设?</div>
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
                    @click="(close(), vts.removePreset(p.id))"
                    >确认</UButton
                  >
                </div>
              </div>
            </template>
          </UPopover>
        </div>
      </div>
    </div>
  </UCard>

  <UModal
    v-model:open="showEdit"
    preset="card"
    title="编辑机位预设"
    style="width: 560px"
  >
    <div
      vertical
      :size="12"
    >
      <UInput
        v-model="form.name"
        placeholder="预设名称"
      />
      <div
        align="center"
        :wrap="true"
        :size="8"
      >
        <UButton
          size="small"
          :disabled="!canReadCurrent"
          @click="
            run(() => {
              fillFromCurrent()
            }, '已填入当前位姿')
          "
        >
          填入当前位置
        </UButton>
        <span depth="3"> 需要 VTS 已鉴权且模型有移动事件 </span>
      </div>
      <div
        :wrap="true"
        :size="12"
      >
        <UInputNumber
          v-model="form.timeInSeconds"
          :min="0"
          :step="0.05"
          placeholder="过渡时间(s)"
          style="width: 150px"
        />
        <UInputNumber
          v-model="form.positionX"
          :step="0.01"
          placeholder="X"
          style="width: 130px"
        />
        <UInputNumber
          v-model="form.positionY"
          :step="0.01"
          placeholder="Y"
          style="width: 130px"
        />
        <UInputNumber
          v-model="form.rotation"
          :step="0.1"
          placeholder="旋转"
          style="width: 130px"
        />
        <UInputNumber
          v-model="form.size"
          :step="0.5"
          placeholder="大小"
          style="width: 130px"
        />
      </div>
      <div
        justify="end"
        :size="8"
      >
        <UButton @click="showEdit = false"> 取消 </UButton>
        <UButton
          color="primary"
          @click="saveEdit"
        >
          保存
        </UButton>
      </div>
    </div>
  </UModal>
</template>
