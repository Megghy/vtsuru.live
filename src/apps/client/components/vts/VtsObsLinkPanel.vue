<script setup lang="ts">
import { NButton, NCard, NDivider, NFlex, NInputNumber, NSelect, NSwitch, NText, useMessage } from 'naive-ui'
import { computed, watch } from 'vue'
import { useOBSStore } from '@/apps/client/store/useOBSStore'
import { useVtsStore } from '@/apps/client/store/useVtsStore'

const obs = useOBSStore()
const vts = useVtsStore()
const message = useMessage()

const sceneOptions = computed(() => obs.obsScenes.map(s => ({ label: s, value: s })))
const presetOptions = computed(() => vts.presets.map(p => ({ label: p.name, value: p.id })))

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
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete next[scene]
  void vts.setObsLinkConfig({ ...vts.obsLinkConfig, sceneToPresetId: next })
}

let timer: number | null = null
let lastScene: string | null = null

watch(
  () => obs.currentObsScene,
  (scene) => {
    if (!scene) return
    if (!vts.obsLinkConfig.enabled) return
    if (!vts.canOperate) return

    const presetId = vts.obsLinkConfig.sceneToPresetId[scene]
    if (!presetId) return
    if (scene === lastScene) return

    lastScene = scene
    if (timer != null) window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      void vts.applyPreset(presetId).catch((err) => {
        message.error(err instanceof Error ? err.message : String(err))
      })
    }, vts.obsLinkConfig.debounceMs)
  },
  { immediate: true },
)
</script>

<template>
  <NCard size="small" title="OBS 联动（场景 -> VTS 机位预设）">
    <NFlex vertical :size="10">
      <NFlex align="center" :wrap="true" :size="10">
        <NSwitch :value="vts.obsLinkConfig.enabled" @update:value="setEnabled">
          <template #checked>
            已启用
          </template>
          <template #unchecked>
            未启用
          </template>
        </NSwitch>
        <NInputNumber
          :value="vts.obsLinkConfig.debounceMs"
          :min="0"
          :step="50"
          style="width: 160px"
          @update:value="(val) => setDebounceMs((val ?? 0) as number)"
        />
        <NText depth="3">
          debounce(ms)
        </NText>
        <NButton size="small" :disabled="!obs.obsConnected" @click="obs.fetchObsScenes">
          刷新 OBS 场景
        </NButton>
        <NText depth="3">
          当前场景：{{ obs.currentObsScene || '未知' }}
        </NText>
      </NFlex>

      <NDivider style="margin: 4px 0" />

      <NFlex v-if="sceneOptions.length === 0" vertical :size="6">
        <NText depth="3">
          未获取到 OBS 场景列表（请先连接 OBS，并点击“刷新 OBS 场景”）。
        </NText>
      </NFlex>

      <NFlex v-else vertical :size="8">
        <NFlex v-for="scene in obs.obsScenes" :key="scene" align="center" justify="space-between" :wrap="true" :size="10">
          <NFlex align="center" :wrap="true" :size="10">
            <NText strong style="min-width: 140px">
              {{ scene }}
            </NText>
            <NSelect
              style="width: 320px"
              :options="presetOptions"
              :value="vts.obsLinkConfig.sceneToPresetId[scene]"
              placeholder="选择 VTS 预设"
              clearable
              @update:value="(val) => val ? setMapping(scene, val as string) : removeMapping(scene)"
            />
          </NFlex>
          <NButton size="small" :disabled="!vts.obsLinkConfig.sceneToPresetId[scene]" @click="removeMapping(scene)">
            清除映射
          </NButton>
        </NFlex>
      </NFlex>
    </NFlex>
  </NCard>
</template>

