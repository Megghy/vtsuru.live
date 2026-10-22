<script setup lang="ts">
import { Add24Regular, ArrowImport24Regular, Checkmark24Regular, Delete24Regular, Edit24Regular } from '@vicons/fluent'
import { computed, reactive, ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import type { VtsDeckTile } from '@/apps/client/store/useVtsStore'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { newDeckTile } from '@/apps/client/store/vts/deck'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'

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

const tiles = computed({
  get: () => vts.deckTiles,
  set: (next) => void run(() => vts.saveDeck(next)),
})

function openEditor(tile = newDeckTile('expression')) {
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
  void run(async () => {
    const added = await vts.addExpressionTiles()
    message.info(added ? `已添加 ${added} 个表情` : '当前模型的表情都已在操作台中')
  })
}
</script>

<template>
  <Card class="border bg-card">
    <CardHeader class="p-3 pb-2 border-b flex flex-row items-center justify-between">
      <CardTitle class="text-sm font-semibold">操作台</CardTitle>
      <div class="flex items-center gap-2">
        <Button
          v-if="editing"
          variant="outline"
          class="gap-1"
          :disabled="!vts.connected || vts.expressions.length === 0"
          @click="addExpressions"
        >
          <ArrowImport24Regular class="size-3.5" />
          导入当前模型表情
        </Button>
        <Button
          v-if="editing"
          variant="outline"
          class="gap-1"
          @click="openEditor()"
        >
          <Add24Regular class="size-3.5" />
          添加格子
        </Button>
        <Button
          :variant="editing ? 'default' : 'secondary'"
          class="gap-1"
          @click="editing = !editing"
        >
          <Checkmark24Regular
            v-if="editing"
            class="size-3.5"
          />
          <Edit24Regular
            v-else
            class="size-3.5"
          />
          {{ editing ? '完成' : '编辑' }}
        </Button>
      </div>
    </CardHeader>

    <CardContent class="p-3 space-y-3">
      <div
        v-if="editing"
        class="text-xs text-muted-foreground"
      >
        拖动格子调整顺序，点击格子修改动作、颜色与全局快捷键
      </div>
      <Alert
        v-if="vts.deckShortcutError"
        class="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 py-2 px-2.5"
      >
        <AlertDescription class="text-xs m-0"> 全局快捷键注册失败：{{ vts.deckShortcutError }} </AlertDescription>
      </Alert>

      <div
        v-if="tiles.length === 0"
        class="py-6 flex flex-col items-center justify-center"
      >
        <Empty description="把常用的表情、热键、宏、机位预设放到这里，一键切换">
          <div class="flex items-center justify-center gap-2 mt-3">
            <Button
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
        </Empty>
      </div>

      <VueDraggable
        v-else
        v-model="tiles"
        class="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2.5"
        :animation="150"
        :disabled="!editing"
        force-fallback
        :fallback-tolerance="4"
      >
        <div
          v-for="tile in tiles"
          :key="tile.id"
          role="button"
          :tabindex="tileDisabled ? -1 : 0"
          class="relative flex flex-col items-center justify-center gap-1 min-w-0 aspect-[5/4] p-2 border border-border rounded-md bg-popover select-none transition-all duration-150"
          :class="[
            tileDisabled
              ? 'cursor-not-allowed opacity-50'
              : 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97]',
            vts.isDeckTileActive(tile)
              ? 'bg-primary/15 shadow-[0_0_0_2px_var(--primary)]'
              : '',
            isTargetMissing(tile.type, tile.targetId)
              ? 'border-dashed opacity-60'
              : '',
            editing ? 'cursor-grab' : '',
          ]"
          :style="{
            borderTopWidth: '3px',
            borderTopColor: tile.color || 'var(--primary)',
          }"
          @click="onTileClick(tile)"
          @keydown.enter.space.prevent="onTileClick(tile)"
        >
          <component
            :is="DECK_TYPE_META[tile.type].icon"
            class="size-5 flex"
            :style="{ color: tile.color || 'var(--primary)' }"
          />
          <span class="max-w-full overflow-hidden text-[13px] font-semibold text-ellipsis whitespace-nowrap">{{ tile.label }}</span>
          <span class="text-[11px] text-muted-foreground">
            {{ isTargetMissing(tile.type, tile.targetId) ? '目标不存在' : DECK_TYPE_META[tile.type].label }}
          </span>
          <div
            v-if="running.has(tile.id)"
            class="absolute top-1.5 left-1.5 size-3 border-2 border-primary/20 border-t-primary rounded-full animate-spin"
          />
          <kbd
            v-if="tile.shortcut"
            class="absolute right-1 bottom-1 px-1 border border-border rounded font-inherit text-[10px] text-muted-foreground"
            >{{ tile.shortcut.replaceAll('Digit', '').replaceAll('Key', '') }}</kbd
          >
          <button
            v-if="editing"
            type="button"
            class="absolute top-1 right-1 size-5 rounded-full flex items-center justify-center bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-colors"
            @click.stop="run(() => vts.removeDeckTile(tile.id))"
          >
            <Delete24Regular class="size-3" />
          </button>
        </div>
      </VueDraggable>
    </CardContent>

    <VtsDeckTileEditor
      v-model:show="showEditor"
      :tile="editorTile"
    />
  </Card>
</template>
