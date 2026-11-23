<script setup lang="ts">
import { ArrowDownToLine, Pin, PinOff, Plus, RefreshCw, Trash2 } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'

import type { VtsAccessoryBinding, VtsPrankBinding } from '@/apps/client/store/useVtsStore'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'

import { useVtsAction } from './useVtsAction'

const vts = useVtsStore()
const { run } = useVtsAction()

const aliveInstanceIds = computed(() => new Set(vts.itemInstancesInScene.map((i) => i.instanceID)))

const instanceOptions = computed(() =>
  vts.itemInstancesInScene.map((i) => ({
    label: `${i.fileName} (${i.instanceID.slice(0, 8)})${i.pinnedToModel ? ' [固定]' : ''}`,
    value: i.instanceID,
    fileName: i.fileName,
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

function refresh(silent = false) {
  if (refreshing.value || !vts.connected) return
  refreshing.value = true
  run(
    async () => {
      try {
        await vts.refreshItems({ includeFiles: true })
      } finally {
        refreshing.value = false
      }
    },
    silent ? undefined : '已刷新道具列表',
  )
}

onMounted(() => {
  if (vts.connected && vts.itemInstancesInScene.length === 0 && vts.availableItemFiles.length === 0) {
    refresh(true)
  }
})

function addAccessory() {
  run(() => vts.createAccessory(), '已添加配饰')
}

function saveAccessoryMeta(next: VtsAccessoryBinding) {
  void run(() => vts.upsertAccessory(next))
}

function bindAccessoryInstance(acc: VtsAccessoryBinding, instanceID: string) {
  const matched = vts.itemInstancesInScene.find((i) => i.instanceID === instanceID)
  const next: VtsAccessoryBinding = {
    ...acc,
    itemInstanceID: instanceID,
    fileName: matched?.fileName ?? acc.fileName,
  }
  void run(async () => {
    await vts.upsertAccessory(next)
    if (instanceID && vts.connected) {
      await vts.setItemOpacity(instanceID, next.visible ? 1 : 0)
    }
  })
}

function toggleAccessory(acc: VtsAccessoryBinding, visible: boolean) {
  run(() => vts.toggleAccessory(acc.id, visible), visible ? '已显示' : '已隐藏')
}

function getAccessoryStatus(acc: VtsAccessoryBinding) {
  if (!acc.itemInstanceID) return { text: '未绑定', variant: 'secondary' as const }
  if (!vts.connected) return { text: '未连接', variant: 'secondary' as const }
  if (aliveInstanceIds.value.has(acc.itemInstanceID)) return { text: '在线', variant: 'success' as const }
  return { text: '实例失效', variant: 'warning' as const }
}

function addPrank() {
  run(() => vts.createPrank(), '已添加整活')
}

function savePrank(next: VtsPrankBinding) {
  void run(() => vts.upsertPrank(next))
}

function loadPrank(p: VtsPrankBinding) {
  run(async () => {
    if (!p.fileName) throw new Error('未选择文件')
    await vts.loadItem(p.fileName, { x: p.dropX ?? 0, y: 0.5, size: p.dropSize ?? 0.32, fadeTime: 0.15 })
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
    await vts.dropItem(p.fileName, { x: p.dropX ?? 0, size: p.dropSize ?? 0.32, randomX: p.randomX })
    await vts.refreshItems({ includeFiles: true })
  }, '已掉落')
}

function unloadSingleInstance(instanceID: string) {
  run(async () => {
    await vts.unloadItems({ instanceIDs: [instanceID] })
    await vts.refreshItems({ includeFiles: true })
  }, '已卸载道具')
}
</script>

<template>
  <Card>
    <CardHeader class="p-3 border-b flex flex-row items-center justify-between gap-2 flex-wrap">
      <div class="flex items-center gap-2">
        <CardTitle>道具管理</CardTitle>
        <Badge
          v-if="vts.canLoadItems != null"
          :variant="vts.canLoadItems ? 'success' : 'warning'"
          size="xs"
        >
          {{ vts.canLoadItems ? '可操作' : 'VTS 有弹窗阻挡' }}
        </Badge>
      </div>
      <div class="flex items-center gap-2">
        <Popconfirm
          title="确认卸载全部由本插件加载的道具？"
          @confirm="run(() => vts.unloadAllPluginItems(), '已清理插件道具')"
        >
          <Button
            size="xs"
            variant="outline"
            :disabled="!vts.connected"
          >
            清理插件道具
          </Button>
        </Popconfirm>
        <Button
          variant="secondary"
          class="gap-1.5"
          :disabled="!vts.connected || refreshing"
          @click="refresh()"
        >
          <RefreshCw
            class="size-3.5"
            :class="refreshing ? 'animate-spin' : ''"
          />
          {{ refreshing ? '刷新中...' : '刷新列表' }}
        </Button>
      </div>
    </CardHeader>

    <CardContent class="p-3">
      <Tabs
        default-value="accessories"
        class="w-full"
      >
        <TabsList class="grid w-full grid-cols-3 max-w-sm">
          <TabsTrigger value="accessories">配饰 ({{ vts.accessories.length }})</TabsTrigger>
          <TabsTrigger value="pranks">整活 ({{ vts.pranks.length }})</TabsTrigger>
          <TabsTrigger value="scene">场景道具 ({{ vts.itemInstancesInScene.length }})</TabsTrigger>
        </TabsList>

        <!-- 配饰 Tab -->
        <TabsContent
          value="accessories"
          class="pt-3 space-y-3"
        >
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <span class="text-xs text-muted-foreground">
              绑定场景中的道具实例，通过透明度切换显隐；重启 VTS 后将按文件名自动重新匹配
            </span>
            <Button
              class="gap-1.5"
              @click="addAccessory"
            >
              <Plus class="size-3.5" />
              添加配饰
            </Button>
          </div>

          <div
            v-if="vts.accessories.length === 0"
            class="py-6"
          >
            <Empty description="暂无配饰绑定，点击「添加配饰」绑定场景道具实例" />
          </div>

          <div
            v-else
            class="space-y-2"
          >
            <div
              v-for="acc in vts.accessories"
              :key="acc.id"
              class="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-md border border-border bg-muted/20"
            >
              <div class="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                <Input
                  v-model="acc.name"
                  placeholder="配饰名称"
                  class="w-32"
                  @blur="saveAccessoryMeta({ ...acc })"
                />
                <div class="flex-1 min-w-[200px]">
                  <Select
                    :model-value="acc.itemInstanceID"
                    @update:model-value="(val) => bindAccessoryInstance(acc, String(val ?? ''))"
                  >
                    <SelectTrigger class="w-full">
                      <SelectValue :placeholder="acc.fileName ? `原文件: ${acc.fileName}` : '选择场景中的道具实例'" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="opt in instanceOptions"
                        :key="opt.value"
                        :value="opt.value"
                      >
                        {{ opt.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Badge
                  :variant="getAccessoryStatus(acc).variant"
                  size="xs"
                >
                  {{ getAccessoryStatus(acc).text }}
                </Badge>
                <label class="flex items-center gap-1.5 cursor-pointer select-none">
                  <Switch
                    :checked="acc.visible"
                    :disabled="!vts.connected || !acc.itemInstanceID"
                    @update:checked="(val) => toggleAccessory(acc, val)"
                  />
                  <span class="text-xs text-muted-foreground">{{ acc.visible ? '显示' : '隐藏' }}</span>
                </label>
              </div>

              <Popconfirm
                title="确认删除此配饰绑定？"
                @confirm="vts.removeAccessory(acc.id)"
              >
                <Button
                  size="xs"
                  variant="outline"
                  class="border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  删除
                </Button>
              </Popconfirm>
            </div>
          </div>
        </TabsContent>

        <!-- 整活 Tab -->
        <TabsContent
          value="pranks"
          class="pt-3 space-y-3"
        >
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <span class="text-xs text-muted-foreground">通过道具文件掉落或触发热键丢道具，可自定义落点与大小</span>
            <Button
              class="gap-1.5"
              @click="addPrank"
            >
              <Plus class="size-3.5" />
              添加整活
            </Button>
          </div>

          <div
            v-if="vts.pranks.length === 0"
            class="py-6"
          >
            <Empty description="暂无整活配置，可绑定道具文件实现一键掉落或接入自动操作" />
          </div>

          <div
            v-else
            class="space-y-2"
          >
            <div
              v-for="p in vts.pranks"
              :key="p.id"
              class="p-2.5 rounded-md border border-border bg-muted/20 space-y-2.5"
            >
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="flex flex-wrap items-center gap-2 flex-1 min-w-[300px]">
                  <Input
                    v-model="p.name"
                    placeholder="名称"
                    class="w-32"
                    @blur="savePrank({ ...p })"
                  />
                  <div class="w-48">
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
                        >
                          {{ opt.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="w-48">
                    <Select
                      :model-value="p.hotkeyID || '__none__'"
                      @update:model-value="
                        (val) => savePrank({ ...p, hotkeyID: val && val !== '__none__' ? String(val) : undefined })
                      "
                    >
                      <SelectTrigger class="w-full">
                        <SelectValue placeholder="或绑定热键 (可选)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">无热键（使用文件掉落）</SelectItem>
                        <SelectItem
                          v-for="opt in hotkeyOptions"
                          :key="opt.value"
                          :value="opt.value"
                        >
                          {{ opt.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div class="flex items-center gap-1.5 flex-wrap">
                  <Button
                    size="xs"
                    variant="outline"
                    :disabled="!vts.connected || !p.fileName"
                    @click="loadPrank(p)"
                  >
                    加载
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    :disabled="!vts.connected || !p.fileName"
                    @click="unloadPrank(p)"
                  >
                    卸载
                  </Button>
                  <Button
                    size="xs"
                    class="gap-1"
                    :disabled="!vts.connected"
                    @click="dropPrank(p)"
                  >
                    <ArrowDownToLine class="size-3" />
                    掉落
                  </Button>
                  <Popconfirm
                    title="确认删除此整活项？"
                    @confirm="vts.removePrank(p.id)"
                  >
                    <Button
                      size="xs"
                      variant="outline"
                      class="border-destructive/40 text-destructive hover:bg-destructive/10"
                    >
                      删除
                    </Button>
                  </Popconfirm>
                </div>
              </div>

              <!-- 掉落坐标与大小配置 -->
              <div
                v-if="!p.hotkeyID"
                class="flex items-center gap-3 flex-wrap pt-2 border-t border-border/60 text-xs"
              >
                <label class="flex items-center gap-1.5 cursor-pointer select-none">
                  <Switch
                    :checked="Boolean(p.randomX)"
                    @update:checked="(val) => savePrank({ ...p, randomX: val })"
                  />
                  <span class="text-muted-foreground">随机 X 落点</span>
                </label>
                <div
                  v-if="!p.randomX"
                  class="flex items-center gap-1.5"
                >
                  <span class="text-muted-foreground">水平 X</span>
                  <NumberField
                    :model-value="p.dropX ?? 0"
                    :min="-1"
                    :max="1"
                    :step="0.05"
                    class="w-24"
                    @update:model-value="(val) => savePrank({ ...p, dropX: Number(val ?? 0) })"
                  />
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="text-muted-foreground">缩放大小</span>
                  <NumberField
                    :model-value="p.dropSize ?? 0.32"
                    :min="0.05"
                    :max="1"
                    :step="0.02"
                    class="w-24"
                    @update:model-value="(val) => savePrank({ ...p, dropSize: Number(val ?? 0.32) })"
                  />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <!-- 场景道具总览 Tab -->
        <TabsContent
          value="scene"
          class="pt-3 space-y-2"
        >
          <div
            v-if="!vts.connected"
            class="py-6"
          >
            <Empty description="连接 VTS 后可查看并管理当前场景中的所有道具实例" />
          </div>
          <div
            v-else-if="vts.itemInstancesInScene.length === 0"
            class="py-6"
          >
            <Empty description="当前 VTS 场景中没有道具实例" />
          </div>
          <div
            v-else
            class="space-y-2"
          >
            <div
              v-for="item in vts.itemInstancesInScene"
              :key="item.instanceID"
              class="flex-between gap-3 flex-wrap p-2.5 rounded-md border border-border bg-muted/20"
            >
              <div class="flex items-center gap-2 flex-wrap min-w-0">
                <span class="text-xs font-semibold text-foreground truncate">{{ item.fileName }}</span>
                <Badge
                  variant="secondary"
                  size="xs"
                >
                  {{ item.type }}
                </Badge>
                <Badge
                  v-if="item.pinnedToModel"
                  variant="default"
                  size="xs"
                >
                  已固定
                </Badge>
                <span class="text-[11px] text-muted-foreground font-mono tabular-nums">
                  ID: {{ item.instanceID.slice(0, 8) }} · 层级 {{ item.order }}
                </span>
              </div>

              <div class="flex items-center gap-1.5">
                <Button
                  size="xs"
                  variant="outline"
                  class="gap-1"
                  @click="
                    run(
                      () => vts.pinItem(item.instanceID, !item.pinnedToModel),
                      item.pinnedToModel ? '已取消固定' : '已固定到模型',
                    )
                  "
                >
                  <PinOff
                    v-if="item.pinnedToModel"
                    class="size-3"
                  />
                  <Pin
                    v-else
                    class="size-3"
                  />
                  {{ item.pinnedToModel ? '取消固定' : '固定到模型' }}
                </Button>
                <Popconfirm
                  title="确认从场景中卸载此道具？"
                  @confirm="unloadSingleInstance(item.instanceID)"
                >
                  <Button
                    size="xs"
                    variant="outline"
                    class="gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 class="size-3" />
                    卸载
                  </Button>
                </Popconfirm>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </CardContent>
  </Card>
</template>
