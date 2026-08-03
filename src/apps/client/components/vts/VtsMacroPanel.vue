<script setup lang="ts">
const AddOutline = 'i-lucide-circle'
const CopyOutline = 'i-lucide-circle'
const ReorderThreeOutline = 'i-lucide-circle'
const TrashOutline = 'i-lucide-circle'
import { computed, ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import { useVtsStore } from '@/apps/client/store/useVtsStore'
import type { VtsMacro, VtsMacroStep } from '@/apps/client/store/useVtsStore'

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
  <UCard
    size="small"
    bordered
    title="组合动作 (宏)"
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
          @click="addMacro"
        >
          新建宏
        </UButton>
        <span depth="3"> 按顺序执行所有步骤，任一步失败即终止 </span>
      </div>

      <USeparator style="margin: 4px 0" />

      <div
        v-for="m in vts.macros"
        :key="m.id"
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
            {{ m.name }}
          </span>
          <span depth="3"> {{ m.steps?.length ?? 0 }} 步 </span>
        </div>
        <div
          :wrap="true"
          :size="8"
        >
          <UButton
            size="small"
            color="primary"
            :disabled="!vts.canOperate"
            @click="runMacro(m.id)"
          >
            运行
          </UButton>
          <UButton
            size="small"
            @click="openEdit(m)"
          >
            编辑
          </UButton>
          <UButton
            size="small"
            @click="cloneMacro(m)"
          >
            <template #leading>
              <span><CopyOutline /></span>
            </template>
            克隆
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
                <div>确认删除此宏?</div>
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
                    @click="(close(), vts.removeMacro(m.id))"
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
    title="编辑宏"
    style="width: 720px"
  >
    <div
      vertical
      :size="12"
    >
      <UInput
        v-model="macroName"
        placeholder="宏名称"
      />
      <div
        align="center"
        justify="space-between"
        :wrap="true"
        :size="8"
      >
        <span depth="3"> 拖拽排序，串行执行 </span>
        <UDropdownMenu
          trigger="click"
          :items="stepTypeOptions"
          @select="(key: string) => addStep(key as StepType)"
        >
          <UButton size="small">
            <template #leading>
              <span><AddOutline /></span>
            </template>
            添加步骤
          </UButton>
        </UDropdownMenu>
      </div>

      <VueDraggable
        v-model="macroSteps"
        handle=".macro-step-handle"
        :animation="150"
      >
        <UCard
          v-for="(element, index) in macroSteps"
          :key="element.id"
          size="small"
          style="border-radius: var(--vtsuru-radius); margin-bottom: 8px"
        >
          <div
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
              <span
                class="macro-step-handle"
                title="拖拽排序"
              >
                <span><ReorderThreeOutline /></span>
              </span>
              <span strong> {{ index + 1 }}. {{ stepLabelMap[element.step.type] ?? '未知' }} </span>
              <USelectMenu
                size="small"
                :value="element.step.type"
                style="min-width: 180px"
                :items="stepTypeOptions.map((o) => ({ label: o.label, value: o.key }))"
                @update:value="(v: StepType) => setStepType(element.id, v)"
                value-key="value"
              />
            </div>
            <UButton
              size="small"
              color="error"
              variant="soft"
              @click="removeStep(element.id)"
            >
              <template #leading>
                <span><TrashOutline /></span>
              </template>
            </UButton>
          </div>

          <USeparator style="margin: 8px 0" />

          <div
            v-if="element.step.type === 'hotkey'"
            :wrap="true"
            :size="12"
          >
            <USelectMenu
              style="min-width: 380px"
              placeholder="选择热键"
              :items="hotkeyOptions"
              :value="element.step.hotkeyID"
              @update:value="(v: string) => upsertStep(element.id, { type: 'hotkey', hotkeyID: v })"
              value-key="value"
            />
          </div>

          <div
            v-else-if="element.step.type === 'preset'"
            :wrap="true"
            :size="12"
          >
            <USelectMenu
              style="min-width: 380px"
              placeholder="选择预设"
              :items="presetOptions"
              :value="element.step.presetId"
              @update:value="(v: string) => upsertStep(element.id, { type: 'preset', presetId: v })"
              value-key="value"
            />
          </div>

          <div
            v-else-if="element.step.type === 'wait'"
            align="center"
            :wrap="true"
            :size="12"
          >
            <span depth="3"> 等待 </span>
            <UInputNumber
              :value="element.step.seconds"
              :min="0"
              :step="0.1"
              style="width: 160px"
              @update:value="(v) => upsertStep(element.id, { type: 'wait', seconds: Number(v ?? 0) })"
            />
            <span depth="3"> 秒 </span>
          </div>

          <div
            v-else-if="element.step.type === 'injectParam'"
            :wrap="true"
            :size="12"
          >
            <UInput
              style="min-width: 220px"
              placeholder="参数 ID"
              :value="element.step.parameterId"
              @update:value="(v: string) => patchStep(element.id, { parameterId: v })"
            />
            <UInputNumber
              style="width: 140px"
              placeholder="值"
              :value="element.step.value"
              @update:value="(v) => patchStep(element.id, { value: Number(v ?? 0) })"
            />
            <UInputNumber
              style="width: 140px"
              placeholder="权重"
              :value="element.step.weight ?? 1"
              :min="0"
              :step="0.1"
              @update:value="(v) => patchStep(element.id, { weight: Number(v ?? 1) })"
            />
          </div>

          <div
            v-else-if="element.step.type === 'accessory'"
            align="center"
            :wrap="true"
            :size="12"
          >
            <USelectMenu
              style="min-width: 320px"
              placeholder="选择配饰"
              :items="accessoryOptions"
              :value="element.step.accessoryId"
              @update:value="(v: string) => patchStep(element.id, { accessoryId: v })"
              value-key="value"
            />
            <USwitch
              :model-value="element.step.visible"
              @update:model-value="(v: boolean) => patchStep(element.id, { visible: v })"
            >
              <template v-if="false"> 显示 </template>
              <template v-if="false"> 隐藏 </template>
            </USwitch>
          </div>

          <div
            v-else-if="element.step.type === 'prank'"
            :wrap="true"
            :size="12"
          >
            <USelectMenu
              style="min-width: 380px"
              placeholder="选择整活"
              :items="prankOptions"
              :value="element.step.prankId"
              @update:value="(v: string) => patchStep(element.id, { prankId: v })"
              value-key="value"
            />
          </div>

          <div
            v-else-if="element.step.type === 'playAudio'"
            :wrap="true"
            :size="12"
          >
            <UInput
              style="min-width: 320px"
              placeholder="音效 URL"
              :value="element.step.url"
              @update:value="(v: string) => patchStep(element.id, { url: v })"
            />
            <UInputNumber
              style="width: 130px"
              placeholder="音量"
              :min="0"
              :max="1"
              :step="0.05"
              :value="element.step.volume ?? 0.8"
              @update:value="(v) => patchStep(element.id, { volume: Number(v ?? 0.8) })"
            />
            <USwitch
              :model-value="element.step.waitForEnd ?? false"
              @update:model-value="(v: boolean) => patchStep(element.id, { waitForEnd: v })"
            >
              <template v-if="false"> 等待结束 </template>
              <template v-if="false"> 不等待 </template>
            </USwitch>
          </div>
        </UCard>
      </VueDraggable>

      <USeparator style="margin: 4px 0" />

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
          <USwitch
            v-model="showAdvancedJson"
            size="small"
          />
          <span depth="3"> JSON 预览 </span>
        </div>
        <UButton
          size="small"
          variant="soft"
          @click="macroSteps = []"
        >
          清空步骤
        </UButton>
      </div>

      <UInput
        v-if="showAdvancedJson"
        type="textarea"
        :rows="6"
        :value="advancedJson"
        readonly
      />

      <div
        justify="end"
        :size="8"
      >
        <UButton @click="showEdit = false"> 取消 </UButton>
        <UButton
          color="primary"
          @click="saveMacro"
        >
          保存
        </UButton>
      </div>
    </div>
  </UModal>
</template>

<style scoped>
.macro-step-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--vtsuru-radius);
  cursor: grab;
  user-select: none;
  opacity: 0.85;
}
.macro-step-handle:active {
  cursor: grabbing;
}
</style>
