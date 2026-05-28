<script setup lang="ts">
import { saveAs } from 'file-saver'
import { NButton, NCard, NFlex, NInput, NPopconfirm, NTag, NText } from 'naive-ui'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import type { VtsProfile } from '@/apps/client/store/useVtsStore'
import { useVtsAction } from './useVtsAction'

const vts = useVtsStore()
const { run } = useVtsAction()

function addProfile() {
  run(() => vts.createProfile(), '已创建')
}

function applyProfile(id: string) {
  run(() => vts.applyProfile(id), '已应用')
}

function captureToProfile(id: string) {
  run(() => vts.captureCurrentToProfile(id), '已保存到 Profile')
}

async function renameProfile(p: VtsProfile) {
  await vts.updateProfile(p)
}

function sanitizeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60) || 'profile'
}

function exportProfile(p: VtsProfile) {
  run(async () => {
    const json = JSON.stringify(vts.exportProfile(p.id), null, 2)
    saveAs(new Blob([json], { type: 'application/json;charset=utf-8' }), `vts_profile_${sanitizeFileName(p.name)}.json`)
    try { await navigator.clipboard.writeText(json) } catch {}
  }, '已导出')
}

async function onImportFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  run(async () => {
    const text = await file.text()
    await vts.importProfile(JSON.parse(text))
  }, '已导入')
}
</script>

<template>
  <NCard size="small" title="配置包 (Profile)">
    <NFlex vertical :size="10">
      <NFlex align="center" :wrap="true" :size="8">
        <NButton size="small" @click="addProfile">从当前创建</NButton>
        <NButton size="small" tag="label">
          导入
          <input type="file" accept="application/json" style="display: none" @change="onImportFileChange">
        </NButton>
        <NText depth="3">保存/恢复 VTS 控制配置 (不含连接信息)</NText>
      </NFlex>

      <NFlex v-for="p in vts.profiles" :key="p.id" align="center" justify="space-between" :wrap="true" :size="10">
        <NFlex align="center" :wrap="true" :size="10">
          <NTag v-if="vts.currentProfileId === p.id" type="success" size="small">当前</NTag>
          <NInput v-model:value="p.name" placeholder="名称" style="width: 200px" @blur="renameProfile({ ...p })" />
          <NText depth="3">
            预设={{ p.data.presets.length }} 宏={{ p.data.macros.length }} 参数={{ p.data.paramSlots.length }}
          </NText>
        </NFlex>
        <NFlex :wrap="true" :size="8">
          <NButton size="small" type="primary" @click="applyProfile(p.id)">应用</NButton>
          <NButton size="small" @click="exportProfile(p)">导出</NButton>
          <NPopconfirm @positive-click="captureToProfile(p.id)">
            <template #trigger>
              <NButton size="small">覆盖保存</NButton>
            </template>
            用当前配置覆盖此 Profile?
          </NPopconfirm>
          <NPopconfirm @positive-click="vts.deleteProfile(p.id)">
            <template #trigger>
              <NButton size="small" type="error">删除</NButton>
            </template>
            确认删除?
          </NPopconfirm>
        </NFlex>
      </NFlex>
    </NFlex>
  </NCard>
</template>
