<script setup lang="ts">
import { computed, ref } from 'vue'

import { useVtsStore } from '@/apps/client/store/useVtsStore'
import type { VtsAccessoryBinding, VtsPrankBinding } from '@/apps/client/store/useVtsStore'

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
  <UCard
    size="small"
    bordered
    title="道具管理"
  >
    <div
      vertical
      :size="12"
    >
      <div
        align="center"
        :wrap="true"
        :size="8"
      >
        <UButton
          size="small"
          :loading="refreshing"
          :disabled="!vts.canOperate || refreshing"
          @click="refresh"
        >
          刷新列表
        </UButton>
        <span depth="3">
          {{ vts.canLoadItems == null ? '状态未知' : vts.canLoadItems ? '可操作' : '当前不可操作 (VTS 有弹窗)' }}
        </span>
      </div>

      <div
        type="line"
        animated
      >
        <section
          name="accessories"
          tab="配饰"
        >
          <div
            vertical
            :size="8"
          >
            <div
              align="center"
              :wrap="true"
              :size="8"
            >
              <UButton
                size="small"
                @click="addAccessory"
              >
                添加配饰
              </UButton>
              <span depth="3"> 绑定场景中的道具实例，通过透明度切换显隐 </span>
            </div>
            <USeparator style="margin: 4px 0" />
            <div
              v-for="acc in vts.accessories"
              :key="acc.id"
              align="center"
              justify="space-between"
              :wrap="true"
              :size="12"
            >
              <div
                align="center"
                :wrap="true"
                :size="12"
              >
                <UInput
                  v-model="acc.name"
                  placeholder="名称"
                  style="width: 140px"
                  @blur="saveAccessory({ ...acc })"
                />
                <USelectMenu
                  style="width: 380px"
                  :items="instanceOptions"
                  :value="acc.itemInstanceID"
                  placeholder="选择场景中的道具实例"
                  @update:value="(val) => saveAccessory({ ...acc, itemInstanceID: val as string })"
                  value-key="value"
                />
                <USwitch
                  :model-value="acc.visible"
                  :disabled="!vts.canOperate"
                  @update:model-value="(val) => toggleAccessory(acc, val)"
                >
                  <template v-if="false"> 显示 </template>
                  <template v-if="false"> 隐藏 </template>
                </USwitch>
              </div>
              <UButton
                size="small"
                color="error"
                @click="vts.removeAccessory(acc.id)"
              >
                删除
              </UButton>
            </div>
          </div>
        </section>

        <section
          name="pranks"
          tab="整活"
        >
          <div
            vertical
            :size="8"
          >
            <div
              align="center"
              :wrap="true"
              :size="8"
            >
              <UButton
                size="small"
                @click="addPrank"
              >
                添加整活
              </UButton>
              <span depth="3"> 通过文件掉落或触发热键来丢道具 </span>
            </div>
            <USeparator style="margin: 4px 0" />
            <div
              v-for="p in vts.pranks"
              :key="p.id"
              align="center"
              justify="space-between"
              :wrap="true"
              :size="12"
            >
              <div
                align="center"
                :wrap="true"
                :size="12"
              >
                <UInput
                  v-model="p.name"
                  placeholder="名称"
                  style="width: 140px"
                  @blur="savePrank({ ...p })"
                />
                <USelectMenu
                  style="width: 360px"
                  :items="fileOptions"
                  :value="p.fileName"
                  placeholder="选择道具文件"
                  @update:value="(val) => savePrank({ ...p, fileName: val as string })"
                  value-key="value"
                />
                <USelectMenu
                  style="width: 360px"
                  :items="hotkeyOptions"
                  :value="p.hotkeyID"
                  placeholder="或绑定热键 (可选)"
                  clearable
                  @update:value="
                    (val) => savePrank({ ...p, hotkeyID: typeof val === 'string' && val ? val : undefined })
                  "
                  value-key="value"
                />
              </div>
              <div
                :wrap="true"
                :size="8"
              >
                <UButton
                  size="small"
                  :disabled="!vts.canOperate || !p.fileName"
                  @click="loadPrank(p)"
                >
                  加载
                </UButton>
                <UButton
                  size="small"
                  :disabled="!vts.canOperate || !p.fileName"
                  @click="unloadPrank(p)"
                >
                  卸载
                </UButton>
                <UButton
                  size="small"
                  color="primary"
                  :disabled="!vts.canOperate"
                  @click="dropPrank(p)"
                >
                  掉落
                </UButton>
                <UButton
                  size="small"
                  color="error"
                  @click="vts.removePrank(p.id)"
                >
                  删除
                </UButton>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </UCard>
</template>
