<script setup lang="ts">
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { NButton, NCard, NForm, NFormItem, NInput, NInputNumber, NSelect, NFlex, NText } from 'naive-ui';
import { computed } from 'vue'
import { ActionType } from '@/apps/client/store/useAutoAction'
import { useVtsStore } from '@/apps/client/store/useVtsStore'

const props = defineProps<{
  action: AutoActionItem
}>()

const vts = useVtsStore()

const isVtsAction = computed(() => {
  return [
    ActionType.VTS_HOTKEY,
    ActionType.VTS_PRESET,
    ActionType.VTS_DROP_ITEM,
    ActionType.VTS_PARAM_ADD,
  ].includes(props.action.actionType)
})

const hotkeyOptions = computed(() => vts.hotkeys.map(hk => ({ label: hk.name || hk.hotkeyID, value: hk.hotkeyID })))
const presetOptions = computed(() => vts.presets.map(p => ({ label: p.name, value: p.id })))
const itemFileOptions = computed(() => vts.availableItemFiles.map(f => ({ label: `${f.fileName} (loaded=${f.loadedCount})`, value: f.fileName })))
</script>

<template>
  <NCard v-if="isVtsAction" title="VTS 动作设置" size="small" bordered :segmented="{ content: true }">
    <NForm label-placement="left" label-width="140" size="small">
      <NFormItem v-if="action.actionType === ActionType.VTS_HOTKEY" label="hotkeyID">
        <NSelect
          v-model:value="action.actionConfig.vtsHotkeyId"
          filterable
          clearable
          placeholder="选择或输入 hotkeyID"
          :options="hotkeyOptions"
        />
      </NFormItem>

      <NFormItem v-if="action.actionType === ActionType.VTS_PRESET" label="presetId">
        <NSelect
          v-model:value="action.actionConfig.vtsPresetId"
          filterable
          clearable
          placeholder="选择机位预设"
          :options="presetOptions"
        />
      </NFormItem>

      <NFormItem v-if="action.actionType === ActionType.VTS_DROP_ITEM" label="item fileName">
        <NFlex align="center" style="width: 100%" :wrap="true">
          <NSelect
            v-model:value="action.actionConfig.vtsItemFileName"
            filterable
            clearable
            placeholder="选择 Items 文件"
            :options="itemFileOptions"
            style="min-width: 360px"
          />
          <NButton size="tiny" :disabled="!vts.canOperate" @click="vts.refreshItems({ includeFiles: true })">
            刷新 Items
          </NButton>
        </NFlex>
      </NFormItem>

      <NFormItem v-if="action.actionType === ActionType.VTS_DROP_ITEM" label="drop x / size">
        <NFlex align="center" :wrap="true">
          <NInputNumber v-model:value="action.actionConfig.vtsItemDropX" placeholder="x (默认0)" :step="0.05" style="width: 180px" />
          <NInputNumber v-model:value="action.actionConfig.vtsItemDropSize" placeholder="size (默认0.32)" :step="0.01" :min="0" :max="1" style="width: 220px" />
        </NFlex>
      </NFormItem>

      <template v-if="action.actionType === ActionType.VTS_PARAM_ADD">
        <NFormItem label="parameterId">
          <NInput v-model:value="action.actionConfig.vtsParamId" placeholder="例如：Blush" />
        </NFormItem>
        <NFormItem label="value / weight">
          <NFlex align="center" :wrap="true">
            <NInputNumber v-model:value="action.actionConfig.vtsParamValue" placeholder="value" :step="0.01" style="width: 200px" />
            <NInputNumber v-model:value="action.actionConfig.vtsParamWeight" placeholder="weight(可选)" :step="0.1" style="width: 200px" />
          </NFlex>
        </NFormItem>
        <NText depth="3">
          使用 `InjectParameterDataRequest` 的 `mode=add`，不会强行接管面捕。
        </NText>
      </template>
    </NForm>
  </NCard>
</template>

