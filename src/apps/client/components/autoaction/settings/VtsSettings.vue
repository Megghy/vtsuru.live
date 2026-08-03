<script setup lang="ts">
import { computed } from 'vue'

import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { ActionType } from '@/apps/client/store/useAutoAction'
import { useVtsStore } from '@/apps/client/store/useVtsStore'

const props = defineProps<{
  action: AutoActionItem
}>()

const vts = useVtsStore()

const isVtsAction = computed(() =>
  [
    ActionType.VTS_HOTKEY,
    ActionType.VTS_PRESET,
    ActionType.VTS_DROP_ITEM,
    ActionType.VTS_PARAM_ADD,
    ActionType.VTS_MACRO,
    ActionType.VTS_ACCESSORY,
  ].includes(props.action.actionType),
)

const hotkeyOptions = computed(() => vts.hotkeys.map((hk) => ({ label: hk.name || hk.hotkeyID, value: hk.hotkeyID })))
const presetOptions = computed(() => vts.presets.map((p) => ({ label: p.name, value: p.id })))
const itemFileOptions = computed(() =>
  vts.availableItemFiles.map((f) => ({ label: `${f.fileName} (${f.loadedCount})`, value: f.fileName })),
)
const macroOptions = computed(() =>
  vts.macros.map((m) => ({ label: `${m.name} (${m.steps?.length ?? 0} 步)`, value: m.id })),
)
const accessoryOptions = computed(() => vts.accessories.map((a) => ({ label: a.name, value: a.id })))
</script>

<template>
  <div v-if="isVtsAction">
    <UCard
      title="VTS 动作配置"
      size="small"
      bordered
      embedded
    >
      <template #header-extra>
        <UTooltip>
          <UIcon
            name="i-lucide-circle"
            depth="3"
          />
          <template #content> 需要 VTS 已连接且已授权 </template>
        </UTooltip>
      </template>

      <UForm
        label-placement="left"
        :label-width="100"
        size="small"
        :show-feedback="false"
      >
        <div
          vertical
          :size="12"
        >
          <UFormField
            v-if="action.actionType === ActionType.VTS_HOTKEY"
            label="热键"
          >
            <div
              align="center"
              :wrap="false"
              style="width: 100%"
            >
              <USelectMenu
                v-model="action.actionConfig.vtsHotkeyId"
                filterable
                clearable
                placeholder="选择热键"
                :items="hotkeyOptions"
                style="flex: 1"
                value-key="value"
              />
              <UButton
                size="small"
                variant="ghost"
                square
                title="刷新"
                @click="vts.refreshHotkeys()"
              >
                <template #leading>
                  <UIcon name="i-lucide-circle" />
                </template>
              </UButton>
            </div>
          </UFormField>

          <UFormField
            v-if="action.actionType === ActionType.VTS_PRESET"
            label="机位预设"
          >
            <USelectMenu
              v-model="action.actionConfig.vtsPresetId"
              filterable
              clearable
              placeholder="选择预设"
              :items="presetOptions"
              value-key="value"
            />
          </UFormField>

          <template v-if="action.actionType === ActionType.VTS_DROP_ITEM">
            <UFormField label="道具文件">
              <div
                align="center"
                :wrap="false"
                style="width: 100%"
              >
                <USelectMenu
                  v-model="action.actionConfig.vtsItemFileName"
                  filterable
                  clearable
                  placeholder="选择道具文件"
                  :items="itemFileOptions"
                  style="flex: 1"
                  value-key="value"
                />
                <UButton
                  size="small"
                  variant="ghost"
                  square
                  :disabled="!vts.canOperate"
                  title="刷新"
                  @click="vts.refreshItems({ includeFiles: true })"
                >
                  <template #leading>
                    <UIcon name="i-lucide-circle" />
                  </template>
                </UButton>
              </div>
            </UFormField>
            <UFormField label="位置与缩放">
              <div
                align="center"
                :size="12"
              >
                <div class="flex items-center gap-2">
                  <UInputNumber
                    v-model="action.actionConfig.vtsItemDropX"
                    placeholder="X"
                    :step="0.05"
                    style="width: 130px"
                  />
                  <span class="text-sm text-[var(--vtsuru-fg-muted)]">X:</span>
                </div>
                <div class="flex items-center gap-2">
                  <UInputNumber
                    v-model="action.actionConfig.vtsItemDropSize"
                    placeholder="大小"
                    :step="0.01"
                    :min="0"
                    :max="1"
                    style="width: 130px"
                  />
                  <span class="text-sm text-[var(--vtsuru-fg-muted)]">S:</span>
                </div>
              </div>
            </UFormField>
          </template>

          <template v-if="action.actionType === ActionType.VTS_PARAM_ADD">
            <UFormField label="参数 ID">
              <UInput
                v-model="action.actionConfig.vtsParamId"
                placeholder="如 Blush, EyeOpen"
              />
            </UFormField>
            <UFormField label="数值与权重">
              <div
                align="center"
                :size="12"
              >
                <div class="flex items-center gap-2">
                  <UInputNumber
                    v-model="action.actionConfig.vtsParamValue"
                    placeholder="值"
                    :step="0.01"
                    style="width: 130px"
                  />
                  <span class="text-sm text-[var(--vtsuru-fg-muted)]">值:</span>
                </div>
                <div class="flex items-center gap-2">
                  <UInputNumber
                    v-model="action.actionConfig.vtsParamWeight"
                    placeholder="权重"
                    :step="0.1"
                    :min="0"
                    :max="1"
                    style="width: 130px"
                  />
                  <span class="text-sm text-[var(--vtsuru-fg-muted)]">W:</span>
                </div>
              </div>
            </UFormField>
          </template>

          <UFormField
            v-if="action.actionType === ActionType.VTS_MACRO"
            label="宏"
          >
            <USelectMenu
              v-model="action.actionConfig.vtsMacroId"
              filterable
              clearable
              placeholder="选择要运行的宏"
              :items="macroOptions"
              value-key="value"
            />
          </UFormField>

          <template v-if="action.actionType === ActionType.VTS_ACCESSORY">
            <UFormField label="配饰">
              <USelectMenu
                v-model="action.actionConfig.vtsAccessoryId"
                filterable
                clearable
                placeholder="选择配饰"
                :items="accessoryOptions"
                value-key="value"
              />
            </UFormField>
            <UFormField label="操作">
              <USwitch v-model="action.actionConfig.vtsAccessoryVisible">
                <template v-if="false"> 显示 </template>
                <template v-if="false"> 隐藏 </template>
              </USwitch>
            </UFormField>
          </template>
        </div>
      </UForm>
    </UCard>
  </div>
</template>
