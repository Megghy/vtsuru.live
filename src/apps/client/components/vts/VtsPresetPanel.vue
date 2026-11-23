<script setup lang="ts">
import { Crosshair, Play, Plus } from 'lucide-vue-next'
import { computed, reactive, ref } from 'vue'

import type { VtsPreset } from '@/apps/client/store/useVtsStore'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { newDeckTile } from '@/apps/client/store/vts/deck'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Popconfirm } from '@/shared/ui/popconfirm'

import { useVtsAction } from './useVtsAction'

const vts = useVtsStore()
const { run } = useVtsAction()

const showEdit = ref(false)
const isNewDraft = ref(false)
const form = reactive<VtsPreset>({
  id: '',
  name: '',
  timeInSeconds: 0.2,
  positionX: 0,
  positionY: 0,
  rotation: 0,
  size: 0,
})

function openEdit(preset: VtsPreset, isNew = false) {
  isNewDraft.value = isNew
  Object.assign(form, preset)
  showEdit.value = true
}

function saveEdit() {
  run(
    () =>
      vts.upsertPreset({
        ...form,
        name: form.name.trim() || '未命名机位',
      }),
    '已保存',
  )
  showEdit.value = false
}

function addPreset() {
  openEdit(vts.newPresetDraft(), true)
}

const canReadCurrent = computed(() => Boolean(vts.currentModelTransform))

function fillFromCurrent() {
  if (!vts.currentModelTransform) throw new Error('暂无模型位姿数据，请确认 VTS 已连接并加载了模型')
  form.positionX = Number(vts.currentModelTransform.positionX.toFixed(3))
  form.positionY = Number(vts.currentModelTransform.positionY.toFixed(3))
  form.rotation = Number(vts.currentModelTransform.rotation.toFixed(1))
  form.size = Number(vts.currentModelTransform.size.toFixed(1))
}

function addFromCurrent() {
  run(async () => {
    if (!vts.currentModelTransform && vts.connected) {
      await vts.refreshCurrentModel()
    }
    const draft = vts.newPresetDraft()
    openEdit(draft, true)
    fillFromCurrent()
  })
}

function addToDeck(p: VtsPreset) {
  run(() => vts.upsertDeckTile(newDeckTile('preset', p.id, p.name, '机位')), '已加入操作台')
}
</script>

<template>
  <Card>
    <CardHeader class="p-3 border-b flex flex-row items-center justify-between gap-2 flex-wrap">
      <div class="flex items-center gap-2">
        <CardTitle>机位预设</CardTitle>
        <Badge
          v-if="vts.presets.length > 0"
          variant="secondary"
          size="xs"
          class="tabular-nums"
        >
          {{ vts.presets.length }}
        </Badge>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          class="gap-1.5"
          :disabled="!vts.connected"
          @click="addFromCurrent"
        >
          <Crosshair class="size-3.5" />
          从当前位置创建
        </Button>
        <Button
          class="gap-1.5"
          @click="addPreset"
        >
          <Plus class="size-3.5" />
          新建预设
        </Button>
      </div>
    </CardHeader>

    <CardContent class="p-3 space-y-2">
      <div
        v-if="vts.presets.length === 0"
        class="py-6"
      >
        <Empty description="保存常用机位坐标（杂谈、游戏、特写等），支持一键切换或 OBS 联动" />
      </div>

      <div
        v-for="p in vts.presets"
        :key="p.id"
        class="flex-between gap-3 flex-wrap p-2.5 rounded-md border border-border bg-muted/20"
      >
        <div class="flex items-center gap-2.5 flex-wrap text-xs">
          <span class="font-semibold text-foreground">{{ p.name }}</span>
          <span class="text-[11px] text-muted-foreground tabular-nums font-mono">
            x={{ p.positionX.toFixed(2) }} · y={{ p.positionY.toFixed(2) }} · rot={{ p.rotation.toFixed(1) }}° · size={{
              p.size.toFixed(1)
            }}
            · {{ p.timeInSeconds }}s
          </span>
        </div>

        <div class="flex items-center gap-1.5 flex-wrap">
          <Button
            size="xs"
            class="gap-1"
            :disabled="!vts.connected"
            @click="run(() => vts.applyPreset(p.id), '已应用')"
          >
            <Play class="size-3" />
            应用
          </Button>
          <Button
            size="xs"
            variant="outline"
            @click="addToDeck(p)"
          >
            加入操作台
          </Button>
          <Button
            size="xs"
            variant="outline"
            @click="openEdit(p)"
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除此机位预设？"
            @confirm="vts.removePreset(p.id)"
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
    </CardContent>
  </Card>

  <Dialog
    :open="showEdit"
    @update:open="(val) => (showEdit = val)"
  >
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle class="text-base">{{ isNewDraft ? '新建机位预设' : '编辑机位预设' }}</DialogTitle>
      </DialogHeader>
      <div class="flex flex-col gap-3 py-2">
        <FormField label="预设名称">
          <Input
            v-model="form.name"
            placeholder="例如：杂谈居中 / 游戏右下角"
          />
        </FormField>

        <div class="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            class="gap-1.5"
            :disabled="!canReadCurrent && !vts.connected"
            @click="
              run(async () => {
                if (!vts.currentModelTransform) await vts.refreshCurrentModel()
                fillFromCurrent()
              }, '已填入当前位姿')
            "
          >
            <Crosshair class="size-3.5" />
            读取当前模型位置
          </Button>
          <span class="text-[11px] text-muted-foreground">连接 VTS 后可直接采集模型当前坐标与缩放</span>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-3 gap-2.5">
          <FormField
            label="过渡时间 (s)"
            class="min-w-0"
          >
            <NumberField
              v-model="form.timeInSeconds"
              :min="0"
              :step="0.05"
            />
          </FormField>
          <FormField
            label="X 坐标"
            class="min-w-0"
          >
            <NumberField
              v-model="form.positionX"
              :step="0.01"
            />
          </FormField>
          <FormField
            label="Y 坐标"
            class="min-w-0"
          >
            <NumberField
              v-model="form.positionY"
              :step="0.01"
            />
          </FormField>
          <FormField
            label="旋转 (°)"
            class="min-w-0"
          >
            <NumberField
              v-model="form.rotation"
              :step="0.5"
            />
          </FormField>
          <FormField
            label="缩放大小"
            class="min-w-0"
          >
            <NumberField
              v-model="form.size"
              :step="0.5"
            />
          </FormField>
        </div>
      </div>
      <DialogFooter class="flex justify-end gap-2 pt-2">
        <Button
          variant="outline"
          @click="showEdit = false"
        >
          取消
        </Button>
        <Button @click="saveEdit">保存</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
