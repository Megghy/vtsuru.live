<script setup lang="ts">
import {
  NButton,
  NCard,
  NDivider,
  NDropdown,
  NFlex,
  NIcon,
  NInput,
  NInputNumber,
  NModal,
  NPopconfirm,
  NSelect,
  NSwitch,
  NText,
  useMessage,
} from 'naive-ui'
import { computed, ref } from 'vue'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import type { VtsMacro, VtsMacroStep } from '@/apps/client/store/useVtsStore'
import Draggable from 'vuedraggable-es'
import { AddOutline, CloseOutline, ReorderThreeOutline, TrashOutline } from '@vicons/ionicons5'

const vts = useVtsStore()
const message = useMessage()

const showEdit = ref(false)
const editingMacro = ref<VtsMacro | null>(null)
const macroName = ref('')
const macroSteps = ref<Array<{ id: string, step: VtsMacroStep }>>([])
const showAdvancedJson = ref(false)

type StepType = 'hotkey' | 'preset' | 'wait' | 'injectParam' | 'accessory' | 'prank' | 'playAudio'

const stepTypeOptions: Array<{ key: StepType, label: string }> = [
  { key: 'hotkey', label: '触发热键（hotkey）' },
  { key: 'preset', label: '应用机位预设（preset）' },
  { key: 'wait', label: '等待（wait）' },
  { key: 'injectParam', label: '参数注入（injectParam）' },
  { key: 'accessory', label: '配饰显隐（accessory）' },
  { key: 'prank', label: '整活（prank）' },
  { key: 'playAudio', label: '播放音效（playAudio）' },
]

const hotkeyOptions = computed(() => {
  return (vts.hotkeys ?? []).map(h => ({
    label: `${h.name} (${h.hotkeyID})`,
    value: h.hotkeyID,
  }))
})

const presetOptions = computed(() => {
  return (vts.presets ?? []).map(p => ({
    label: `${p.name} (${p.id})`,
    value: p.id,
  }))
})

const accessoryOptions = computed(() => {
  return (vts.accessories ?? []).map(a => ({
    label: `${a.name} (${a.id})`,
    value: a.id,
  }))
})

const prankOptions = computed(() => {
  return (vts.pranks ?? []).map(p => ({
    label: `${p.name} (${p.id})`,
    value: p.id,
  }))
})

function stepLabel(step: VtsMacroStep) {
  if (step.type === 'hotkey') return '触发热键'
  if (step.type === 'preset') return '应用预设'
  if (step.type === 'wait') return '等待'
  if (step.type === 'injectParam') return '参数注入'
  if (step.type === 'accessory') return '配饰显隐'
  if (step.type === 'prank') return '整活'
  if (step.type === 'playAudio') return '播放音效'
  return '未知步骤'
}

function makeDefaultStep(type: StepType): VtsMacroStep {
  if (type === 'hotkey') {
    return { type: 'hotkey', hotkeyID: hotkeyOptions.value[0]?.value ?? '' }
  }
  if (type === 'preset') {
    return { type: 'preset', presetId: presetOptions.value[0]?.value ?? '' }
  }
  if (type === 'wait') {
    return { type: 'wait', seconds: 0.5 }
  }
  if (type === 'injectParam') {
    const defaultParam = vts.paramSlots?.[0]?.parameterId ?? 'Blush'
    return { type: 'injectParam', parameterId: defaultParam, value: 0, weight: 1 }
  }
  if (type === 'accessory') {
    return { type: 'accessory', accessoryId: accessoryOptions.value[0]?.value ?? '', visible: true }
  }
  if (type === 'prank') {
    return { type: 'prank', prankId: prankOptions.value[0]?.value ?? '' }
  }
  return { type: 'playAudio', url: '', volume: 0.8, waitForEnd: false }
}

function upsertMacroStep(stepId: string, next: VtsMacroStep) {
  const idx = macroSteps.value.findIndex(s => s.id === stepId)
  if (idx < 0) return
  const list = macroSteps.value.slice()
  list[idx] = { ...list[idx]!, step: next }
  macroSteps.value = list
}

function setMacroStepType(stepId: string, type: StepType) {
  upsertMacroStep(stepId, makeDefaultStep(type))
}

function addStep(type: StepType) {
  macroSteps.value = [...macroSteps.value, { id: `step-${crypto.randomUUID()}`, step: makeDefaultStep(type) }]
}

function removeStep(stepId: string) {
  macroSteps.value = macroSteps.value.filter(s => s.id !== stepId)
}

function normalizeStep(s: unknown): VtsMacroStep {
  if (!s || typeof s !== 'object') throw new Error('宏步骤必须是对象')
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
    if (typeof step.seconds !== 'number' || !Number.isFinite(step.seconds) || step.seconds < 0) throw new Error('wait.seconds 无效')
    return { type: 'wait', seconds: step.seconds }
  }
  if (step.type === 'injectParam') {
    if (typeof step.parameterId !== 'string' || !step.parameterId) throw new Error('injectParam.parameterId 无效')
    if (typeof step.value !== 'number' || !Number.isFinite(step.value)) throw new Error('injectParam.value 无效')
    if (step.weight !== undefined && (typeof step.weight !== 'number' || !Number.isFinite(step.weight))) throw new Error('injectParam.weight 无效')
    return { type: 'injectParam', parameterId: step.parameterId, value: step.value, weight: step.weight }
  }
  if (step.type === 'accessory') {
    if (typeof step.accessoryId !== 'string' || !step.accessoryId) throw new Error('accessory.accessoryId 无效')
    if (typeof step.visible !== 'boolean') throw new Error('accessory.visible 无效')
    return { type: 'accessory', accessoryId: step.accessoryId, visible: step.visible }
  }
  if (step.type === 'prank') {
    if (typeof step.prankId !== 'string' || !step.prankId) throw new Error('prank.prankId 无效')
    return { type: 'prank', prankId: step.prankId }
  }
  if (step.type === 'playAudio') {
    if (typeof step.url !== 'string' || !step.url) throw new Error('playAudio.url 无效')
    if (step.volume !== undefined && (typeof step.volume !== 'number' || !Number.isFinite(step.volume) || step.volume < 0 || step.volume > 1)) throw new Error('playAudio.volume 无效')
    if (step.waitForEnd !== undefined && typeof step.waitForEnd !== 'boolean') throw new Error('playAudio.waitForEnd 无效')
    return { type: 'playAudio', url: step.url, volume: step.volume, waitForEnd: step.waitForEnd }
  }
  throw new Error(`未知步骤类型: ${String(step.type)}`)
}

const advancedJson = computed(() => {
  return JSON.stringify(macroSteps.value.map(s => s.step), null, 2)
})

function openEdit(m: VtsMacro) {
  editingMacro.value = m
  macroName.value = m.name
  macroSteps.value = (m.steps ?? []).map(step => ({ id: `step-${crypto.randomUUID()}`, step }))
  showEdit.value = true
}

async function addMacro() {
  const m = await vts.createMacro()
  openEdit(m)
}

async function saveMacro() {
  try {
    if (!editingMacro.value) throw new Error('未选择要编辑的宏')
    const validatedSteps: VtsMacroStep[] = macroSteps.value.map(s => normalizeStep(s.step))
    const next: VtsMacro = {
      ...editingMacro.value,
      name: macroName.value.trim() || '未命名宏',
      steps: validatedSteps,
    }
    await vts.upsertMacro(next)
    showEdit.value = false
    message.success('已保存宏')
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
}

async function run(macroId: string) {
  try {
    await vts.runMacro(macroId)
    message.success('宏执行完成')
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
}
</script>

<template>
  <NCard size="small" title="组合动作（Macro）">
    <NFlex vertical :size="8">
      <NFlex align="center" :wrap="true" :size="8">
        <NButton size="small" @click="addMacro">
          新增宏
        </NButton>
        <NText depth="3">
          当前仅支持串行步骤；任一步失败立即终止并报错。
        </NText>
      </NFlex>

      <NDivider style="margin: 4px 0" />

      <NFlex v-for="m in vts.macros" :key="m.id" align="center" justify="space-between" :wrap="true" :size="8">
        <NFlex align="center" :wrap="true" :size="8">
          <NText strong>
            {{ m.name }}
          </NText>
          <NText depth="3">
            steps={{ m.steps?.length ?? 0 }}
          </NText>
        </NFlex>
        <NFlex :wrap="true" :size="8">
          <NButton size="small" type="primary" :disabled="!vts.canOperate" @click="run(m.id)">
            运行
          </NButton>
          <NButton size="small" @click="openEdit(m)">
            编辑
          </NButton>
          <NPopconfirm @positive-click="vts.removeMacro(m.id)">
            <template #trigger>
              <NButton size="small" type="error">
                删除
              </NButton>
            </template>
            确认删除该宏？
          </NPopconfirm>
        </NFlex>
      </NFlex>
    </NFlex>
  </NCard>

  <NModal v-model:show="showEdit" preset="card" title="编辑宏" style="width: 720px">
    <NCard size="small" :bordered="false">
      <NFlex vertical :size="10">
        <NInput v-model:value="macroName" placeholder="宏名称" />
        <NFlex align="center" justify="space-between" :wrap="true" :size="8">
          <NText depth="3">
            拖拽左侧把手调整顺序；串行执行，fail-fast。
          </NText>
          <NDropdown
            trigger="click"
            :options="stepTypeOptions"
            @select="(key: string) => addStep(key as any)"
          >
            <NButton size="small">
              <template #icon>
                <NIcon><AddOutline /></NIcon>
              </template>
              添加步骤
            </NButton>
          </NDropdown>
        </NFlex>

        <Draggable
          v-model="macroSteps"
          item-key="id"
          handle=".macro-step-handle"
          :animation="150"
        >
          <template #item="{ element, index }">
            <NCard size="small" style="border-radius: 10px">
              <NFlex align="center" justify="space-between" :wrap="true" :size="8">
                <NFlex align="center" :wrap="true" :size="8">
                  <span class="macro-step-handle" title="拖拽排序">
                    <NIcon><ReorderThreeOutline /></NIcon>
                  </span>
                  <NText strong>
                    {{ index + 1 }}. {{ stepLabel(element.step) }}
                  </NText>
                  <NSelect
                    size="small"
                    :value="element.step.type"
                    style="min-width: 210px"
                    :options="stepTypeOptions.map(o => ({ label: o.label, value: o.key }))"
                    @update:value="(v: StepType) => setMacroStepType(element.id, v)"
                  />
                </NFlex>
                <NButton size="small" type="error" secondary @click="removeStep(element.id)">
                  <template #icon>
                    <NIcon><TrashOutline /></NIcon>
                  </template>
                  删除
                </NButton>
              </NFlex>

              <NDivider style="margin: 10px 0" />

              <template v-if="element.step.type === 'hotkey'">
                <NFlex :wrap="true" :size="10">
                  <NSelect
                    style="min-width: 420px"
                    placeholder="选择 hotkey"
                    :options="hotkeyOptions"
                    :value="element.step.hotkeyID"
                    @update:value="(v: string) => upsertMacroStep(element.id, { type: 'hotkey', hotkeyID: v })"
                  />
                </NFlex>
              </template>

              <template v-else-if="element.step.type === 'preset'">
                <NFlex :wrap="true" :size="10">
                  <NSelect
                    style="min-width: 420px"
                    placeholder="选择预设"
                    :options="presetOptions"
                    :value="element.step.presetId"
                    @update:value="(v: string) => upsertMacroStep(element.id, { type: 'preset', presetId: v })"
                  />
                </NFlex>
              </template>

              <template v-else-if="element.step.type === 'wait'">
                <NFlex align="center" :wrap="true" :size="10">
                  <NText depth="3">
                    等待秒数
                  </NText>
                  <NInputNumber
                    :value="element.step.seconds"
                    :min="0"
                    :step="0.1"
                    style="width: 180px"
                    @update:value="(v) => upsertMacroStep(element.id, { type: 'wait', seconds: Number(v ?? 0) })"
                  />
                </NFlex>
              </template>

              <template v-else-if="element.step.type === 'injectParam'">
                <NFlex :wrap="true" :size="10">
                  <NInput
                    style="min-width: 260px"
                    placeholder="parameterId（如 Blush）"
                    :value="element.step.parameterId"
                    @update:value="(v: string) => upsertMacroStep(element.id, { ...element.step, parameterId: v })"
                  />
                  <NInputNumber
                    style="width: 160px"
                    placeholder="value"
                    :value="element.step.value"
                    @update:value="(v) => upsertMacroStep(element.id, { ...element.step, value: Number(v ?? 0) })"
                  />
                  <NInputNumber
                    style="width: 160px"
                    placeholder="weight"
                    :value="element.step.weight ?? 1"
                    :min="0"
                    :step="0.1"
                    @update:value="(v) => upsertMacroStep(element.id, { ...element.step, weight: Number(v ?? 1) })"
                  />
                </NFlex>
              </template>

              <template v-else-if="element.step.type === 'accessory'">
                <NFlex align="center" :wrap="true" :size="10">
                  <NSelect
                    style="min-width: 360px"
                    placeholder="选择配饰"
                    :options="accessoryOptions"
                    :value="element.step.accessoryId"
                    @update:value="(v: string) => upsertMacroStep(element.id, { ...element.step, accessoryId: v })"
                  />
                  <NText depth="3">
                    显示
                  </NText>
                  <NSwitch
                    :value="element.step.visible"
                    @update:value="(v: boolean) => upsertMacroStep(element.id, { ...element.step, visible: v })"
                  />
                </NFlex>
              </template>

              <template v-else-if="element.step.type === 'prank'">
                <NFlex :wrap="true" :size="10">
                  <NSelect
                    style="min-width: 420px"
                    placeholder="选择整活"
                    :options="prankOptions"
                    :value="element.step.prankId"
                    @update:value="(v: string) => upsertMacroStep(element.id, { ...element.step, prankId: v })"
                  />
                </NFlex>
              </template>

              <template v-else-if="element.step.type === 'playAudio'">
                <NFlex :wrap="true" :size="10">
                  <NInput
                    style="min-width: 360px"
                    placeholder="音效 URL"
                    :value="element.step.url"
                    @update:value="(v: string) => upsertMacroStep(element.id, { ...element.step, url: v })"
                  />
                  <NInputNumber
                    style="width: 160px"
                    placeholder="volume"
                    :min="0"
                    :max="1"
                    :step="0.05"
                    :value="element.step.volume ?? 0.8"
                    @update:value="(v) => upsertMacroStep(element.id, { ...element.step, volume: Number(v ?? 0.8) })"
                  />
                  <NText depth="3">
                    等待播放结束
                  </NText>
                  <NSwitch
                    :value="element.step.waitForEnd ?? false"
                    @update:value="(v: boolean) => upsertMacroStep(element.id, { ...element.step, waitForEnd: v })"
                  />
                </NFlex>
              </template>
            </NCard>
          </template>
        </Draggable>

        <NDivider style="margin: 8px 0" />

        <NFlex align="center" justify="space-between" :wrap="true" :size="8">
          <NFlex align="center" :wrap="true" :size="8">
            <NSwitch v-model:value="showAdvancedJson" />
            <NText depth="3">
              高级：查看 steps JSON（只读）
            </NText>
          </NFlex>
          <NButton size="small" secondary @click="macroSteps = []">
            <template #icon>
              <NIcon><CloseOutline /></NIcon>
            </template>
            清空步骤
          </NButton>
        </NFlex>

        <NInput v-if="showAdvancedJson" type="textarea" :rows="8" :value="advancedJson" readonly />

        <NFlex justify="end" :size="8">
          <NButton @click="showEdit = false">
            取消
          </NButton>
          <NButton type="primary" @click="saveMacro">
            保存
          </NButton>
        </NFlex>
      </NFlex>
    </NCard>
  </NModal>
</template>

<style scoped>
.macro-step-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  cursor: grab;
  user-select: none;
  opacity: 0.85;
}
.macro-step-handle:active {
  cursor: grabbing;
}
</style>
