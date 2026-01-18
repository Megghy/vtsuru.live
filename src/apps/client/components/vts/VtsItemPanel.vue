<script setup lang="ts">
import { NButton, NCard, NDivider, NFlex, NInput, NSelect, NSwitch, NTabPane, NTabs, NText, useMessage } from 'naive-ui'
import { computed } from 'vue'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import type { VtsAccessoryBinding, VtsPrankBinding } from '@/apps/client/store/useVtsStore'

const vts = useVtsStore()
const message = useMessage()

const instanceOptions = computed(() => {
  return vts.itemInstancesInScene.map((i) => ({
    label: `${i.fileName} (${i.instanceID.slice(0, 8)})${i.pinnedToModel ? ' [pinned]' : ''}`,
    value: i.instanceID,
  }))
})

const fileOptions = computed(() => {
  return vts.availableItemFiles.map((f) => ({
    label: `${f.fileName} (loaded=${f.loadedCount})`,
    value: f.fileName,
  }))
})

const hotkeyOptions = computed(() => {
  return vts.hotkeys.map((h) => ({
    label: `${h.name} (${h.hotkeyID.slice(0, 8)})`,
    value: h.hotkeyID,
  }))
})

async function refresh() {
  try {
    await vts.refreshItems({ includeFiles: true })
    message.success('已刷新道具列表')
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
}

async function addAccessory() {
  await vts.createAccessory()
  message.success('已新增配饰')
}

async function saveAccessory(next: VtsAccessoryBinding) {
  await vts.upsertAccessory(next)
  if (next.itemInstanceID) {
    try {
      await vts.setItemOpacity(next.itemInstanceID, next.visible ? 1 : 0)
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err))
    }
  }
}

async function toggleAccessory(acc: VtsAccessoryBinding, visible: boolean) {
  try {
    await vts.toggleAccessory(acc.id, visible)
    message.success(visible ? '已显示' : '已隐藏')
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
}

async function addPrank() {
  await vts.createPrank()
  message.success('已新增整活')
}

async function savePrank(next: VtsPrankBinding) {
  await vts.upsertPrank(next)
}

async function loadPrank(p: VtsPrankBinding) {
  try {
    if (!p.fileName) throw new Error('未选择 fileName')
    await vts.loadItem(p.fileName, { x: 0, y: 0.5, size: 0.32, fadeTime: 0.15 })
    message.success('已加载')
    await vts.refreshItems({ includeFiles: true })
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
}

async function unloadPrank(p: VtsPrankBinding) {
  try {
    if (!p.fileName) throw new Error('未选择 fileName')
    await vts.unloadItems({ fileNames: [p.fileName] })
    message.success('已卸载')
    await vts.refreshItems({ includeFiles: true })
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
}

async function dropPrank(p: VtsPrankBinding) {
  try {
    if (p.hotkeyID) {
      await vts.triggerHotkey(p.hotkeyID)
      message.success('已触发整活热键')
      return
    }
    if (!p.fileName) throw new Error('未选择 fileName 或 hotkey')
    await vts.dropItem(p.fileName, { x: 0, size: 0.32 })
    message.success('已掉落')
    await vts.refreshItems({ includeFiles: true })
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
}
</script>

<template>
  <NCard size="small" title="道具与挂件（Items）">
    <NFlex vertical :size="10">
      <NFlex align="center" :wrap="true" :size="8">
        <NButton size="small" :disabled="!vts.canOperate" @click="refresh">
          刷新列表
        </NButton>
        <NText depth="3">
          {{ vts.canLoadItems == null ? '未获取状态' : (vts.canLoadItems ? '可操作道具' : '当前不可加载/卸载（可能有菜单/弹窗打开）') }}
        </NText>
      </NFlex>

      <NTabs type="line" animated>
        <NTabPane name="accessories" tab="配饰（实例绑定）">
          <NFlex vertical :size="8">
            <NFlex align="center" :wrap="true" :size="8">
              <NButton size="small" @click="addAccessory">
                新增配饰
              </NButton>
              <NText depth="3">
                绑定“场景中已有 itemInstanceID”，通过 opacity=0/1 实现戴/脱。
              </NText>
            </NFlex>

            <NDivider style="margin: 4px 0" />

            <NFlex v-for="acc in vts.accessories" :key="acc.id" align="center" justify="space-between" :wrap="true" :size="10">
              <NFlex align="center" :wrap="true" :size="10">
                <NInput
                  v-model:value="acc.name"
                  placeholder="配饰名称"
                  style="width: 160px"
                  @blur="saveAccessory({ ...acc })"
                />
                <NSelect
                  style="width: 420px"
                  :options="instanceOptions"
                  :value="acc.itemInstanceID"
                  placeholder="选择场景中的 itemInstanceID"
                  @update:value="(val) => saveAccessory({ ...acc, itemInstanceID: val as string })"
                />
                <NSwitch
                  :value="acc.visible"
                  :disabled="!vts.canOperate"
                  @update:value="(val) => toggleAccessory(acc, val)"
                >
                  <template #checked>
                    显示
                  </template>
                  <template #unchecked>
                    隐藏
                  </template>
                </NSwitch>
              </NFlex>
              <NFlex :wrap="true" :size="8">
                <NButton size="small" type="error" @click="vts.removeAccessory(acc.id)">
                  删除
                </NButton>
              </NFlex>
            </NFlex>
          </NFlex>
        </NTabPane>

        <NTabPane name="pranks" tab="整活（文件名/Hotkey）">
          <NFlex vertical :size="8">
            <NFlex align="center" :wrap="true" :size="8">
              <NButton size="small" @click="addPrank">
                新增整活
              </NButton>
              <NText depth="3">
                整活支持两种模式：A) fileName 动态 load/unload + 掉落（move 模拟）；B) 直接触发 VTS 已配置的 hotkey（更贴近原生物理/逻辑）。
              </NText>
            </NFlex>

            <NDivider style="margin: 4px 0" />

            <NFlex v-for="p in vts.pranks" :key="p.id" align="center" justify="space-between" :wrap="true" :size="10">
              <NFlex align="center" :wrap="true" :size="10">
                <NInput
                  v-model:value="p.name"
                  placeholder="整活名称"
                  style="width: 160px"
                  @blur="savePrank({ ...p })"
                />
                <NSelect
                  style="width: 420px"
                  :options="fileOptions"
                  :value="p.fileName"
                  placeholder="选择 Items 文件"
                  @update:value="(val) => savePrank({ ...p, fileName: val as string })"
                />
                <NSelect
                  style="width: 420px"
                  :options="hotkeyOptions"
                  :value="p.hotkeyID"
                  placeholder="或选择 Hotkey（可选）"
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
