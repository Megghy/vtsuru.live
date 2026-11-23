<script setup lang="ts">
import { Check, Download, Layers, Loader2, Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { computed, reactive, ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import type { VtsDeckActionType, VtsDeckTile } from '@/apps/client/store/useVtsStore'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { newDeckTile } from '@/apps/client/store/vts/deck'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs'

import { DECK_TYPE_META, useDeckTargets } from './deckMeta'
import { useVtsAction } from './useVtsAction'
import VtsDeckTileEditor from './VtsDeckTileEditor.vue'

const vts = useVtsStore()
const { run, message } = useVtsAction()
const { isTargetMissing } = useDeckTargets()

const editing = ref(false)
const showEditor = ref(false)
const editorTile = ref<VtsDeckTile>(newDeckTile('expression'))
const running = reactive(new Set<string>())
const activeGroup = ref('__all__')

// 批量添加弹窗
const showBatch = ref(false)
const batchKind = ref<'hotkey' | 'preset' | 'macro' | 'postProcessing'>('hotkey')
const batchGroup = ref('')
const batchSelected = reactive(new Set<string>())

const groupNames = computed(() => {
  const names = new Set<string>()
  let hasUngrouped = false
  for (const t of vts.deckTiles) {
    const g = t.group?.trim()
    if (g) names.add(g)
    else hasUngrouped = true
  }
  return { list: [...names], hasUngrouped }
})

const tiles = computed({
  get: () => vts.deckTiles,
  set: (next) => void run(() => vts.saveDeck(next)),
})

const visibleTiles = computed(() => {
  if (activeGroup.value === '__all__') return vts.deckTiles
  if (activeGroup.value === '__ungrouped__') return vts.deckTiles.filter((t) => !t.group?.trim())
  return vts.deckTiles.filter((t) => t.group?.trim() === activeGroup.value)
})

const canDrag = computed(() => editing.value && activeGroup.value === '__all__')

function openEditor(
  tile = newDeckTile('expression', '', '', activeGroup.value.startsWith('__') ? undefined : activeGroup.value),
) {
  editorTile.value = tile
  showEditor.value = true
}

const tileDisabled = computed(() => !editing.value && !vts.connected)

async function onTileClick(tile: VtsDeckTile) {
  if (editing.value) return openEditor(tile)
  if (tileDisabled.value) return
  running.add(tile.id)
  await run(() => vts.runDeckTile(tile))
  running.delete(tile.id)
}

function addExpressions() {
  const group = activeGroup.value.startsWith('__') ? undefined : activeGroup.value
  void run(async () => {
    const added = await vts.addExpressionTiles(group)
    message.info(added ? `已添加 ${added} 个表情` : '当前模型的表情都已在操作台中')
  })
}

const batchCandidates = computed(() => {
  const existing = new Set(vts.deckTiles.map((t) => `${t.type}:${t.targetId}`))
  if (batchKind.value === 'hotkey') {
    return vts.hotkeys.map((h) => ({
      targetId: h.hotkeyID,
      label: h.name || h.hotkeyID,
      exists: existing.has(`hotkey:${h.hotkeyID}`),
    }))
  }
  if (batchKind.value === 'preset') {
    return vts.presets.map((p) => ({
      targetId: p.id,
      label: p.name,
      exists: existing.has(`preset:${p.id}`),
    }))
  }
  if (batchKind.value === 'macro') {
    return vts.macros.map((m) => ({
      targetId: m.id,
      label: m.name,
      exists: existing.has(`macro:${m.id}`),
    }))
  }
  return (vts.postProcessing?.presets ?? []).map((p) => ({
    targetId: p,
    label: p,
    exists: existing.has(`postProcessing:${p}`),
  }))
})

function openBatch() {
  batchSelected.clear()
  batchGroup.value = activeGroup.value.startsWith('__') ? '' : activeGroup.value
  showBatch.value = true
}

function toggleBatchItem(targetId: string, checked: boolean) {
  if (checked) batchSelected.add(targetId)
  else batchSelected.delete(targetId)
}

function selectAllBatch() {
  for (const item of batchCandidates.value) {
    if (!item.exists) batchSelected.add(item.targetId)
  }
}

function confirmBatchAdd() {
  const type = batchKind.value as VtsDeckActionType
  const group = batchGroup.value.trim() || undefined
  const items = batchCandidates.value
    .filter((c) => batchSelected.has(c.targetId))
    .map((c) => ({ type, targetId: c.targetId, label: c.label, group }))
  if (items.length === 0) return
  void run(async () => {
    const added = await vts.addDeckTiles(items)
    message.success(`已添加 ${added} 个格子`)
    showBatch.value = false
  })
}
</script>

<template>
  <Card>
    <CardHeader class="p-3 border-b flex flex-row items-center justify-between gap-2 flex-wrap">
      <div class="flex items-center gap-2">
        <CardTitle>操作台</CardTitle>
        <Badge
          v-if="vts.deckTiles.length > 0"
          variant="secondary"
          size="xs"
          class="tabular-nums"
        >
          {{ vts.deckTiles.length }}
        </Badge>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <Button
          v-if="editing"
          variant="outline"
          class="gap-1.5"
          :disabled="!vts.connected || vts.expressions.length === 0"
          @click="addExpressions"
        >
          <Download class="size-3.5" />
          导入表情
        </Button>
        <Button
          v-if="editing"
          variant="outline"
          class="gap-1.5"
          @click="openBatch"
        >
          <Layers class="size-3.5" />
          批量添加
        </Button>
        <Button
          v-if="editing"
          variant="outline"
          class="gap-1.5"
          @click="openEditor()"
        >
          <Plus class="size-3.5" />
          添加格子
        </Button>
        <Button
          :variant="editing ? 'default' : 'secondary'"
          class="gap-1.5"
          @click="editing = !editing"
        >
          <Check
            v-if="editing"
            class="size-3.5"
          />
          <Pencil
            v-else
            class="size-3.5"
          />
          {{ editing ? '完成' : '编辑' }}
        </Button>
      </div>
    </CardHeader>

    <CardContent class="p-3 space-y-3">
      <!-- 分组筛选条 -->
      <div
        v-if="groupNames.list.length > 0"
        class="flex items-center gap-1.5 flex-wrap"
      >
        <Button
          size="xs"
          :variant="activeGroup === '__all__' ? 'default' : 'outline'"
          @click="activeGroup = '__all__'"
        >
          全部
        </Button>
        <Button
          v-for="g in groupNames.list"
          :key="g"
          size="xs"
          :variant="activeGroup === g ? 'default' : 'outline'"
          @click="activeGroup = g"
        >
          {{ g }}
        </Button>
        <Button
          v-if="groupNames.hasUngrouped"
          size="xs"
          :variant="activeGroup === '__ungrouped__' ? 'default' : 'outline'"
          @click="activeGroup = '__ungrouped__'"
        >
          未分组
        </Button>
      </div>

      <div
        v-if="editing"
        class="text-xs text-muted-foreground"
      >
        {{
          canDrag
            ? '拖动格子调整顺序，点击格子修改动作、分组、颜色与全局快捷键'
            : '当前处于分组视图，切回「全部」可拖拽排序；点击格子可编辑'
        }}
      </div>

      <Alert
        size="sm"
        variant="warning"
        v-if="vts.deckShortcutError"
      >
        <AlertDescription class="m-0">{{ vts.deckShortcutError }}</AlertDescription>
      </Alert>

      <div
        v-if="visibleTiles.length === 0"
        class="py-6 flex-col-center"
      >
        <Empty
          :description="
            vts.deckTiles.length === 0 ? '把常用的表情、热键、宏、机位预设或滤镜放到这里，一键切换' : '该分组下暂无格子'
          "
        >
          <template #extra>
            <div class="flex-center gap-2">
              <Button
                v-if="vts.deckTiles.length === 0"
                :disabled="!vts.connected || vts.expressions.length === 0"
                @click="addExpressions"
              >
                导入当前模型表情
              </Button>
              <Button
                variant="outline"
                @click="openEditor()"
              >
                手动添加
              </Button>
            </div>
          </template>
        </Empty>
      </div>

      <VueDraggable
        v-else-if="activeGroup === '__all__'"
        v-model="tiles"
        class="grid grid-cols-[repeat(auto-fill,minmax(116px,1fr))] gap-2.5"
        :animation="150"
        :disabled="!canDrag"
        force-fallback
        :fallback-tolerance="4"
      >
        <div
          v-for="tile in tiles"
          :key="tile.id"
          role="button"
          :tabindex="tileDisabled ? -1 : 0"
          class="relative flex-col-center gap-1 min-w-0 aspect-[5/4] p-2 border border-border rounded-md bg-popover select-none transition-transform duration-150"
          :class="[
            tileDisabled
              ? 'cursor-not-allowed opacity-50'
              : 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97]',
            vts.isDeckTileActive(tile) ? 'bg-primary/15 shadow-[0_0_0_2px_var(--primary)]' : '',
            isTargetMissing(tile.type, tile.targetId) ? 'border-dashed opacity-60' : '',
            canDrag ? 'cursor-grab' : '',
          ]"
          :style="{
            borderTopWidth: '3px',
            borderTopColor:
              tile.color ||
              (tile.type === 'colorTint' && tile.targetId.startsWith('#') ? tile.targetId : 'var(--primary)'),
          }"
          @click="onTileClick(tile)"
          @keydown.enter.space.prevent="onTileClick(tile)"
        >
          <component
            :is="DECK_TYPE_META[tile.type].icon"
            class="size-5 shrink-0"
            :style="{
              color:
                tile.color ||
                (tile.type === 'colorTint' && tile.targetId.startsWith('#') ? tile.targetId : 'var(--primary)'),
            }"
          />
          <span class="max-w-full overflow-hidden text-xs font-semibold text-ellipsis whitespace-nowrap">{{
            tile.label
          }}</span>
          <span class="text-[11px] text-muted-foreground">
            {{ isTargetMissing(tile.type, tile.targetId) ? '目标不存在' : DECK_TYPE_META[tile.type].label }}
          </span>
          <Loader2
            v-if="running.has(tile.id)"
            class="absolute top-1.5 left-1.5 size-3 text-primary animate-spin"
          />
          <kbd
            v-if="tile.shortcut"
            class="absolute right-1 bottom-1 px-1 border border-border rounded font-inherit text-[10px] text-muted-foreground"
            >{{ tile.shortcut.replaceAll('Digit', '').replaceAll('Key', '') }}</kbd
          >
          <Button
            v-if="editing"
            variant="ghost"
            size="none"
            class="absolute top-1 right-1 size-5 rounded-full text-destructive hover:bg-destructive hover:text-destructive-foreground"
            aria-label="删除"
            @click.stop="run(() => vts.removeDeckTile(tile.id))"
          >
            <Trash2 class="size-3" />
          </Button>
        </div>
      </VueDraggable>

      <div
        v-else
        class="grid grid-cols-[repeat(auto-fill,minmax(116px,1fr))] gap-2.5"
      >
        <div
          v-for="tile in visibleTiles"
          :key="tile.id"
          role="button"
          :tabindex="tileDisabled ? -1 : 0"
          class="relative flex-col-center gap-1 min-w-0 aspect-[5/4] p-2 border border-border rounded-md bg-popover select-none transition-transform duration-150"
          :class="[
            tileDisabled
              ? 'cursor-not-allowed opacity-50'
              : 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97]',
            vts.isDeckTileActive(tile) ? 'bg-primary/15 shadow-[0_0_0_2px_var(--primary)]' : '',
            isTargetMissing(tile.type, tile.targetId) ? 'border-dashed opacity-60' : '',
          ]"
          :style="{
            borderTopWidth: '3px',
            borderTopColor:
              tile.color ||
              (tile.type === 'colorTint' && tile.targetId.startsWith('#') ? tile.targetId : 'var(--primary)'),
          }"
          @click="onTileClick(tile)"
          @keydown.enter.space.prevent="onTileClick(tile)"
        >
          <component
            :is="DECK_TYPE_META[tile.type].icon"
            class="size-5 shrink-0"
            :style="{
              color:
                tile.color ||
                (tile.type === 'colorTint' && tile.targetId.startsWith('#') ? tile.targetId : 'var(--primary)'),
            }"
          />
          <span class="max-w-full overflow-hidden text-xs font-semibold text-ellipsis whitespace-nowrap">{{
            tile.label
          }}</span>
          <span class="text-[11px] text-muted-foreground">
            {{ isTargetMissing(tile.type, tile.targetId) ? '目标不存在' : DECK_TYPE_META[tile.type].label }}
          </span>
          <Loader2
            v-if="running.has(tile.id)"
            class="absolute top-1.5 left-1.5 size-3 text-primary animate-spin"
          />
          <kbd
            v-if="tile.shortcut"
            class="absolute right-1 bottom-1 px-1 border border-border rounded font-inherit text-[10px] text-muted-foreground"
            >{{ tile.shortcut.replaceAll('Digit', '').replaceAll('Key', '') }}</kbd
          >
          <Button
            v-if="editing"
            variant="ghost"
            size="none"
            class="absolute top-1 right-1 size-5 rounded-full text-destructive hover:bg-destructive hover:text-destructive-foreground"
            aria-label="删除"
            @click.stop="run(() => vts.removeDeckTile(tile.id))"
          >
            <Trash2 class="size-3" />
          </Button>
        </div>
      </div>
    </CardContent>

    <VtsDeckTileEditor
      v-model:show="showEditor"
      :tile="editorTile"
    />

    <!-- 批量添加弹窗 -->
    <Dialog v-model:open="showBatch">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle class="text-base">批量添加到操作台</DialogTitle>
        </DialogHeader>

        <div class="space-y-3 py-2">
          <Tabs
            v-model="batchKind"
            @update:model-value="batchSelected.clear()"
          >
            <TabsList class="grid w-full grid-cols-4">
              <TabsTrigger value="hotkey">热键</TabsTrigger>
              <TabsTrigger value="preset">机位</TabsTrigger>
              <TabsTrigger value="macro">宏</TabsTrigger>
              <TabsTrigger value="postProcessing">滤镜</TabsTrigger>
            </TabsList>
          </Tabs>

          <FormField label="归属分组（可选）">
            <Input
              v-model="batchGroup"
              placeholder="留空则不分组"
              maxlength="12"
            />
          </FormField>

          <div class="flex-between">
            <span class="text-[11px] text-muted-foreground">已选 {{ batchSelected.size }} 项</span>
            <Button
              size="xs"
              variant="ghost"
              :disabled="batchCandidates.every((c) => c.exists)"
              @click="selectAllBatch"
            >
              全选未添加
            </Button>
          </div>

          <div
            v-if="batchCandidates.length === 0"
            class="py-6"
          >
            <Empty description="当前类型暂无可添加项" />
          </div>
          <div
            v-else
            class="max-h-60 overflow-y-auto scrollbar-thin space-y-1.5 pr-1"
          >
            <label
              v-for="item in batchCandidates"
              :key="item.targetId"
              class="flex-between gap-2 p-2 rounded-md border border-border bg-muted/20 text-xs"
              :class="item.exists ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-muted/50'"
            >
              <div class="flex items-center gap-2 min-w-0">
                <Checkbox
                  :disabled="item.exists"
                  :model-value="item.exists || batchSelected.has(item.targetId)"
                  @update:model-value="(val) => toggleBatchItem(item.targetId, Boolean(val))"
                />
                <span class="truncate">{{ item.label }}</span>
              </div>
              <Badge
                v-if="item.exists"
                variant="secondary"
                size="xs"
              >
                已在操作台
              </Badge>
            </label>
          </div>
        </div>

        <DialogFooter class="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            @click="showBatch = false"
          >
            取消
          </Button>
          <Button
            :disabled="batchSelected.size === 0"
            @click="confirmBatchAdd"
          >
            添加 ({{ batchSelected.size }})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </Card>
</template>
