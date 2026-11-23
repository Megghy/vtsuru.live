<script setup lang="ts">
import { RefreshCw } from 'lucide-vue-next'
import { computed } from 'vue'

import { useOBSStore } from '@/apps/client/store/useOBSStore'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'

const obs = useOBSStore()
const vts = useVtsStore()

const sceneOptions = computed(() => obs.obsScenes.map((s) => ({ label: s, value: s })))
const presetOptions = computed(() => vts.presets.map((p) => ({ label: p.name, value: p.id })))
const presetIdSet = computed(() => new Set(vts.presets.map((p) => p.id)))

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
    <CardHeader class="p-3 border-b flex flex-row items-center justify-between gap-2 flex-wrap">
      <div class="flex items-center gap-2">
        <CardTitle>OBS 场景联动</CardTitle>
        <Badge
          :variant="vts.obsLinkConfig.enabled ? 'success' : 'secondary'"
          size="xs"
        >
          {{ vts.obsLinkConfig.enabled ? '已启用' : '未启用' }}
        </Badge>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[11px] text-muted-foreground">当前场景: {{ obs.currentObsScene || '未知' }}</span>
        <Button
          size="xs"
          variant="outline"
          class="gap-1"
          :disabled="!obs.obsConnected"
          @click="obs.fetchObsScenes"
        >
          <RefreshCw class="size-3" />
          刷新场景
        </Button>
      </div>
    </CardHeader>

    <CardContent class="p-3 space-y-3">
      <Alert
        v-if="vts.obsLinkConfig.enabled"
        size="sm"
        variant="warning"
      >
        <AlertDescription class="m-0">
          若你正在使用新版「OBS 场景编辑器」的 VTS 机位联动（vts-preset 模式），请关闭此处的旧版 OBS
          场景联动，以免切场时重复移动模型产生冲突。
        </AlertDescription>
      </Alert>

      <div class="flex items-center justify-between gap-4 flex-wrap">
        <SettingRow
          type="switch"
          variant="none"
          title="切换 OBS 场景时自动切换 VTS 机位"
          :model-value="vts.obsLinkConfig.enabled"
          @update:model-value="setEnabled"
        />

        <div class="flex items-center gap-2">
          <span class="text-xs text-muted-foreground">防抖 (ms)</span>
          <NumberField
            :model-value="vts.obsLinkConfig.debounceMs"
            :min="0"
            :step="50"
            class="w-24"
            @update:model-value="(val) => setDebounceMs(Number(val ?? 0))"
          />
        </div>
      </div>

      <Separator />

      <div
        v-if="sceneOptions.length === 0"
        class="py-4"
      >
        <Empty description="未获取到 OBS 场景列表，请先连接 OBS 后点击「刷新场景」" />
      </div>

      <div
        v-else
        class="space-y-2"
      >
        <div
          v-for="scene in obs.obsScenes"
          :key="scene"
          class="flex-between gap-3 flex-wrap p-2 rounded-md border border-border bg-muted/20"
        >
          <div class="flex items-center gap-3 flex-wrap flex-1 min-w-0">
            <span class="font-semibold text-xs text-foreground min-w-[120px] truncate">{{ scene }}</span>
            <div class="w-64 max-w-full">
              <Select
                :model-value="vts.obsLinkConfig.sceneToPresetId[scene] || '__none__'"
                @update:model-value="
                  (val) => (val && val !== '__none__' ? setMapping(scene, String(val)) : removeMapping(scene))
                "
              >
                <SelectTrigger class="w-full">
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
            <Badge
              v-if="
                vts.obsLinkConfig.sceneToPresetId[scene] && !presetIdSet.has(vts.obsLinkConfig.sceneToPresetId[scene])
              "
              variant="warning"
              size="xs"
            >
              预设已删除
            </Badge>
          </div>
          <Button
            size="xs"
            variant="ghost"
            :disabled="!vts.obsLinkConfig.sceneToPresetId[scene]"
            @click="removeMapping(scene)"
          >
            清除
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
