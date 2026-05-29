<script setup lang="ts">
import { NButton, NCard, NDivider, NFlex, NInput, NSelect, NSwitch, NTabPane, NTabs, NText } from 'naive-ui'
import { computed } from 'vue'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import type { VtsAccessoryBinding, VtsPrankBinding } from '@/apps/client/store/useVtsStore'
import { useVtsAction } from './useVtsAction'

const vts = useVtsStore()
const { run } = useVtsAction()

const instanceOptions = computed(() =>
  vts.itemInstancesInScene.map(i => ({
    label: `${i.fileName} (${i.instanceID.slice(0, 8)})${i.pinnedToModel ? ' [固定]' : ''}`,
    value: i.instanceID,
  })),
)

const fileOptions = computed(() =>
  vts.availableItemFiles.map(f => ({
    label: `${f.fileName} (已加载: ${f.loadedCount})`,
    value: f.fileName,
  })),
)

const hotkeyOptions = computed(() =>
  vts.hotkeys.map(h => ({
    label: `${h.name} (${h.hotkeyID.slice(0, 8)})`,
    value: h.hotkeyID,
  })),
)

function refresh() {
  run(() => vts.refreshItems({ includeFiles: true }), '已刷新')
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
  <NCard size="small" title="道具管理">
    <NFlex vertical :size="10">
      <NFlex align="center" :wrap="true" :size="8">
        <NButton size="small" :disabled="!vts.canOperate" @click="refresh">
          刷新列表
        </NButton>
        <NText depth="3">
          {{ vts.canLoadItems == null ? '状态未知' : (vts.canLoadItems ? '可操作' : '当前不可操作 (VTS 有弹窗)') }}
        </NText>
      </NFlex>

      <NTabs type="line" animated>
        <NTabPane name="accessories" tab="配饰">
          <NFlex vertical :size="8">
            <NFlex align="center" :wrap="true" :size="8">
              <NButton size="small" @click="addAccessory">
                添加配饰
              </NButton>
              <NText depth="3">
                绑定场景中的道具实例，通过透明度切换显隐
              </NText>
            </NFlex>
            <NDivider style="margin: 4px 0" />
            <NFlex v-for="acc in vts.accessories" :key="acc.id" align="center" justify="space-between" :wrap="true" :size="10">
              <NFlex align="center" :wrap="true" :size="10">
                <NInput v-model:value="acc.name" placeholder="名称" style="width: 140px" @blur="saveAccessory({ ...acc })" />
                <NSelect
                  style="width: 380px"
                  :options="instanceOptions"
                  :value="acc.itemInstanceID"
                  placeholder="选择场景中的道具实例"
                  @update:value="(val) => saveAccessory({ ...acc, itemInstanceID: val as string })"
                />
                <NSwitch :value="acc.visible" :disabled="!vts.canOperate" @update:value="(val) => toggleAccessory(acc, val)">
                  <template #checked>
                    显示
                  </template>
                  <template #unchecked>
                    隐藏
                  </template>
                </NSwitch>
              </NFlex>
              <NButton size="small" type="error" @click="vts.removeAccessory(acc.id)">
                删除
              </NButton>
            </NFlex>
          </NFlex>
        </NTabPane>

        <NTabPane name="pranks" tab="整活">
          <NFlex vertical :size="8">
            <NFlex align="center" :wrap="true" :size="8">
              <NButton size="small" @click="addPrank">
                添加整活
              </NButton>
              <NText depth="3">
                通过文件掉落或触发热键来丢道具
              </NText>
            </NFlex>
            <NDivider style="margin: 4px 0" />
            <NFlex v-for="p in vts.pranks" :key="p.id" align="center" justify="space-between" :wrap="true" :size="10">
              <NFlex align="center" :wrap="true" :size="10">
                <NInput v-model:value="p.name" placeholder="名称" style="width: 140px" @blur="savePrank({ ...p })" />
                <NSelect
                  style="width: 360px"
                  :options="fileOptions"
                  :value="p.fileName"
                  placeholder="选择道具文件"
                  @update:value="(val) => savePrank({ ...p, fileName: val as string })"
                />
                <NSelect
                  style="width: 360px"
                  :options="hotkeyOptions"
                  :value="p.hotkeyID"
                  placeholder="或绑定热键 (可选)"
                  clearable
                  @update:value="(val) => savePrank({ ...p, hotkeyID: typeof val === 'string' && val ? val : undefined })"
                />
              </NFlex>
              <NFlex :wrap="true" :size="8">
                <NButton size="small" :disabled="!vts.canOperate || !p.fileName" @click="loadPrank(p)">
                  加载
                </NButton>
                <NButton size="small" :disabled="!vts.canOperate || !p.fileName" @click="unloadPrank(p)">
                  卸载
                </NButton>
                <NButton size="small" type="primary" :disabled="!vts.canOperate" @click="dropPrank(p)">
                  掉落
                </NButton>
                <NButton size="small" type="error" @click="vts.removePrank(p.id)">
                  删除
                </NButton>
              </NFlex>
            </NFlex>
          </NFlex>
        </NTabPane>
      </NTabs>
    </NFlex>
  </NCard>
</template>
