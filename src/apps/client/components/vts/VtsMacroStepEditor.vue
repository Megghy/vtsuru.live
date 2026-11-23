<script setup lang="ts">
import { FolderOpen, Volume2 } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import { resolveAudioPlayUrl } from '@/apps/client/store/autoAction/modules/audioPlayer'
import type { VtsMacroStep } from '@/apps/client/store/useVtsStore'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { isTauri } from '@/shared/config'
import { Button } from '@/shared/ui/button'
import { ColorPicker } from '@/shared/ui/color-picker'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

import { useVtsAction } from './useVtsAction'

const props = defineProps<{
  step: VtsMacroStep
}>()

const emit = defineEmits<{
  (e: 'update', next: VtsMacroStep): void
}>()

const vts = useVtsStore()
const { run, message } = useVtsAction()
const testingAudio = ref(false)

const hotkeyOptions = computed(() =>
  vts.hotkeys.map((h) => ({ label: `${h.name} (${h.hotkeyID.slice(0, 8)})`, value: h.hotkeyID })),
)
const expressionOptions = computed(() => vts.expressions.map((e) => ({ label: e.name, value: e.file })))
const presetOptions = computed(() => vts.presets.map((p) => ({ label: p.name, value: p.id })))
const accessoryOptions = computed(() => vts.accessories.map((a) => ({ label: a.name, value: a.id })))
const prankOptions = computed(() => vts.pranks.map((p) => ({ label: p.name, value: p.id })))
const paramOptions = computed(() =>
  vts.inputParameters.map((p) => ({ label: `${p.name} [${p.min}~${p.max}]`, value: p.name })),
)
const postProcessingPresetOptions = computed(() =>
  (vts.postProcessing?.presets ?? []).map((p) => ({ label: p, value: p })),
)
const audioStep = computed(() => (props.step.type === 'playAudio' ? props.step : null))

function patch(fields: Record<string, unknown>) {
  emit('update', { ...props.step, ...fields } as VtsMacroStep)
}

async function pickLocalAudio() {
  if (!isTauri()) {
    message.info('本地文件选择仅在桌面客户端可用')
    return
  }
  await run(async () => {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({
      multiple: false,
      title: '选择音效文件',
      filters: [{ name: '音频文件', extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'webm'] }],
    })
    if (typeof selected === 'string' && selected.trim()) {
      patch({ url: selected })
    }
  })
}

async function testAudio(step: Extract<VtsMacroStep, { type: 'playAudio' }>) {
  if (testingAudio.value) return
  testingAudio.value = true
  await run(async () => {
    try {
      const url = await resolveAudioPlayUrl(step.url)
      const audio = new Audio(url)
      audio.volume = Math.min(1, Math.max(0, step.volume ?? 0.8))
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve()
        audio.onerror = () => reject(new Error('音效加载或播放失败'))
        void audio.play().catch(reject)
      })
    } finally {
      testingAudio.value = false
    }
  }, '试听完成')
}
</script>

<template>
  <!-- hotkey -->
  <FormField
    v-if="step.type === 'hotkey'"
    label="目标热键"
  >
    <Select
      :model-value="step.hotkeyID"
      @update:model-value="(v) => emit('update', { type: 'hotkey', hotkeyID: String(v ?? '') })"
    >
      <SelectTrigger class="w-full">
        <SelectValue placeholder="选择热键" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="h in hotkeyOptions"
          :key="h.value"
          :value="h.value"
        >
          {{ h.label }}
        </SelectItem>
      </SelectContent>
    </Select>
  </FormField>

  <!-- expression -->
  <div
    v-if="step.type === 'expression'"
    class="space-y-2"
  >
    <FormField label="目标表情">
      <Select
        :model-value="step.file"
        @update:model-value="(v) => patch({ file: String(v ?? '') })"
      >
        <SelectTrigger class="w-full">
          <SelectValue placeholder="选择表情" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="e in expressionOptions"
            :key="e.value"
            :value="e.value"
          >
            {{ e.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </FormField>
    <SettingRow
      variant="none"
      :title="step.active ? '开启此表情' : '关闭此表情'"
    >
      <Switch
        :checked="step.active"
        @update:checked="(v: boolean) => patch({ active: v })"
      />
    </SettingRow>
  </div>

  <!-- clearExpressions -->
  <div
    v-if="step.type === 'clearExpressions'"
    class="text-xs text-muted-foreground"
  >
    关闭当前模型所有已激活的表情
  </div>

  <!-- preset -->
  <FormField
    v-if="step.type === 'preset'"
    label="目标机位"
  >
    <Select
      :model-value="step.presetId"
      @update:model-value="(v) => emit('update', { type: 'preset', presetId: String(v ?? '') })"
    >
      <SelectTrigger class="w-full">
        <SelectValue placeholder="选择预设" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="p in presetOptions"
          :key="p.value"
          :value="p.value"
        >
          {{ p.label }}
        </SelectItem>
      </SelectContent>
    </Select>
  </FormField>

  <!-- wait -->
  <SettingRow
    v-if="step.type === 'wait'"
    variant="none"
    title="等待时长 (秒)"
  >
    <NumberField
      :model-value="step.seconds"
      :min="0"
      :step="0.1"
      class="w-28"
      @update:model-value="(v) => emit('update', { type: 'wait', seconds: Number(v ?? 0) })"
    />
  </SettingRow>

  <!-- injectParam -->
  <div
    v-if="step.type === 'injectParam'"
    class="space-y-2"
  >
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <FormField
        label="参数 ID"
        class="min-w-0"
      >
        <Input
          :model-value="step.parameterId"
          placeholder="参数 ID"
          @input="patch({ parameterId: ($event.target as HTMLInputElement).value })"
        />
      </FormField>
      <FormField
        label="目标值"
        class="min-w-0"
      >
        <NumberField
          :model-value="step.value"
          placeholder="值"
          @update:model-value="(v) => patch({ value: Number(v ?? 0) })"
        />
      </FormField>
      <FormField
        label="权重"
        class="min-w-0"
      >
        <NumberField
          :model-value="step.weight ?? 1"
          placeholder="权重"
          :min="0"
          :max="1"
          :step="0.1"
          @update:model-value="(v) => patch({ weight: Number(v ?? 1) })"
        />
      </FormField>
    </div>
    <div class="flex items-center gap-2 flex-wrap">
      <Select
        v-if="paramOptions.length > 0"
        :model-value="step.parameterId"
        @update:model-value="(v) => patch({ parameterId: String(v ?? '') })"
      >
        <SelectTrigger class="flex-1 min-w-[180px]">
          <SelectValue placeholder="从 VTS 参数列表快速填入" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="p in paramOptions"
            :key="p.value"
            :value="p.value"
          >
            {{ p.label }}
          </SelectItem>
        </SelectContent>
      </Select>
      <ToggleGroup
        type="single"
        :model-value="step.mode ?? 'add'"
        @update:model-value="(v) => v && patch({ mode: v })"
      >
        <ToggleGroupItem value="add">叠加</ToggleGroupItem>
        <ToggleGroupItem value="set">覆写</ToggleGroupItem>
      </ToggleGroup>
    </div>
  </div>

  <!-- accessory -->
  <div
    v-if="step.type === 'accessory'"
    class="space-y-2"
  >
    <FormField label="目标配饰">
      <Select
        :model-value="step.accessoryId"
        @update:model-value="(v) => patch({ accessoryId: v })"
      >
        <SelectTrigger class="w-full">
          <SelectValue placeholder="选择配饰" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="a in accessoryOptions"
            :key="a.value"
            :value="a.value"
          >
            {{ a.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </FormField>
    <SettingRow
      variant="none"
      :title="step.visible ? '显示配饰' : '隐藏配饰'"
    >
      <Switch
        :checked="step.visible"
        @update:checked="(v: boolean) => patch({ visible: v })"
      />
    </SettingRow>
  </div>

  <!-- prank -->
  <FormField
    v-if="step.type === 'prank'"
    label="目标整活"
  >
    <Select
      :model-value="step.prankId"
      @update:model-value="(v) => patch({ prankId: v })"
    >
      <SelectTrigger class="w-full">
        <SelectValue placeholder="选择整活" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="p in prankOptions"
          :key="p.value"
          :value="p.value"
        >
          {{ p.label }}
        </SelectItem>
      </SelectContent>
    </Select>
  </FormField>

  <!-- colorTint -->
  <div
    v-if="step.type === 'colorTint'"
    class="space-y-2"
  >
    <ToggleGroup
      type="single"
      class="w-full grid grid-cols-3"
      :model-value="step.reset ? 'reset' : step.rainbow ? 'rainbow' : 'color'"
      @update:model-value="
        (v) => {
          if (!v) return
          patch({ reset: v === 'reset', rainbow: v === 'rainbow' })
        }
      "
    >
      <ToggleGroupItem value="color">指定颜色</ToggleGroupItem>
      <ToggleGroupItem value="rainbow">彩虹循环</ToggleGroupItem>
      <ToggleGroupItem value="reset">恢复原色</ToggleGroupItem>
    </ToggleGroup>
    <FormField
      v-if="!step.reset && !step.rainbow"
      label="颜色"
    >
      <ColorPicker
        :model-value="step.color || '#ff6b9d'"
        @update:model-value="(v: string) => patch({ color: v || '#ffffff' })"
      />
    </FormField>
  </div>

  <!-- postProcessing -->
  <div
    v-if="step.type === 'postProcessing'"
    class="space-y-2"
  >
    <SettingRow
      variant="none"
      :title="step.enabled ? '开启滤镜' : '关闭滤镜'"
    >
      <Switch
        :checked="step.enabled"
        @update:checked="(v: boolean) => patch({ enabled: v })"
      />
    </SettingRow>
    <div
      v-if="step.enabled"
      class="grid grid-cols-1 sm:grid-cols-[1fr_110px] gap-2"
    >
      <FormField
        label="预设名称"
        class="min-w-0"
      >
        <Select
          :model-value="step.preset || '__none__'"
          @update:model-value="(v) => patch({ preset: v === '__none__' ? undefined : String(v) })"
        >
          <SelectTrigger class="w-full">
            <SelectValue placeholder="保持当前预设" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">仅开启（不切预设）</SelectItem>
            <SelectItem
              v-for="p in postProcessingPresetOptions"
              :key="p.value"
              :value="p.value"
            >
              {{ p.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <FormField
        label="过渡 (s)"
        class="min-w-0"
      >
        <NumberField
          :model-value="step.fadeTime ?? 0.3"
          :min="0"
          :max="5"
          :step="0.1"
          @update:model-value="(v) => patch({ fadeTime: Number(v ?? 0.3) })"
        />
      </FormField>
    </div>
  </div>

  <!-- playAudio -->
  <div
    v-if="audioStep"
    class="space-y-2"
  >
    <div class="grid grid-cols-1 sm:grid-cols-[1fr_110px] gap-2">
      <FormField
        label="音效路径或 URL"
        class="min-w-0"
      >
        <div class="flex items-center gap-1.5">
          <Input
            :model-value="audioStep.url"
            placeholder="https:// URL 或本地音频文件路径"
            class="flex-1 min-w-0"
            @input="patch({ url: ($event.target as HTMLInputElement).value })"
          />
          <Button
            v-if="isTauri()"
            size="icon-sm"
            variant="outline"
            title="选择本地音频"
            @click="pickLocalAudio"
          >
            <FolderOpen class="size-3.5" />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            title="试听"
            :disabled="!audioStep.url.trim() || testingAudio"
            @click="testAudio(audioStep)"
          >
            <Volume2 class="size-3.5" />
          </Button>
        </div>
      </FormField>
      <FormField
        label="音量"
        class="min-w-0"
      >
        <NumberField
          :model-value="audioStep.volume ?? 0.8"
          placeholder="音量"
          :min="0"
          :max="1"
          :step="0.05"
          @update:model-value="(v) => patch({ volume: Number(v ?? 0.8) })"
        />
      </FormField>
    </div>
    <SettingRow
      variant="none"
      title="等待播放结束"
    >
      <Switch
        :checked="audioStep.waitForEnd ?? false"
        @update:checked="(v: boolean) => patch({ waitForEnd: v })"
      />
    </SettingRow>
  </div>
</template>
