<script setup lang="ts">
import { saveAs } from 'file-saver'

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
    try {
      await navigator.clipboard.writeText(json)
    } catch (err) {
      console.warn('写入剪贴板失败', err)
    }
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
  <UCard
    size="small"
    bordered
    title="配置包 (Profile)"
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
          @click="addProfile"
        >
          从当前创建
        </UButton>
        <UButton
          size="small"
          tag="label"
        >
          导入
          <input
            type="file"
            accept="application/json"
            style="display: none"
            @change="onImportFileChange"
          />
        </UButton>
        <span depth="3"> 保存/恢复 VTS 控制配置 (不含连接信息) </span>
      </div>

      <div
        v-for="p in vts.profiles"
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
          <UBadge
            v-if="vts.currentProfileId === p.id"
            type="success"
            size="small"
          >
            当前
          </UBadge>
          <UInput
            v-model="p.name"
            placeholder="名称"
            style="width: 200px"
            @blur="renameProfile({ ...p })"
          />
          <span depth="3">
            预设={{ p.data.presets.length }} 宏={{ p.data.macros.length }} 参数={{ p.data.paramSlots.length }}
          </span>
        </div>
        <div
          :wrap="true"
          :size="8"
        >
          <UButton
            size="small"
            color="primary"
            @click="applyProfile(p.id)"
          >
            应用
          </UButton>
          <UButton
            size="small"
            @click="exportProfile(p)"
          >
            导出
          </UButton>
          <UPopover>
            <UButton size="sm"> 覆盖保存 </UButton>
            <template #content="{ close }">
              <div class="space-y-3 p-3">
                <div>用当前配置覆盖此 Profile?</div>
                <div class="flex justify-end gap-2">
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    @click="close"
                    >取消</UButton
                  >
                  <UButton
                    size="xs"
                    color="primary"
                    @click="(close(), captureToProfile(p.id))"
                    >确认</UButton
                  >
                </div>
              </div>
            </template>
          </UPopover>
          <UPopover>
            <UButton
              size="sm"
              color="error"
            >
              删除
            </UButton>
            <template #content="{ close }">
              <div class="space-y-3 p-3">
                <div>确认删除?</div>
                <div class="flex justify-end gap-2">
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    @click="close"
                    >取消</UButton
                  >
                  <UButton
                    size="xs"
                    color="error"
                    @click="(close(), vts.deleteProfile(p.id))"
                    >确认</UButton
                  >
                </div>
              </div>
            </template>
          </UPopover>
        </div>
      </div>
    </div>
  </UCard>
</template>
