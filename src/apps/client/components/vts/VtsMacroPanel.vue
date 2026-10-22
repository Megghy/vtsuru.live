<script setup lang="ts">
import { AddOutline, CopyOutline, ReorderThreeOutline, TrashOutline } from '@vicons/ionicons5'
import { computed, ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import type { VtsMacro, VtsMacroStep } from '@/apps/client/store/useVtsStore'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'
import { Input } from '@/shared/ui/input'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import { Textarea } from '@/shared/ui/textarea'

import { useVtsAction } from './useVtsAction'

const vts = useVtsStore()
const { run } = useVtsAction()

const showEdit = ref(false)
const editingMacro = ref<VtsMacro | null>(null)
const macroName = ref('')
const macroSteps = ref<Array<{ id: string; step: VtsMacroStep }>>([])
const showAdvancedJson = ref(false)

type StepType = VtsMacroStep['type']

const stepTypeOptions: Array<{ key: StepType; label: string }> = [
  { key: 'hotkey', label: '触发热键' },
  { key: 'preset', label: '切换机位' },
  { key: 'wait', label: '等待' },
  { key: 'injectParam', label: '注入参数' },
  { key: 'accessory', label: '配饰显隐' },
  { key: 'prank', label: '整活掉落' },
  { key: 'playAudio', label: '播放音效' },
]

const hotkeyOptions = computed(() =>
  vts.hotkeys.map((h) => ({ label: `${h.name} (${h.hotkeyID.slice(0, 8)})`, value: h.hotkeyID })),
)
const presetOptions = computed(() => vts.presets.map((p) => ({ label: p.name, value: p.id })))
const accessoryOptions = computed(() => vts.accessories.map((a) => ({ label: a.name, value: a.id })))
const prankOptions = computed(() => vts.pranks.map((p) => ({ label: p.name, value: p.id })))

const stepLabelMap: Record<StepType, string> = {
  hotkey: '触发热键',
  preset: '切换机位',
  wait: '等待',
  injectParam: '注入参数',
  accessory: '配饰显隐',
  prank: '整活掉落',
  playAudio: '播放音效',
}

function makeDefaultStep(type: StepType): VtsMacroStep {
  if (type === 'hotkey') return { type: 'hotkey', hotkeyID: hotkeyOptions.value[0]?.value ?? '' }
  if (type === 'preset') return { type: 'preset', presetId: presetOptions.value[0]?.value ?? '' }
  if (type === 'wait') return { type: 'wait', seconds: 0.5 }
  if (type === 'injectParam')
    return { type: 'injectParam', parameterId: vts.paramSlots?.[0]?.parameterId ?? 'Blush', value: 0, weight: 1 }
  if (type === 'accessory')
    return { type: 'accessory', accessoryId: accessoryOptions.value[0]?.value ?? '', visible: true }
  if (type === 'prank') return { type: 'prank', prankId: prankOptions.value[0]?.value ?? '' }
  return { type: 'playAudio', url: '', volume: 0.8, waitForEnd: false }
}

function upsertStep(stepId: string, next: VtsMacroStep) {
  const idx = macroSteps.value.findIndex((s) => s.id === stepId)
  if (idx < 0) return
  macroSteps.value[idx] = { ...macroSteps.value[idx]!, step: next }
}

function patchStep(stepId: string, patch: Record<string, unknown>) {
  const current = macroSteps.value.find((s) => s.id === stepId)?.step
  if (!current) return
  upsertStep(stepId, { ...current, ...patch } as VtsMacroStep)
}

function setStepType(stepId: string, type: StepType) {
  upsertStep(stepId, makeDefaultStep(type))
}

function addStep(type: StepType) {
  macroSteps.value = [...macroSteps.value, { id: `step-${crypto.randomUUID()}`, step: makeDefaultStep(type) }]
}

function removeStep(stepId: string) {
  macroSteps.value = macroSteps.value.filter((s) => s.id !== stepId)
}

function normalizeStep(s: unknown): VtsMacroStep {
  if (!s || typeof s !== 'object') throw new Error('步骤必须是对象')
  const step = s as any
  if (step.type === 'hotkey') {
    if (typeof step.hotkeyID !== 'string' || !step.hotkeyID) throw new Error('hotkey.hotkeyID 无效')
    return { type: 'hotkey', hotkeyID: step.hotkeyID }
  }
  if (step.type === 'preset') {
    if (typeof step.presetId !== 'string' || !step.presetId) throw new Error('preset.presetId 无效')
    return { type: 'preset', presetId: step.presetId }
  }
  if (step.type === 'wait') {
    if (typeof step.seconds !== 'number' || !Number.isFinite(step.seconds) || step.seconds < 0)
      throw new Error('wait.seconds 无效')
    return { type: 'wait', seconds: step.seconds }
  }
  if (step.type === 'injectParam') {
    if (typeof step.parameterId !== 'string' || !step.parameterId) throw new Error('injectParam.parameterId 无效')
    if (typeof step.value !== 'number' || !Number.isFinite(step.value)) throw new Error('injectParam.value 无效')
    return { type: 'injectParam', parameterId: step.parameterId, value: step.value, weight: step.weight }
  }
  if (step.type === 'accessory') {
    if (typeof step.accessoryId !== 'string' || !step.accessoryId) throw new Error('accessory.accessoryId 无效')
    return { type: 'accessory', accessoryId: step.accessoryId, visible: step.visible }
  }
  if (step.type === 'prank') {
    if (typeof step.prankId !== 'string' || !step.prankId) throw new Error('prank.prankId 无效')
    return { type: 'prank', prankId: step.prankId }
  }
  if (step.type === 'playAudio') {
    if (typeof step.url !== 'string' || !step.url) throw new Error('playAudio.url 无效')
    if (
      step.volume != null &&
      (typeof step.volume !== 'number' || !Number.isFinite(step.volume) || step.volume < 0 || step.volume > 1)
    )
      throw new Error('playAudio.volume 必须在 [0,1] 范围内')
    if (step.waitForEnd != null && typeof step.waitForEnd !== 'boolean')
      throw new Error('playAudio.waitForEnd 必须是布尔值')
    return { type: 'playAudio', url: step.url, volume: step.volume, waitForEnd: step.waitForEnd }
  }
  throw new Error(`未知步骤类型: ${String(step.type)}`)
}

const advancedJson = computed(() =>
  JSON.stringify(
    macroSteps.value.map((s) => s.step),
    null,
    2,
  ),
)

function openEdit(m: VtsMacro) {
  editingMacro.value = m
  macroName.value = m.name
  macroSteps.value = (m.steps ?? []).map((step) => ({ id: `step-${crypto.randomUUID()}`, step }))
  showEdit.value = true
}

function addMacro() {
  run(async () => {
    const m = await vts.createMacro()
    openEdit(m)
  })
}

function cloneMacro(m: VtsMacro) {
  run(async () => {
    const cloned = await vts.createMacro()
    const baseName = m.name.replace(/(\s*\(副本\))+$/, '')
    await vts.upsertMacro({
      ...cloned,
      name: `${baseName} (副本)`,
      steps: structuredClone(m.steps),
    })
  }, '已克隆')
}

function saveMacro() {
  run(async () => {
    if (!editingMacro.value) throw new Error('未选择宏')
    const validatedSteps = macroSteps.value.map((s) => normalizeStep(s.step))
    await vts.upsertMacro({
      ...editingMacro.value,
      name: macroName.value.trim() || '未命名宏',
      steps: validatedSteps,
    })
    showEdit.value = false
  }, '已保存')
}

function runMacro(macroId: string) {
  run(() => vts.runMacro(macroId), '执行完成')
}
</script>

<template>
  <Card class="border bg-card">
    <CardHeader class="p-3 pb-2 border-b flex flex-row items-center justify-between">
      <CardTitle class="text-sm font-semibold">组合动作 (宏)</CardTitle>
      <div class="flex items-center gap-2">
        <Button @click="addMacro"> 新建宏 </Button>
        <span class="text-xs text-muted-foreground"> 按顺序执行所有步骤，任一步失败即终止 </span>
      </div>
    </CardHeader>

    <CardContent class="p-3 space-y-2">
      <div
        v-for="m in vts.macros"
        :key="m.id"
        class="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-md border bg-muted/20"
      >
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold text-foreground">{{ m.name }}</span>
          <span class="text-xs text-muted-foreground">{{ m.steps?.length ?? 0 }} 步</span>
        </div>

        <div class="flex items-center gap-1.5 flex-wrap">
          <Button
            size="xs"
            :disabled="!vts.connected"
            @click="runMacro(m.id)"
          >
            运行
          </Button>
          <Button
            size="xs"
            variant="outline"
            @click="openEdit(m)"
          >
            编辑
          </Button>
          <Button
            size="xs"
            variant="outline"
            class="gap-1"
            @click="cloneMacro(m)"
          >
            <CopyOutline class="size-3" />
            克隆
          </Button>
          <Popconfirm
            title="确认删除"
            @positive-click="vts.removeMacro(m.id)"
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
            确认删除此宏？
          </Popconfirm>
        </div>
      </div>
    </CardContent>
  </Card>

  <Dialog v-model:open="showEdit">
    <DialogContent class="sm:max-w-[700px] max-h-[85vh] flex flex-col">
      <DialogHeader>
        <DialogTitle class="text-base font-semibold">编辑宏</DialogTitle>
      </DialogHeader>

      <div class="flex-1 overflow-y-auto space-y-3 pt-2 text-xs pr-1">
        <Input
          v-model="macroName"
          placeholder="宏名称"
        />

        <div class="flex items-center justify-between gap-2">
          <span class="text-xs text-muted-foreground">拖拽排序，串行执行</span>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                variant="secondary"
                class="gap-1"
              >
                <AddOutline class="size-3.5" />
                添加步骤
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                v-for="opt in stepTypeOptions"
                :key="opt.key"
                class="text-xs"
                @select="addStep(opt.key)"
              >
                {{ opt.label }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <VueDraggable
          v-model="macroSteps"
          handle=".macro-step-handle"
          :animation="150"
          force-fallback
          :fallback-tolerance="4"
          class="space-y-2"
        >
          <div
            v-for="(element, index) in macroSteps"
            :key="element.id"
            class="p-2.5 rounded-md border bg-muted/30 space-y-2.5"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span
                  class="macro-step-handle"
                  title="拖拽排序"
                >
                  <ReorderThreeOutline class="size-4 text-muted-foreground" />
                </span>
                <span class="font-semibold text-xs text-foreground">
                  {{ index + 1 }}. {{ stepLabelMap[element.step.type] ?? '未知' }}
                </span>
                <div class="w-[140px]">
                  <Select
                    :model-value="element.step.type"
                    @update:model-value="(v) => setStepType(element.id, v as StepType)"
                  >
                    <SelectTrigger
                      size="xs"
                      class="w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="o in stepTypeOptions"
                        :key="o.key"
                        :value="o.key"
                        class="text-xs"
                      >
                        {{ o.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                size="xs"
                variant="ghost"
                class="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                @click="removeStep(element.id)"
              >
                <TrashOutline class="size-3.5" />
              </Button>
            </div>

            <div class="h-px bg-border my-1" />

            <!-- hotkey -->
            <div
              v-if="element.step.type === 'hotkey'"
              class="w-full"
            >
              <Select
                :model-value="element.step.hotkeyID"
                @update:model-value="(v) => upsertStep(element.id, { type: 'hotkey', hotkeyID: String(v ?? '') })"
              >
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="选择热键" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="h in hotkeyOptions"
                    :key="h.value"
                    :value="h.value"
                    class="text-xs"
                  >
                    {{ h.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- preset -->
            <div
              v-else-if="element.step.type === 'preset'"
              class="w-full"
            >
              <Select
                :model-value="element.step.presetId"
                @update:model-value="(v) => upsertStep(element.id, { type: 'preset', presetId: String(v ?? '') })"
              >
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="选择预设" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="p in presetOptions"
                    :key="p.value"
                    :value="p.value"
                    class="text-xs"
                  >
                    {{ p.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- wait -->
            <div
              v-else-if="element.step.type === 'wait'"
              class="flex items-center gap-2"
            >
              <span class="text-muted-foreground">等待</span>
              <NInputNumber
                :value="element.step.seconds"
                :min="0"
                :step="0.1"
                size="small"
                class="w-28"
                @update:value="(v) => upsertStep(element.id, { type: 'wait', seconds: Number(v ?? 0) })"
              />
              <span class="text-muted-foreground">秒</span>
            </div>

            <!-- injectParam -->
            <div
              v-else-if="element.step.type === 'injectParam'"
              class="flex flex-wrap items-center gap-2"
            >
              <Input
                :value="element.step.parameterId"
                placeholder="参数 ID"
                class="w-40"
                @input="patchStep(element.id, { parameterId: ($event.target as HTMLInputElement).value })"
              />
              <NInputNumber
                :value="element.step.value"
                placeholder="值"
                size="small"
                class="w-24"
                @update:value="(v) => patchStep(element.id, { value: Number(v ?? 0) })"
              />
              <NInputNumber
                :value="element.step.weight ?? 1"
                placeholder="权重"
                :min="0"
                :step="0.1"
                size="small"
                class="w-24"
                @update:value="(v) => patchStep(element.id, { weight: Number(v ?? 1) })"
              />
            </div>

            <!-- accessory -->
            <div
              v-else-if="element.step.type === 'accessory'"
              class="flex items-center gap-3 flex-wrap"
            >
              <div class="w-64">
                <Select
                  :model-value="element.step.accessoryId"
                  @update:model-value="(v) => patchStep(element.id, { accessoryId: v })"
                >
                  <SelectTrigger class="w-full">
                    <SelectValue placeholder="选择配饰" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="a in accessoryOptions"
                      :key="a.value"
                      :value="a.value"
                      class="text-xs"
                    >
                      {{ a.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="flex items-center gap-1.5 cursor-pointer select-none">
                <Switch
                  :checked="element.step.visible"
                  @update:checked="(v: boolean) => patchStep(element.id, { visible: v })"
                />
                <span class="text-muted-foreground">{{ element.step.visible ? '显示' : '隐藏' }}</span>
              </div>
            </div>

            <!-- prank -->
            <div
              v-else-if="element.step.type === 'prank'"
              class="w-full"
            >
              <Select
                :model-value="element.step.prankId"
                @update:model-value="(v) => patchStep(element.id, { prankId: v })"
              >
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="选择整活" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="p in prankOptions"
                    :key="p.value"
                    :value="p.value"
                    class="text-xs"
                  >
                    {{ p.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- playAudio -->
            <div
              v-else-if="element.step.type === 'playAudio'"
              class="flex flex-wrap items-center gap-2"
            >
              <Input
                :value="element.step.url"
                placeholder="音效 URL"
                class="flex-1 min-w-[200px]"
                @input="patchStep(element.id, { url: ($event.target as HTMLInputElement).value })"
              />
              <NInputNumber
                :value="element.step.volume ?? 0.8"
                placeholder="音量"
                :min="0"
                :max="1"
                :step="0.05"
                size="small"
                class="w-24"
                @update:value="(v) => patchStep(element.id, { volume: Number(v ?? 0.8) })"
              />
              <div class="flex items-center gap-1.5 cursor-pointer select-none">
                <Switch
                  :checked="element.step.waitForEnd ?? false"
                  @update:checked="(v: boolean) => patchStep(element.id, { waitForEnd: v })"
                />
                <span class="text-muted-foreground">等待结束</span>
              </div>
            </div>
          </div>
        </VueDraggable>

        <div class="flex items-center justify-between pt-2">
          <div class="flex items-center gap-1.5 cursor-pointer select-none">
            <Switch
              :checked="showAdvancedJson"
              @update:checked="showAdvancedJson = $event"
            />
            <span class="text-muted-foreground">JSON 预览</span>
          </div>
          <Button
            size="xs"
            variant="ghost"
            class="h-6 text-muted-foreground"
            @click="macroSteps = []"
          >
            清空步骤
          </Button>
        </div>

        <Textarea
          v-if="showAdvancedJson"
          :value="advancedJson"
          readonly
          class="font-mono text-xs h-32"
        />
      </div>

      <div class="flex items-center justify-end gap-2 pt-3 border-t">
        <Button
          variant="ghost"
          @click="showEdit = false"
        >
          取消
        </Button>
        <Button @click="saveMacro"> 保存 </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.macro-step-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius);
  cursor: grab;
  user-select: none;
}
.macro-step-handle:active {
  cursor: grabbing;
}
</style>
