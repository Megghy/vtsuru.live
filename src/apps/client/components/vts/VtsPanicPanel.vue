<script setup lang="ts">
import { computed } from 'vue'

import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'

import { useVtsAction } from './useVtsAction'

const vts = useVtsStore()
const { run } = useVtsAction()

const hotkeyOptions = computed(() => vts.hotkeys.map((hk) => ({ label: hk.name || hk.hotkeyID, value: hk.hotkeyID })))

function setCalibrateHotkey(id: string) {
  run(() => vts.setPanicConfig({ ...vts.panicConfig, calibrateHotkeyId: id }), '已保存')
}

function setResetPhysicsHotkey(id: string) {
  run(() => vts.setPanicConfig({ ...vts.panicConfig, resetPhysicsHotkeyId: id }), '已保存')
}
</script>

<template>
  <Card>
    <CardHeader class="py-3 px-4">
      <CardTitle class="text-sm font-semibold">应急控制</CardTitle>
    </CardHeader>
    <CardContent class="px-4 pb-4 pt-0 flex flex-col gap-3">
      <p class="text-xs text-[var(--vtsuru-fg-muted)]">
        选择 VTS 中已配置的热键来绑定应急操作
      </p>

      <div class="flex items-center gap-3 flex-wrap">
        <div class="w-72">
          <Select
            :model-value="vts.panicConfig.calibrateHotkeyId || '__none__'"
            @update:model-value="(val) => setCalibrateHotkey(val === '__none__' ? '' : String(val))"
          >
            <SelectTrigger class="h-8 text-xs">
              <SelectValue placeholder="绑定: 校准热键" />
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
          size="sm"
          variant="destructive"
          class="h-8 text-xs"
          :disabled="!vts.connected"
          @click="run(() => vts.panicCalibrate(), '已校准')"
        >
          一键校准
        </Button>
      </div>

      <div class="flex items-center gap-3 flex-wrap">
        <div class="w-72">
          <Select
            :model-value="vts.panicConfig.resetPhysicsHotkeyId || '__none__'"
            @update:model-value="(val) => setResetPhysicsHotkey(val === '__none__' ? '' : String(val))"
          >
            <SelectTrigger class="h-8 text-xs">
              <SelectValue placeholder="绑定: 重置物理热键" />
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
          size="sm"
          variant="destructive"
          class="h-8 text-xs"
          :disabled="!vts.connected"
          @click="run(() => vts.panicResetPhysics(), '已重置')"
        >
          重置物理
        </Button>
      </div>
    </CardContent>
  </Card>
</template>
