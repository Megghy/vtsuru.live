<script setup lang="ts">
import { Add24Regular, ArrowImport24Regular, Checkmark24Regular, Delete24Regular, Edit24Regular } from '@vicons/fluent'
import { NAlert, NButton, NCard, NEmpty, NFlex, NIcon, NSpin, NText } from 'naive-ui'
import { VueDraggable } from 'vue-draggable-plus'
import { computed, reactive, ref } from 'vue'

import { newDeckTile } from '@/apps/client/store/vts/deck'
import type { VtsDeckTile } from '@/apps/client/store/useVtsStore'
import { useVtsStore } from '@/apps/client/store/useVtsStore'

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
  <NCard
    size="small"
    bordered
    title="操作台"
  >
    <template #header-extra>
      <NFlex
        :size="8"
        align="center"
      >
        <NButton
          v-if="editing"
          size="small"
          :disabled="!vts.connected || vts.expressions.length === 0"
          @click="addExpressions"
        >
          <template #icon>
            <NIcon :component="ArrowImport24Regular" />
          </template>
          导入当前模型表情
        </NButton>
        <NButton
          v-if="editing"
          size="small"
          @click="openEditor()"
        >
          <template #icon>
            <NIcon :component="Add24Regular" />
          </template>
          添加格子
        </NButton>
        <NButton
          size="small"
          :type="editing ? 'primary' : 'default'"
          secondary
          @click="editing = !editing"
        >
          <template #icon>
            <NIcon :component="editing ? Checkmark24Regular : Edit24Regular" />
          </template>
          {{ editing ? '完成' : '编辑' }}
        </NButton>
      </NFlex>
    </template>

    <NFlex
      vertical
      :size="12"
    >
      <NText
        v-if="editing"
        depth="3"
      >
        拖动格子调整顺序，点击格子修改动作、颜色与全局快捷键
      </NText>
      <NAlert
        v-if="vts.deckShortcutError"
        type="warning"
        :show-icon="false"
      >
        全局快捷键注册失败：{{ vts.deckShortcutError }}
      </NAlert>

      <NEmpty
        v-if="tiles.length === 0"
        description="把常用的表情、热键、宏、机位预设放到这里，一键切换"
      >
        <template #extra>
          <NFlex
            justify="center"
            :size="8"
          >
            <NButton
              size="small"
              type="primary"
              :disabled="!vts.connected || vts.expressions.length === 0"
              @click="addExpressions"
            >
              导入当前模型表情
            </NButton>
            <NButton
              size="small"
              @click="openEditor()"
            >
              手动添加
            </NButton>
          </NFlex>
        </template>
      </NEmpty>

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
          <NIcon
            :component="DECK_TYPE_META[tile.type].icon"
            size="22"
            class="deck-tile-icon"
          />
          <span class="deck-tile-label">{{ tile.label }}</span>
          <span class="deck-tile-sub">
            {{ isTargetMissing(tile.type, tile.targetId) ? '目标不存在' : DECK_TYPE_META[tile.type].label }}
          </span>
          <NSpin
            v-if="running.has(tile.id)"
            size="small"
            class="deck-tile-spin"
          />
          <kbd
            v-if="tile.shortcut"
            class="deck-tile-kbd"
          >{{ tile.shortcut.replaceAll('Digit', '').replaceAll('Key', '') }}</kbd>
          <NButton
            v-if="editing"
            class="deck-tile-delete"
            size="tiny"
            circle
            type="error"
            secondary
            @click.stop="run(() => vts.removeDeckTile(tile.id))"
          >
            <template #icon>
              <NIcon :component="Delete24Regular" />
            </template>
          </NButton>
        </div>
      </VueDraggable>
    </NFlex>

    <VtsDeckTileEditor
      v-model:show="showEditor"
      :tile="editorTile"
    />
  </NCard>
</template>

<style scoped>
.deck-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 10px;
}

.deck-tile {
  --tile-color: var(--vtsuru-primary, #18a058);
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  aspect-ratio: 5 / 4;
  padding: 8px;
  border: 1px solid var(--vtsuru-border);
  border-top: 3px solid var(--tile-color);
  border-radius: var(--vtsuru-radius, 6px);
  background: var(--vtsuru-bg-elevated);
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
  background: color-mix(in srgb, var(--tile-color) 18%, var(--vtsuru-bg-elevated));
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
  color: var(--vtsuru-fg-muted);
}

.deck-tile-kbd {
  position: absolute;
  right: 4px;
  bottom: 4px;
  padding: 0 4px;
  border: 1px solid var(--vtsuru-border);
  border-radius: 3px;
  font-family: inherit;
  font-size: 10px;
  color: var(--vtsuru-fg-muted);
}

.deck-tile-delete {
  position: absolute;
  top: 4px;
  right: 4px;
}
</style>
