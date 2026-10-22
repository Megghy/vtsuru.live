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
        <Button v-if="editing" variant="outline" class="gap-1" :disabled="!vts.connected || vts.expressions.length === 0" @click="addExpressions">
          <ArrowImport24Regular class="size-3.5" />
          导入当前模型表情
        </Button>
        <Button v-if="editing" variant="outline" class="gap-1" @click="openEditor()">
          <Add24Regular class="size-3.5" />
          添加格子
        </Button>
        <Button :variant="editing ? 'default' : 'secondary'" class="gap-1" @click="editing = !editing">
          <Checkmark24Regular v-if="editing" class="size-3.5" />
          <Edit24Regular v-else class="size-3.5" />
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
        <AlertDescription class="text-xs m-0">
          全局快捷键注册失败：{{ vts.deckShortcutError }}
        </AlertDescription>
      </Alert>

      <div
        v-if="tiles.length === 0"
        class="py-6 flex flex-col items-center justify-center"
      >
        <Empty description="把常用的表情、热键、宏、机位预设放到这里，一键切换">
          <div class="flex items-center justify-center gap-2 mt-3">
            <Button :disabled="!vts.connected || vts.expressions.length === 0" @click="addExpressions">
              导入当前模型表情
            </Button>
            <Button variant="outline" @click="openEditor()">
              手动添加
            </Button>
          </div>
        </Empty>
      </div>

      <VueDraggable
        v-else
        v-model="tiles"
        class="deck-grid"
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
          class="deck-tile"
          :class="{
            'is-disabled': tileDisabled,
            'is-active': vts.isDeckTileActive(tile),
            'is-missing': isTargetMissing(tile.type, tile.targetId),
            'is-editing': editing,
          }"
          :style="tile.color ? { '--tile-color': tile.color } : undefined"
          @click="onTileClick(tile)"
          @keydown.enter.space.prevent="onTileClick(tile)"
        >
          <component
            :is="DECK_TYPE_META[tile.type].icon"
            class="deck-tile-icon size-5"
          />
          <span class="deck-tile-label">{{ tile.label }}</span>
          <span class="deck-tile-sub">
            {{ isTargetMissing(tile.type, tile.targetId) ? '目标不存在' : DECK_TYPE_META[tile.type].label }}
          </span>
          <div
            v-if="running.has(tile.id)"
            class="deck-tile-spin size-3 border-2 border-primary/20 border-t-primary rounded-full animate-spin"
          />
          <kbd
            v-if="tile.shortcut"
            class="deck-tile-kbd"
          >{{ tile.shortcut.replaceAll('Digit', '').replaceAll('Key', '') }}</kbd>
          <button
            v-if="editing"
            type="button"
            class="deck-tile-delete size-5 rounded-full flex items-center justify-center bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-colors"
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

<style scoped>
.deck-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 10px;
}

.deck-tile {
  --tile-color: var(--primary, #18a058);
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  aspect-ratio: 5 / 4;
  padding: 8px;
  border: 1px solid var(--border);
  border-top: 3px solid var(--tile-color);
  border-radius: var(--radius, 6px);
  background: var(--popover);
  cursor: pointer;
  user-select: none;
  transition:
    transform 0.12s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
}

.deck-tile:hover:not(.is-disabled) {
  transform: translateY(-1px);
  box-shadow: 0 2px 10px rgb(0 0 0 / 12%);
}

.deck-tile:active:not(.is-disabled) {
  transform: scale(0.97);
}

.deck-tile.is-disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.deck-tile.is-active {
  background: color-mix(in srgb, var(--tile-color) 18%, var(--popover));
  box-shadow: 0 0 0 2px var(--tile-color);
}

.deck-tile.is-missing {
  border-style: dashed;
  opacity: 0.6;
}

.deck-tile.is-editing {
  cursor: grab;
}

.deck-tile-spin {
  position: absolute;
  top: 6px;
  left: 6px;
}

.deck-tile-icon {
  display: flex;
  color: var(--tile-color);
}

.deck-tile-label {
  max-width: 100%;
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.deck-tile-sub {
  font-size: 11px;
  color: var(--muted-foreground);
}

.deck-tile-kbd {
  position: absolute;
  right: 4px;
  bottom: 4px;
  padding: 0 4px;
  border: 1px solid var(--border);
  border-radius: 3px;
  font-family: inherit;
  font-size: 10px;
  color: var(--muted-foreground);
}

.deck-tile-delete {
  position: absolute;
  top: 4px;
  right: 4px;
}
</style>
