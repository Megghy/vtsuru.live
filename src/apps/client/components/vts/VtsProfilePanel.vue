<script setup lang="ts">
import { saveAs } from 'file-saver'
import { NButton, NCard, NFlex, NInput, NPopconfirm, NTag, NText, useMessage } from 'naive-ui';
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import type { VtsProfile } from '@/apps/client/store/useVtsStore'

const vts = useVtsStore()
const message = useMessage()

async function addProfile() {
  const p = await vts.createProfile()
  message.success(`已创建 Profile: ${p.name}`)
}

async function applyProfile(id: string) {
  try {
    await vts.applyProfile(id)
    message.success('已应用 Profile')
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
}

async function captureToProfile(id: string) {
  try {
    await vts.captureCurrentToProfile(id)
    message.success('已覆盖保存到该 Profile')
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
}

async function renameProfile(p: VtsProfile) {
  await vts.updateProfile(p)
}

function sanitizeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60) || 'profile'
}

async function exportProfile(p: VtsProfile) {
  try {
    const json = JSON.stringify(vts.exportProfile(p.id), null, 2)
    saveAs(new Blob([json], { type: 'application/json;charset=utf-8' }), `vtsuru_vts_profile_${sanitizeFileName(p.name)}.json`)
    try {
      await navigator.clipboard.writeText(json)
      message.success('已导出 Profile，并复制到剪贴板')
    } catch {
      message.success('已导出 Profile（剪贴板复制失败）')
    }
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
}

async function onImportFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  try {
    const text = await file.text()
    const parsed = JSON.parse(text) as unknown
    const created = await vts.importProfile(parsed)
    message.success(`已导入 Profile: ${created.name}`)
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
}
</script>

<template>
  <NCard size="small" title="Profile / 场景包">
    <NFlex vertical :size="10">
      <NFlex align="center" :wrap="true" :size="8">
        <NButton size="small" @click="addProfile">
          从当前配置创建 Profile
        </NButton>
        <NButton size="small" tag="label">
          导入 Profile（json）
          <input
            type="file"
            accept="application/json"
            style="display: none"
            @change="onImportFileChange"
          >
        </NButton>
        <NText depth="3">
          Profile 仅保存 VTS 控制配置（不含 wsUrl/token）。
        </NText>
      </NFlex>

      <NFlex v-for="p in vts.profiles" :key="p.id" align="center" justify="space-between" :wrap="true" :size="10">
        <NFlex align="center" :wrap="true" :size="10">
          <NTag v-if="vts.currentProfileId === p.id" type="success">
            当前
          </NTag>
          <NInput
            v-model:value="p.name"
            placeholder="Profile 名称"
            style="width: 220px"
            @blur="renameProfile({ ...p })"
          />
          <NText depth="3">
            presets={{ p.data.presets.length }}, macros={{ p.data.macros.length }}, slots={{ p.data.paramSlots.length }}
          </NText>
        </NFlex>
        <NFlex :wrap="true" :size="8">
          <NButton size="small" type="primary" @click="applyProfile(p.id)">
            应用
          </NButton>
          <NButton size="small" @click="exportProfile(p)">
            导出
          </NButton>
          <NPopconfirm @positive-click="captureToProfile(p.id)">
            <template #trigger>
              <NButton size="small">
                用当前覆盖保存
              </NButton>
            </template>
            确认用“当前配置”覆盖该 Profile？
          </NPopconfirm>
          <NPopconfirm @positive-click="vts.deleteProfile(p.id)">
            <template #trigger>
              <NButton size="small" type="error">
                删除
              </NButton>
            </template>
            确认删除该 Profile？
          </NPopconfirm>
        </NFlex>
      </NFlex>
    </NFlex>
  </NCard>
</template>
