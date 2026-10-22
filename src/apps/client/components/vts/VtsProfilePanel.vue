<script setup lang="ts">
import { saveAs } from 'file-saver'

import { useVtsStore } from '@/apps/client/store/useVtsStore'
import type { VtsProfile } from '@/apps/client/store/useVtsStore'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Tag } from '@/shared/ui/tag'

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
  <Card>
    <CardHeader class="py-3 px-4">
      <CardTitle class="text-sm font-semibold">配置包 (Profile)</CardTitle>
    </CardHeader>
    <CardContent class="px-4 pb-4 pt-0 flex flex-col gap-3">
      <div class="flex items-center gap-2 flex-wrap text-xs">
        <Button variant="outline" @click="addProfile">
          从当前创建
        </Button>
        <label class="cursor-pointer">
          <Button variant="outline" as-child>
            <span>导入</span>
          </Button>
          <input
            type="file"
            accept="application/json"
            style="display: none"
            @change="onImportFileChange"
          />
        </label>
        <span class="text-[var(--muted-foreground)]">保存/恢复 VTS 控制配置 (不含连接信息)</span>
      </div>

      <div class="flex flex-col gap-2">
        <div
          v-for="p in vts.profiles"
          :key="p.id"
          class="flex items-center justify-between gap-3 flex-wrap py-1.5 border-b border-[var(--border)] last:border-0"
        >
          <div class="flex items-center gap-2 flex-wrap">
            <Tag
              v-if="vts.currentProfileId === p.id"
              variant="default"
            >
              当前
            </Tag>
            <Input v-model="p.name" placeholder="名称" class="w-48" @blur="renameProfile({ ...p })" />
            <span class="text-xs text-[var(--muted-foreground)]">
              预设={{ p.data.presets.length }} 宏={{ p.data.macros.length }} 参数={{ p.data.paramSlots.length }}
            </span>
          </div>

          <div class="flex items-center gap-1.5 flex-wrap">
            <Button @click="applyProfile(p.id)">
              应用
            </Button>
            <Button variant="outline" @click="exportProfile(p)">
              导出
            </Button>
            <Popconfirm
              title="用当前配置覆盖此 Profile?"
              @confirm="captureToProfile(p.id)"
            >
              <Button variant="outline">
                覆盖保存
              </Button>
            </Popconfirm>
            <Popconfirm
              title="确认删除此 Profile?"
              @confirm="vts.deleteProfile(p.id)"
            >
              <Button variant="destructive">
                删除
              </Button>
            </Popconfirm>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
