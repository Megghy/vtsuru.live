<script setup lang="ts">
import { Copy, GripVertical, Play, Plus, Square, Trash2 } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { z } from 'zod'

import type { VtsMacro, VtsMacroStep } from '@/apps/client/store/useVtsStore'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { macroStepSchema } from '@/apps/client/store/vts/schemas'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { Switch } from '@/shared/ui/switch'
import { Textarea } from '@/shared/ui/textarea'

import { useVtsAction } from './useVtsAction'
import VtsMacroStepEditor from './VtsMacroStepEditor.vue'

const vts = useVtsStore()
const { run } = useVtsAction()

const showEdit = ref(false)
const editingMacro = ref<VtsMacro | null>(null)
const isNewDraft = ref(false)
const macroName = ref('')
const macroSteps = ref<Array<{ id: string; step: VtsMacroStep }>>([])
const showAdvancedJson = ref(false)
const jsonDraft = ref('')

type StepType = VtsMacroStep['type']

const stepTypeOptions: Array<{ key: StepType; label: string }> = [
  { key: 'hotkey', label: '触发热键' },
  { key: 'expression', label: '切换表情' },
  { key: 'clearExpressions', label: '清除所有表情' },
  { key: 'preset', label: '切换机位' },
  { key: 'wait', label: '等待' },
  { key: 'injectParam', label: '注入参数' },
  { key: 'accessory', label: '配饰显隐' },
  { key: 'prank', label: '整活掉落' },
  { key: 'colorTint', label: '模型染色' },
  { key: 'postProcessing', label: '后处理滤镜' },
  { key: 'playAudio', label: '播放音效' },
]

const stepLabelMap: Record<StepType, string> = Object.fromEntries(
  stepTypeOptions.map((o) => [o.key, o.label]),
) as Record<StepType, string>

const firstHotkeyId = computed(() => vts.hotkeys[0]?.hotkeyID ?? '')
const firstExpressionFile = computed(() => vts.expressions[0]?.file ?? '')
const firstPresetId = computed(() => vts.presets[0]?.id ?? '')
const firstAccessoryId = computed(() => vts.accessories[0]?.id ?? '')
const firstPrankId = computed(() => vts.pranks[0]?.id ?? '')

function makeDefaultStep(type: StepType): VtsMacroStep {
  switch (type) {
    case 'hotkey':
      return { type: 'hotkey', hotkeyID: firstHotkeyId.value }
    case 'expression':
      return { type: 'expression', file: firstExpressionFile.value, active: true }
    case 'clearExpressions':
      return { type: 'clearExpressions' }
    case 'preset':
      return { type: 'preset', presetId: firstPresetId.value }
    case 'wait':
      return { type: 'wait', seconds: 0.5 }
    case 'injectParam':
      return {
        type: 'injectParam',
        parameterId: vts.paramSlots?.[0]?.parameterId ?? 'Blush',
        value: 0,
        weight: 1,
        mode: 'add',
      }
    case 'accessory':
      return { type: 'accessory', accessoryId: firstAccessoryId.value, visible: true }
    case 'prank':
      return { type: 'prank', prankId: firstPrankId.value }
    case 'colorTint':
      return { type: 'colorTint', color: '#ff6b9d', rainbow: false, reset: false }
    case 'postProcessing':
      return {
        type: 'postProcessing',
        enabled: true,
        preset: vts.postProcessing?.presets?.[0],
        fadeTime: 0.3,
      }
    case 'playAudio':
      return { type: 'playAudio', url: '', volume: 0.8, waitForEnd: false }
  }
}

function upsertStep(stepId: string, next: VtsMacroStep) {
  const idx = macroSteps.value.findIndex((s) => s.id === stepId)
  if (idx < 0) return
  macroSteps.value[idx] = { ...macroSteps.value[idx]!, step: next }
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

function syncJsonFromSteps() {
  jsonDraft.value = JSON.stringify(
    macroSteps.value.map((s) => s.step),
    null,
    2,
  )
}

watch(showAdvancedJson, (open) => {
  if (open) syncJsonFromSteps()
})

function applyJsonDraft() {
  run(() => {
    const parsed = JSON.parse(jsonDraft.value)
    const validated = z.array(macroStepSchema).parse(parsed)
    macroSteps.value = validated.map((step) => ({ id: `step-${crypto.randomUUID()}`, step }))
  }, '已从 JSON 更新步骤')
}

function openEdit(m: VtsMacro, isNew = false) {
  editingMacro.value = m
  isNewDraft.value = isNew
  macroName.value = m.name
  macroSteps.value = (m.steps ?? []).map((step) => ({ id: `step-${crypto.randomUUID()}`, step: structuredClone(step) }))
  showAdvancedJson.value = false
  showEdit.value = true
}

function addMacro() {
  openEdit(vts.newMacroDraft(), true)
}

function cloneMacro(m: VtsMacro) {
  run(async () => {
    const baseName = m.name.replace(/(\s*\(副本\))+$/, '')
    const draft = vts.newMacroDraft(`${baseName} (副本)`)
    await vts.upsertMacro({
      ...draft,
      steps: structuredClone(m.steps),
    })
  }, '已克隆')
}

function saveMacro() {
  run(async () => {
    if (!editingMacro.value) throw new Error('未选择宏')
    const result = z.array(macroStepSchema).safeParse(macroSteps.value.map((s) => s.step))
    if (!result.success) {
      throw new Error(`步骤配置不完整：${z.prettifyError(result.error)}`)
    }
    await vts.upsertMacro({
      ...editingMacro.value,
      name: macroName.value.trim() || '未命名宏',
      steps: result.data,
    })
    showEdit.value = false
  }, '已保存')
}

function runMacro(macroId: string) {
  run(() => vts.runMacro(macroId), '执行完成')
}

function hasInvalidRef(m: VtsMacro) {
  return m.steps.some((step) => {
    if (step.type === 'preset') return !vts.presets.some((p) => p.id === step.presetId)
    if (step.type === 'accessory') return !vts.accessories.some((a) => a.id === step.accessoryId)
    if (step.type === 'prank') return !vts.pranks.some((p) => p.id === step.prankId)
    if (vts.connected && step.type === 'hotkey') return !vts.hotkeys.some((h) => h.hotkeyID === step.hotkeyID)
    if (vts.connected && step.type === 'expression') return !vts.expressions.some((e) => e.file === step.file)
    return false
  })
}
</script>

<template>
  <Card>
    <CardHeader class="p-3 border-b flex flex-row items-center justify-between gap-2 flex-wrap">
      <div class="flex items-center gap-2">
        <CardTitle>组合动作 (宏)</CardTitle>
        <Badge
          v-if="vts.macros.length > 0"
          variant="secondary"
          size="xs"
          class="tabular-nums"
        >
          {{ vts.macros.length }}
        </Badge>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-[11px] text-muted-foreground">按顺序串行执行，支持中途停止</span>
        <Button
          class="gap-1.5"
          @click="addMacro"
        >
          <Plus class="size-3.5" />
          新建宏
        </Button>
      </div>
    </CardHeader>

    <CardContent class="p-3 space-y-2">
      <div
        v-if="vts.macros.length === 0"
        class="py-6"
      >
        <Empty description="将表情、热键、机位、等待、染色、滤镜与音效编排为一键组合动作">
          <template #extra>
            <Button
              class="gap-1.5"
              @click="addMacro"
            >
              <Plus class="size-3.5" />
              新建宏
            </Button>
          </template>
        </Empty>
      </div>

      <div
        v-for="m in vts.macros"
        :key="m.id"
        class="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-md border border-border bg-muted/20"
      >
        <div class="flex items-center gap-2 min-w-0 flex-wrap">
          <span class="text-xs font-semibold text-foreground">{{ m.name }}</span>
          <Badge
            variant="secondary"
            size="xs"
            class="tabular-nums"
          >
            {{ m.steps?.length ?? 0 }} 步
          </Badge>
          <Badge
            v-if="hasInvalidRef(m)"
            variant="warning"
            size="xs"
          >
            含失效引用
          </Badge>
        </div>

        <div class="flex items-center gap-1.5 flex-wrap">
          <Button
            v-if="vts.macroRunning?.macroId === m.id"
            size="xs"
            variant="destructive"
            class="gap-1"
            @click="vts.stopMacro()"
          >
            <Square class="size-3" />
            停止
          </Button>
          <Button
            v-else
            size="xs"
            class="gap-1"
            :disabled="!vts.connected || Boolean(vts.macroRunning)"
            @click="runMacro(m.id)"
          >
            <Play class="size-3" />
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
            <Copy class="size-3" />
            克隆
          </Button>
          <Popconfirm
            title="确认删除此宏？"
            @confirm="vts.removeMacro(m.id)"
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

  <Dialog v-model:open="showEdit">
    <DialogContent class="sm:max-w-[720px] max-h-[85vh] flex flex-col">
      <DialogHeader>
        <DialogTitle class="text-base">{{ isNewDraft ? '新建宏' : '编辑宏' }}</DialogTitle>
      </DialogHeader>

      <div class="flex-1 overflow-y-auto scrollbar-thin space-y-3 py-2 text-xs pr-1">
        <FormField label="宏名称">
          <Input
            v-model="macroName"
            placeholder="例如：礼物感谢三连"
          />
        </FormField>

        <div class="flex-between gap-2">
          <span class="text-xs text-muted-foreground">拖拽左侧手柄排序，串行执行</span>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                variant="secondary"
                class="gap-1"
              >
                <Plus class="size-3.5" />
                添加步骤
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                v-for="opt in stepTypeOptions"
                :key="opt.key"
                @select="addStep(opt.key)"
              >
                {{ opt.label }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div
          v-if="macroSteps.length === 0"
          class="py-6 border border-dashed border-border rounded-md"
        >
          <Empty description="暂无步骤，点击右上角「添加步骤」编排动作" />
        </div>

        <VueDraggable
          v-else
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
            class="p-2.5 rounded-md border border-border bg-muted/30 space-y-2.5"
          >
            <div class="flex-between gap-2">
              <div class="flex items-center gap-2">
                <span
                  class="macro-step-handle inline-flex-center size-6 rounded cursor-grab active:cursor-grabbing select-none text-muted-foreground hover:text-foreground"
                  title="拖拽排序"
                >
                  <GripVertical class="size-3.5" />
                </span>
                <span class="font-semibold text-xs text-foreground tabular-nums">
                  {{ index + 1 }}. {{ stepLabelMap[element.step.type] ?? '未知' }}
                </span>
                <div class="w-36">
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
                      >
                        {{ o.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                size="icon-xs"
                variant="ghost"
                class="text-destructive hover:bg-destructive/10"
                aria-label="删除步骤"
                @click="removeStep(element.id)"
              >
                <Trash2 class="size-3.5" />
              </Button>
            </div>

            <Separator class="my-1" />

            <VtsMacroStepEditor
              :step="element.step"
              @update="(next) => upsertStep(element.id, next)"
            />
          </div>
        </VueDraggable>

        <div class="flex-between pt-2">
          <label class="flex items-center gap-1.5 cursor-pointer select-none">
            <Switch
              :checked="showAdvancedJson"
              @update:checked="showAdvancedJson = $event"
            />
            <span class="text-muted-foreground">JSON 编辑 / 导入</span>
          </label>
          <Button
            size="xs"
            variant="ghost"
            class="text-muted-foreground"
            :disabled="macroSteps.length === 0"
            @click="macroSteps = []"
          >
            清空步骤
          </Button>
        </div>

        <div
          v-if="showAdvancedJson"
          class="space-y-2"
        >
          <Textarea
            v-model="jsonDraft"
            class="font-mono h-36"
            placeholder="粘贴或编辑宏步骤 JSON 数组"
          />
          <div class="flex justify-end gap-2">
            <Button
              size="xs"
              variant="outline"
              @click="syncJsonFromSteps"
            >
              从步骤刷新
            </Button>
            <Button
              size="xs"
              variant="secondary"
              @click="applyJsonDraft"
            >
              应用 JSON 到步骤
            </Button>
          </div>
        </div>
      </div>

      <DialogFooter class="flex items-center justify-end gap-2 pt-3 border-t border-border">
        <Button
          variant="outline"
          @click="showEdit = false"
        >
          取消
        </Button>
        <Button @click="saveMacro">保存</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
