<script setup lang="ts">
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { NButton, NCard, NForm, NFormItem, NInput, NInputNumber, NSelect, NFlex, NIcon, NTooltip, NAlert } from 'naive-ui';
import { computed } from 'vue'
import { ActionType } from '@/apps/client/store/useAutoAction'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { Info16Regular, ArrowClockwise16Filled } from '@vicons/fluent'

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
const itemFileOptions = computed(() => vts.availableItemFiles.map(f => ({ label: `${f.fileName} (加载数: ${f.loadedCount})`, value: f.fileName })))
</script>

<template>
  <div v-if="isVtsAction" class="vts-action-settings">
    <NCard title="VTube Studio 动作配置" size="small" bordered embedded>
      <template #header-extra>
        <NTooltip trigger="hover">
          <template #trigger>
            <NIcon :component="Info16Regular" depth="3" />
          </template>
          确保 VTube Studio 已连接且插件已授权
        </NTooltip>
      </template>

      <NForm label-placement="left" :label-width="120" size="small" :show-feedback="false">
        <NFlex vertical :size="12">
          <!-- 热键触发 -->
          <NFormItem v-if="action.actionType === ActionType.VTS_HOTKEY" label="触发热键">
            <NFlex align="center" :wrap="false" style="width: 100%">
              <NSelect
                v-model:value="action.actionConfig.vtsHotkeyId"
                filterable
                clearable
                placeholder="选择热键 (Hotkey ID)"
                :options="hotkeyOptions"
                style="flex: 1"
              />
              <NButton size="small" quaternary circle title="刷新热键" @click="vts.refreshHotkeys()">
                <template #icon>
                  <NIcon :component="ArrowClockwise16Filled" />
                </template>
              </NButton>
            </NFlex>
          </NFormItem>

          <!-- 机位预设 -->
          <NFormItem v-if="action.actionType === ActionType.VTS_PRESET" label="机位预设">
            <NSelect
              v-model:value="action.actionConfig.vtsPresetId"
              filterable
              clearable
              placeholder="选择机位预设 (Preset ID)"
              :options="presetOptions"
            />
          </NFormItem>

          <!-- 道具掉落 -->
          <template v-if="action.actionType === ActionType.VTS_DROP_ITEM">
            <NFormItem label="道具文件">
              <NFlex align="center" :wrap="false" style="width: 100%">
                <NSelect
                  v-model:value="action.actionConfig.vtsItemFileName"
                  filterable
                  clearable
                  placeholder="选择道具文件 (.vtsitems)"
                  :options="itemFileOptions"
                  style="flex: 1"
                />
                <NButton size="small" quaternary circle :disabled="!vts.canOperate" title="刷新文件" @click="vts.refreshItems({ includeFiles: true })">
                  <template #icon>
                    <NIcon :component="ArrowClockwise16Filled" />
                  </template>
                </NButton>
              </NFlex>
            </NFormItem>

            <NFormItem label="位置与缩放">
              <NFlex align="center" :size="12">
                <NInputNumber v-model:value="action.actionConfig.vtsItemDropX" placeholder="水平位置 (x)" :step="0.05" style="width: 140px">
                  <template #prefix>
                    X:
                  </template>
                </NInputNumber>
                <NInputNumber v-model:value="action.actionConfig.vtsItemDropSize" placeholder="缩放 (size)" :step="0.01" :min="0" :max="1" style="width: 140px">
                  <template #prefix>
                    S:
                  </template>
                </NInputNumber>
              </NFlex>
            </NFormItem>
          </template>

          <!-- 参数注入 -->
          <template v-if="action.actionType === ActionType.VTS_PARAM_ADD">
            <NFormItem label="参数名称">
              <NInput v-model:value="action.actionConfig.vtsParamId" placeholder="例如：Blush, EyeOpen 等" />
            </NFormItem>
            <NFormItem label="数值与权重">
              <NFlex align="center" :size="12">
                <NInputNumber v-model:value="action.actionConfig.vtsParamValue" placeholder="目标值" :step="0.01" style="width: 140px">
                  <template #prefix>
                    值:
                  </template>
                </NInputNumber>
                <NInputNumber v-model:value="action.actionConfig.vtsParamWeight" placeholder="权重 (可选)" :step="0.1" :min="0" :max="1" style="width: 140px">
                  <template #prefix>
                    W:
                  </template>
                </NInputNumber>
              </NFlex>
            </NFormItem>
            <NAlert type="info" size="small" :show-icon="false" :bordered="false">
              使用累加模式（Add）注入参数，不会强制接管面捕，适合制作表情叠加效果。
            </NAlert>
          </template>
        </NFlex>
      </NForm>
    </NCard>
  </div>
</template>

<style scoped>
.vts-action-settings {
  width: 100%;
}

:deep(.n-form-item-label) {
  font-weight: 500;
}
</style>

