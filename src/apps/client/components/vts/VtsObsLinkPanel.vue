<script setup lang="ts">
import { computed, onUnmounted, watch } from 'vue'

import { useOBSStore } from '@/apps/client/store/useOBSStore'
import { useVtsStore } from '@/apps/client/store/useVtsStore'

import { useVtsAction } from './useVtsAction'

const obs = useOBSStore()
const vts = useVtsStore()
const { run } = useVtsAction()

const sceneOptions = computed(() => obs.obsScenes.map((s) => ({ label: s, value: s })))
const presetOptions = computed(() => vts.presets.map((p) => ({ label: p.name, value: p.id })))

function setEnabled(enabled: boolean) {
  void vts.setObsLinkConfig({ ...vts.obsLinkConfig, enabled })
}

function setDebounceMs(ms: number) {
  void vts.setObsLinkConfig({ ...vts.obsLinkConfig, debounceMs: ms })
}

function setMapping(scene: string, presetId: string) {
  void vts.setObsLinkConfig({
    ...vts.obsLinkConfig,
    sceneToPresetId: { ...vts.obsLinkConfig.sceneToPresetId, [scene]: presetId },
  })
}

function removeMapping(scene: string) {
  const next = { ...vts.obsLinkConfig.sceneToPresetId }
  delete next[scene]
  void vts.setObsLinkConfig({ ...vts.obsLinkConfig, sceneToPresetId: next })
}

let timer: number | null = null
let lastScene: string | null = null

const stopWatch = watch(
  () => obs.currentObsScene,
  (scene) => {
    if (!scene || !vts.obsLinkConfig.enabled || !vts.canOperate) return
    const presetId = vts.obsLinkConfig.sceneToPresetId[scene]
    if (!presetId || scene === lastScene) return
    lastScene = scene
    if (timer != null) window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      run(() => vts.applyPreset(presetId))
    }, vts.obsLinkConfig.debounceMs)
  },
  { immediate: true },
)

onUnmounted(() => {
  stopWatch()
  if (timer != null) {
    window.clearTimeout(timer)
    timer = null
  }
})
</script>

<template>
  <UCard
    size="small"
    bordered
    title="OBS 联动"
  >
    <div
      vertical
      :size="12"
    >
      <div
        align="center"
        :wrap="true"
        :size="12"
      >
        <USwitch
          :model-value="vts.obsLinkConfig.enabled"
          @update:model-value="setEnabled"
        >
          <template v-if="false"> 已启用 </template>
          <template v-if="false"> 未启用 </template>
        </USwitch>
        <UInputNumber
          :value="vts.obsLinkConfig.debounceMs"
          :min="0"
          :step="50"
          style="width: 140px"
          @update:value="(val) => setDebounceMs((val ?? 0) as number)"
        />
        <span depth="3"> 防抖 (ms) </span>
        <UButton
          size="small"
          :disabled="!obs.obsConnected"
          @click="obs.fetchObsScenes"
        >
          刷新场景
        </UButton>
        <span depth="3"> 当前: {{ obs.currentObsScene || '未知' }} </span>
      </div>

      <USeparator style="margin: 4px 0" />

      <span
        v-if="sceneOptions.length === 0"
        depth="3"
      >
        未获取到 OBS 场景列表，请先连接 OBS 后点击"刷新场景"
      </span>

      <div
        v-else
        vertical
        :size="8"
      >
        <div
          v-for="scene in obs.obsScenes"
          :key="scene"
          align="center"
          justify="space-between"
          :wrap="true"
          :size="12"
        >
          <div
            align="center"
            :wrap="true"
            :size="12"
          >
            <span
              strong
              style="min-width: 120px"
            >
              {{ scene }}
            </span>
            <USelectMenu
              style="width: 280px"
              :items="presetOptions"
              :value="vts.obsLinkConfig.sceneToPresetId[scene]"
              placeholder="映射到 VTS 机位预设"
              clearable
              @update:value="(val) => (val ? setMapping(scene, val as string) : removeMapping(scene))"
              value-key="value"
            />
          </div>
          <UButton
            size="small"
            :disabled="!vts.obsLinkConfig.sceneToPresetId[scene]"
            @click="removeMapping(scene)"
          >
            清除
          </UButton>
        </div>
      </div>
    </div>
  </UCard>
</template>
