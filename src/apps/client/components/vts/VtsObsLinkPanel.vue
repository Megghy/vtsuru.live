<script setup lang="ts">
import { computed } from 'vue'

import { useOBSStore } from '@/apps/client/store/useOBSStore'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { Switch } from '@/shared/ui/switch'

const obs = useOBSStore()
const vts = useVtsStore()

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
</script>

<template>
  <Card>
    <CardHeader class="py-3 px-4">
      <CardTitle class="text-sm font-semibold">OBS 场景联动</CardTitle>
    </CardHeader>
    <CardContent class="px-4 pb-4 pt-0 flex flex-col gap-3">
      <div class="flex items-center gap-3 flex-wrap text-xs">
        <div class="flex items-center gap-2">
          <Switch :checked="vts.obsLinkConfig.enabled" @update:checked="setEnabled" />
          <span>{{ vts.obsLinkConfig.enabled ? '已启用' : '未启用' }}</span>
        </div>

        <div class="flex items-center gap-1.5">
          <NInputNumber
            :model-value="vts.obsLinkConfig.debounceMs"
            :min="0"
            :step="50"
            class="w-24"
            @update:model-value="(val) => setDebounceMs((val ?? 0) as number)"
          />
          <span class="text-[var(--muted-foreground)]">防抖 (ms)</span>
        </div>

        <Button variant="outline" :disabled="!obs.obsConnected" @click="obs.fetchObsScenes">
          刷新场景
        </Button>
        <span class="text-[var(--muted-foreground)]">当前: {{ obs.currentObsScene || '未知' }}</span>
      </div>

      <Separator />

      <p
        v-if="sceneOptions.length === 0"
        class="text-xs text-[var(--muted-foreground)]"
      >
        未获取到 OBS 场景列表，请先连接 OBS 后点击"刷新场景"
      </p>

      <div
        v-else
        class="flex flex-col gap-2"
      >
        <div
          v-for="scene in obs.obsScenes"
          :key="scene"
          class="flex items-center justify-between gap-3 flex-wrap"
        >
          <div class="flex items-center gap-3 flex-wrap flex-1">
            <span class="font-bold text-xs min-w-[120px]">{{ scene }}</span>
            <div class="w-64">
              <Select
                :model-value="vts.obsLinkConfig.sceneToPresetId[scene] || '__none__'"
                @update:model-value="(val) => (val && val !== '__none__' ? setMapping(scene, String(val)) : removeMapping(scene))"
              >
                <SelectTrigger>
                  <SelectValue placeholder="映射到 VTS 机位预设" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">无映射</SelectItem>
                  <SelectItem
                    v-for="p in presetOptions"
                    :key="p.value"
                    :value="p.value"
                  >
                    {{ p.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button variant="ghost" :disabled="!vts.obsLinkConfig.sceneToPresetId[scene]" @click="removeMapping(scene)">
            清除
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
