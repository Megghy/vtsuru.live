<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

import type { VtsPreset } from '@/apps/client/store/useVtsStore'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Separator } from '@/shared/ui/separator'

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
  <Card>
    <CardHeader class="py-3 px-4">
      <CardTitle class="text-sm font-semibold">机位预设</CardTitle>
    </CardHeader>
    <CardContent class="px-4 pb-4 pt-0 flex flex-col gap-2.5">
      <div class="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          class="h-8 text-xs"
          @click="addPreset"
        >
          新建预设
        </Button>
        <Button
          size="sm"
          variant="outline"
          class="h-8 text-xs"
          :disabled="!canReadCurrent"
          @click="addFromCurrent"
        >
          从当前位置创建
        </Button>
      </div>

      <Separator />

      <div class="flex flex-col gap-2">
        <div
          v-for="p in vts.presets"
          :key="p.id"
          class="flex items-center justify-between gap-2 flex-wrap py-1 border-b border-[var(--vtsuru-border)] last:border-0"
        >
          <div class="flex items-center gap-2 flex-wrap text-xs">
            <span class="font-bold text-[var(--vtsuru-fg)]">{{ p.name }}</span>
            <span class="text-[var(--vtsuru-fg-muted)]">
              x={{ p.positionX.toFixed(2) }} y={{ p.positionY.toFixed(2) }} rot={{ p.rotation.toFixed(1) }} size={{ p.size.toFixed(1) }} t={{ p.timeInSeconds }}s
            </span>
          </div>

          <div class="flex items-center gap-1.5 flex-wrap">
            <Button
              size="sm"
              class="h-7 text-xs"
              :disabled="!vts.connected"
              @click="run(() => vts.applyPreset(p.id), '已应用')"
            >
              应用
            </Button>
            <Button
              size="sm"
              variant="outline"
              class="h-7 text-xs"
              @click="openEdit(p)"
            >
              编辑
            </Button>
            <Popconfirm
              title="确认删除此预设?"
              @confirm="vts.removePreset(p.id)"
            >
              <Button
                size="sm"
                variant="destructive"
                class="h-7 text-xs"
              >
                删除
              </Button>
            </Popconfirm>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>

  <Dialog
    :open="showEdit"
    @update:open="(val) => showEdit = val"
  >
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle class="text-base font-semibold">编辑机位预设</DialogTitle>
      </DialogHeader>
      <div class="flex flex-col gap-3 py-2 text-xs">
        <Input
          v-model="form.name"
          placeholder="预设名称"
          class="h-8 text-xs"
        />

        <div class="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            class="h-7 text-xs"
            :disabled="!canReadCurrent"
            @click="run(() => { fillFromCurrent() }, '已填入当前位姿')"
          >
            填入当前位置
          </Button>
          <span class="text-[11px] text-[var(--vtsuru-fg-muted)]">需要 VTS 已鉴权且模型有移动事件</span>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-3 gap-2.5">
          <div class="space-y-1">
            <label class="text-[11px] text-[var(--vtsuru-fg-muted)]">过渡时间 (s)</label>
            <NInputNumber
              v-model="form.timeInSeconds"
              :min="0"
              :step="0.05"
              placeholder="过渡时间(s)"
              class="h-8 text-xs"
            />
          </div>
          <div class="space-y-1">
            <label class="text-[11px] text-[var(--vtsuru-fg-muted)]">X 坐标</label>
            <NInputNumber
              v-model="form.positionX"
              :step="0.01"
              placeholder="X"
              class="h-8 text-xs"
            />
          </div>
          <div class="space-y-1">
            <label class="text-[11px] text-[var(--vtsuru-fg-muted)]">Y 坐标</label>
            <NInputNumber
              v-model="form.positionY"
              :step="0.01"
              placeholder="Y"
              class="h-8 text-xs"
            />
          </div>
          <div class="space-y-1">
            <label class="text-[11px] text-[var(--vtsuru-fg-muted)]">旋转</label>
            <NInputNumber
              v-model="form.rotation"
              :step="0.1"
              placeholder="旋转"
              class="h-8 text-xs"
            />
          </div>
          <div class="space-y-1">
            <label class="text-[11px] text-[var(--vtsuru-fg-muted)]">缩放大小</label>
            <NInputNumber
              v-model="form.size"
              :step="0.5"
              placeholder="大小"
              class="h-8 text-xs"
            />
          </div>
        </div>
      </div>
      <DialogFooter class="flex justify-end gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          @click="showEdit = false"
        >
          取消
        </Button>
        <Button
          size="sm"
          @click="saveEdit"
        >
          保存
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
