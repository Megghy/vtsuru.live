<script setup lang="ts">
import { computed, ref } from 'vue'

import type { VtsAccessoryBinding, VtsPrankBinding } from '@/apps/client/store/useVtsStore'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'

import { useVtsAction } from './useVtsAction'

const vts = useVtsStore()
const { run } = useVtsAction()

const instanceOptions = computed(() =>
  vts.itemInstancesInScene.map((i) => ({
    label: `${i.fileName} (${i.instanceID.slice(0, 8)})${i.pinnedToModel ? ' [固定]' : ''}`,
    value: i.instanceID,
  })),
)

const fileOptions = computed(() =>
  vts.availableItemFiles.map((f) => ({
    label: `${f.fileName} (已加载: ${f.loadedCount})`,
    value: f.fileName,
  })),
)

const hotkeyOptions = computed(() =>
  vts.hotkeys.map((h) => ({
    label: `${h.name} (${h.hotkeyID.slice(0, 8)})`,
    value: h.hotkeyID,
  })),
)

const refreshing = ref(false)

function refresh() {
  if (refreshing.value) return
  refreshing.value = true
  run(async () => {
    try {
      await vts.refreshItems({ includeFiles: true })
    } finally {
      refreshing.value = false
    }
  }, '已刷新')
}

function addAccessory() {
  run(() => vts.createAccessory(), '已添加')
}

async function saveAccessory(next: VtsAccessoryBinding) {
  await vts.upsertAccessory(next)
  if (next.itemInstanceID) {
    run(() => vts.setItemOpacity(next.itemInstanceID, next.visible ? 1 : 0))
  }
}

function toggleAccessory(acc: VtsAccessoryBinding, visible: boolean) {
  run(() => vts.toggleAccessory(acc.id, visible), visible ? '已显示' : '已隐藏')
}

function addPrank() {
  run(() => vts.createPrank(), '已添加')
}

async function savePrank(next: VtsPrankBinding) {
  await vts.upsertPrank(next)
}

function loadPrank(p: VtsPrankBinding) {
  run(async () => {
    if (!p.fileName) throw new Error('未选择文件')
    await vts.loadItem(p.fileName, { x: 0, y: 0.5, size: 0.32, fadeTime: 0.15 })
    await vts.refreshItems({ includeFiles: true })
  }, '已加载')
}

function unloadPrank(p: VtsPrankBinding) {
  run(async () => {
    if (!p.fileName) throw new Error('未选择文件')
    await vts.unloadItems({ fileNames: [p.fileName] })
    await vts.refreshItems({ includeFiles: true })
  }, '已卸载')
}

function dropPrank(p: VtsPrankBinding) {
  run(async () => {
    if (p.hotkeyID) {
      await vts.triggerHotkey(p.hotkeyID)
      return
    }
    if (!p.fileName) throw new Error('未选择文件或热键')
    await vts.dropItem(p.fileName, { x: 0, size: 0.32 })
    await vts.refreshItems({ includeFiles: true })
  }, '已掉落')
}
</script>

<template>
  <Card class="border bg-card">
    <CardHeader class="p-3 pb-2 border-b flex flex-row items-center justify-between">
      <CardTitle class="text-sm font-semibold">道具管理</CardTitle>
      <div class="flex items-center gap-2">
        <Button variant="secondary" :disabled="!vts.connected || refreshing" @click="refresh">
          {{ refreshing ? '刷新中...' : '刷新列表' }}
        </Button>
        <span class="text-xs text-muted-foreground">
          {{ vts.canLoadItems == null ? '状态未知' : vts.canLoadItems ? '可操作' : '当前不可操作 (VTS 有弹窗)' }}
        </span>
      </div>
    </CardHeader>

    <CardContent class="p-3">
      <Tabs defaultValue="accessories" class="w-full">
        <TabsList class="grid w-full grid-cols-2 max-w-[200px]">
          <TabsTrigger value="accessories" class="text-xs">
            配饰
          </TabsTrigger>
          <TabsTrigger value="pranks" class="text-xs">
            整活
          </TabsTrigger>
        </TabsList>

        <!-- 配饰 Tab -->
        <TabsContent value="accessories" class="pt-3 space-y-3">
          <div class="flex items-center gap-2 flex-wrap">
            <Button @click="addAccessory">
              添加配饰
            </Button>
            <span class="text-xs text-muted-foreground">
              绑定场景中的道具实例，通过透明度切换显隐
            </span>
          </div>

          <div class="space-y-2 pt-1">
            <div
              v-for="acc in vts.accessories"
              :key="acc.id"
              class="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-md border bg-muted/20"
            >
              <div class="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                <Input v-model="acc.name" placeholder="名称" class="w-[120px]" @blur="saveAccessory({ ...acc })" />
                <div class="flex-1 min-w-[200px]">
                  <Select
                    :model-value="acc.itemInstanceID"
                    @update:model-value="(val) => saveAccessory({ ...acc, itemInstanceID: String(val ?? '') })"
                  >
                    <SelectTrigger class="w-full">
                      <SelectValue placeholder="选择场景中的道具实例" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="opt in instanceOptions"
                        :key="opt.value"
                        :value="opt.value"
                        class="text-xs"
                      >
                        {{ opt.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="flex items-center gap-1.5 cursor-pointer select-none">
                  <Switch :checked="acc.visible" :disabled="!vts.connected" @update:checked="(val) => toggleAccessory(acc, val)"
                  />
                  <span class="text-xs text-muted-foreground">{{ acc.visible ? '显示' : '隐藏' }}</span>
                </div>
              </div>

              <Button size="xs" variant="outline" class="border-destructive/40 text-destructive hover:bg-destructive/10" @click="vts.removeAccessory(acc.id)">
                删除
              </Button>
            </div>
          </div>
        </TabsContent>

        <!-- 整活 Tab -->
        <TabsContent value="pranks" class="pt-3 space-y-3">
          <div class="flex items-center gap-2 flex-wrap">
            <Button @click="addPrank">
              添加整活
            </Button>
            <span class="text-xs text-muted-foreground">
              通过文件掉落或触发热键来丢道具
            </span>
          </div>

          <div class="space-y-2 pt-1">
            <div
              v-for="p in vts.pranks"
              :key="p.id"
              class="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-md border bg-muted/20"
            >
              <div class="flex flex-wrap items-center gap-2.5 flex-1 min-w-[320px]">
                <Input v-model="p.name" placeholder="名称" class="w-[110px]" @blur="savePrank({ ...p })" />
                <div class="w-[200px]">
                  <Select
                    :model-value="p.fileName"
                    @update:model-value="(val) => savePrank({ ...p, fileName: String(val ?? '') })"
                  >
                    <SelectTrigger class="w-full">
                      <SelectValue placeholder="选择道具文件" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="opt in fileOptions"
                        :key="opt.value"
                        :value="opt.value"
                        class="text-xs"
                      >
                        {{ opt.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="w-[200px]">
                  <Select
                    :model-value="p.hotkeyID || ''"
                    @update:model-value="(val) => savePrank({ ...p, hotkeyID: val ? String(val) : undefined })"
                  >
                    <SelectTrigger class="w-full">
                      <SelectValue placeholder="或绑定热键 (可选)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="" class="text-xs">无热键</SelectItem>
                      <SelectItem
                        v-for="opt in hotkeyOptions"
                        :key="opt.value"
                        :value="opt.value"
                        class="text-xs"
                      >
                        {{ opt.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div class="flex items-center gap-1.5 flex-wrap">
                <Button size="xs" variant="outline" :disabled="!vts.connected || !p.fileName" @click="loadPrank(p)">
                  加载
                </Button>
                <Button size="xs" variant="outline" :disabled="!vts.connected || !p.fileName" @click="unloadPrank(p)">
                  卸载
                </Button>
                <Button size="xs" :disabled="!vts.connected" @click="dropPrank(p)">
                  掉落
                </Button>
                <Button size="xs" variant="outline" class="border-destructive/40 text-destructive hover:bg-destructive/10" @click="vts.removePrank(p.id)">
                  删除
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </CardContent>
  </Card>
</template>
