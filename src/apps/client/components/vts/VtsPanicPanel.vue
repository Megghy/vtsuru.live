<script setup lang="ts">
import { Crosshair, RotateCcw } from 'lucide-vue-next'
import { computed } from 'vue'

import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { FormField } from '@/shared/ui/form-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

import { useVtsAction } from './useVtsAction'

const vts = useVtsStore()
const { run } = useVtsAction()

const hotkeyOptions = computed(() => vts.hotkeys.map((hk) => ({ label: hk.name || hk.hotkeyID, value: hk.hotkeyID })))
const hotkeyIdSet = computed(() => new Set(vts.hotkeys.map((hk) => hk.hotkeyID)))

const calibrateMissing = computed(
  () =>
    vts.connected &&
    Boolean(vts.panicConfig.calibrateHotkeyId) &&
    !hotkeyIdSet.value.has(vts.panicConfig.calibrateHotkeyId),
)
const resetPhysicsMissing = computed(
  () =>
    vts.connected &&
    Boolean(vts.panicConfig.resetPhysicsHotkeyId) &&
    !hotkeyIdSet.value.has(vts.panicConfig.resetPhysicsHotkeyId),
)

function setCalibrateHotkey(id: string) {
  run(() => vts.setPanicConfig({ ...vts.panicConfig, calibrateHotkeyId: id }), '已保存')
}

function setResetPhysicsHotkey(id: string) {
  run(() => vts.setPanicConfig({ ...vts.panicConfig, resetPhysicsHotkeyId: id }), '已保存')
}
</script>

<template>
  <Card>
    <CardHeader class="p-3 border-b flex flex-row items-center justify-between gap-2">
      <CardTitle>应急控制绑定</CardTitle>
      <span class="text-[11px] text-muted-foreground">绑定后可在顶栏随时一键触发</span>
    </CardHeader>

    <CardContent class="p-3 space-y-3">
      <FormField label="校准面捕热键">
        <template
          v-if="calibrateMissing"
          #extra
        >
          <Badge
            variant="warning"
            size="xs"
          >
            当前模型不存在
          </Badge>
        </template>
        <div class="flex items-center gap-2">
          <div class="flex-1 min-w-0">
            <Select
              :model-value="vts.panicConfig.calibrateHotkeyId || '__none__'"
              @update:model-value="(val) => setCalibrateHotkey(val === '__none__' ? '' : String(val))"
            >
              <SelectTrigger class="w-full">
                <SelectValue placeholder="绑定：校准热键" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">未绑定</SelectItem>
                <SelectItem
                  v-for="hk in hotkeyOptions"
                  :key="hk.value"
                  :value="hk.value"
                >
                  {{ hk.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="destructive"
            class="gap-1.5 shrink-0"
            :disabled="!vts.connected || !vts.panicConfig.calibrateHotkeyId"
            @click="run(() => vts.panicCalibrate(), '已校准')"
          >
            <Crosshair class="size-3.5" />
            校准
          </Button>
        </div>
      </FormField>

      <FormField label="重置物理热键">
        <template
          v-if="resetPhysicsMissing"
          #extra
        >
          <Badge
            variant="warning"
            size="xs"
          >
            当前模型不存在
          </Badge>
        </template>
        <div class="flex items-center gap-2">
          <div class="flex-1 min-w-0">
            <Select
              :model-value="vts.panicConfig.resetPhysicsHotkeyId || '__none__'"
              @update:model-value="(val) => setResetPhysicsHotkey(val === '__none__' ? '' : String(val))"
            >
              <SelectTrigger class="w-full">
                <SelectValue placeholder="绑定：重置物理热键" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">未绑定</SelectItem>
                <SelectItem
                  v-for="hk in hotkeyOptions"
                  :key="hk.value"
                  :value="hk.value"
                >
                  {{ hk.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="destructive"
            class="gap-1.5 shrink-0"
            :disabled="!vts.connected || !vts.panicConfig.resetPhysicsHotkeyId"
            @click="run(() => vts.panicResetPhysics(), '已重置物理')"
          >
            <RotateCcw class="size-3.5" />
            重置物理
          </Button>
        </div>
      </FormField>
    </CardContent>
  </Card>
</template>
