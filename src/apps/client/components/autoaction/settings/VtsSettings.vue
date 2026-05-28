<script setup lang="ts">
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { NButton, NCard, NFlex, NForm, NFormItem, NIcon, NInput, NInputNumber, NSelect, NSwitch, NTooltip } from 'naive-ui'
import { computed } from 'vue'
import { ActionType } from '@/apps/client/store/useAutoAction'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { ArrowClockwise16Filled, Info16Regular } from '@vicons/fluent'

const props = defineProps<{
  action: AutoActionItem
}>()

const vts = useVtsStore()

const isVtsAction = computed(() => [
  ActionType.VTS_HOTKEY,
  ActionType.VTS_PRESET,
  ActionType.VTS_DROP_ITEM,
  ActionType.VTS_PARAM_ADD,
  ActionType.VTS_MACRO,
  ActionType.VTS_ACCESSORY,
].includes(props.action.actionType))

const hotkeyOptions = computed(() => vts.hotkeys.map(hk => ({ label: hk.name || hk.hotkeyID, value: hk.hotkeyID })))
const presetOptions = computed(() => vts.presets.map(p => ({ label: p.name, value: p.id })))
const itemFileOptions = computed(() => vts.availableItemFiles.map(f => ({ label: `${f.fileName} (${f.loadedCount})`, value: f.fileName })))
const macroOptions = computed(() => vts.macros.map(m => ({ label: `${m.name} (${m.steps?.length ?? 0} 步)`, value: m.id })))
const accessoryOptions = computed(() => vts.accessories.map(a => ({ label: a.name, value: a.id })))
</script>

<template>
  <div v-if="isVtsAction">
    <NCard title="VTS 动作配置" size="small" bordered embedded>
      <template #header-extra>
        <NTooltip trigger="hover">
          <template #trigger>
            <NIcon :component="Info16Regular" depth="3" />
          </template>
          需要 VTS 已连接且已授权
        </NTooltip>
      </template>

      <NForm label-placement="left" :label-width="100" size="small" :show-feedback="false">
        <NFlex vertical :size="12">
          <NFormItem v-if="action.actionType === ActionType.VTS_HOTKEY" label="热键">
            <NFlex align="center" :wrap="false" style="width: 100%">
              <NSelect
                v-model:value="action.actionConfig.vtsHotkeyId"
                filterable clearable
                placeholder="选择热键"
                :options="hotkeyOptions"
                style="flex: 1"
              />
              <NButton size="small" quaternary circle title="刷新" @click="vts.refreshHotkeys()">
                <template #icon><NIcon :component="ArrowClockwise16Filled" /></template>
              </NButton>
            </NFlex>
          </NFormItem>

          <NFormItem v-if="action.actionType === ActionType.VTS_PRESET" label="机位预设">
            <NSelect
              v-model:value="action.actionConfig.vtsPresetId"
              filterable clearable
              placeholder="选择预设"
              :options="presetOptions"
            />
          </NFormItem>

          <template v-if="action.actionType === ActionType.VTS_DROP_ITEM">
            <NFormItem label="道具文件">
              <NFlex align="center" :wrap="false" style="width: 100%">
                <NSelect
                  v-model:value="action.actionConfig.vtsItemFileName"
                  filterable clearable
                  placeholder="选择道具文件"
                  :options="itemFileOptions"
                  style="flex: 1"
                />
                <NButton size="small" quaternary circle :disabled="!vts.canOperate" title="刷新" @click="vts.refreshItems({ includeFiles: true })">
                  <template #icon><NIcon :component="ArrowClockwise16Filled" /></template>
                </NButton>
              </NFlex>
            </NFormItem>
            <NFormItem label="位置与缩放">
              <NFlex align="center" :size="12">
                <NInputNumber v-model:value="action.actionConfig.vtsItemDropX" placeholder="X" :step="0.05" style="width: 130px">
                  <template #prefix>X:</template>
                </NInputNumber>
                <NInputNumber v-model:value="action.actionConfig.vtsItemDropSize" placeholder="大小" :step="0.01" :min="0" :max="1" style="width: 130px">
                  <template #prefix>S:</template>
                </NInputNumber>
              </NFlex>
            </NFormItem>
          </template>

          <template v-if="action.actionType === ActionType.VTS_PARAM_ADD">
            <NFormItem label="参数 ID">
              <NInput v-model:value="action.actionConfig.vtsParamId" placeholder="如 Blush, EyeOpen" />
            </NFormItem>
            <NFormItem label="数值与权重">
              <NFlex align="center" :size="12">
                <NInputNumber v-model:value="action.actionConfig.vtsParamValue" placeholder="值" :step="0.01" style="width: 130px">
                  <template #prefix>值:</template>
                </NInputNumber>
                <NInputNumber v-model:value="action.actionConfig.vtsParamWeight" placeholder="权重" :step="0.1" :min="0" :max="1" style="width: 130px">
                  <template #prefix>W:</template>
                </NInputNumber>
              </NFlex>
            </NFormItem>
          </template>

          <NFormItem v-if="action.actionType === ActionType.VTS_MACRO" label="宏">
            <NSelect
              v-model:value="action.actionConfig.vtsMacroId"
              filterable clearable
              placeholder="选择要运行的宏"
              :options="macroOptions"
            />
          </NFormItem>

          <template v-if="action.actionType === ActionType.VTS_ACCESSORY">
            <NFormItem label="配饰">
              <NSelect
                v-model:value="action.actionConfig.vtsAccessoryId"
                filterable clearable
                placeholder="选择配饰"
                :options="accessoryOptions"
              />
            </NFormItem>
            <NFormItem label="操作">
              <NSwitch v-model:value="action.actionConfig.vtsAccessoryVisible">
                <template #checked>显示</template>
                <template #unchecked>隐藏</template>
              </NSwitch>
            </NFormItem>
          </template>
        </NFlex>
      </NForm>
    </NCard>
  </div>
</template>
