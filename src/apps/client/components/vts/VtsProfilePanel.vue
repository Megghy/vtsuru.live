<script setup lang="ts">
import { saveAs } from 'file-saver'
import { Download, Link2, Plus, Upload } from 'lucide-vue-next'

import { useVtsStore } from '@/apps/client/store/useVtsStore'
import type { VtsProfile } from '@/apps/client/store/useVtsStore'
import { useFilePicker } from '@/composables/useFilePicker'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Switch } from '@/shared/ui/switch'

import { useVtsAction } from './useVtsAction'

const vts = useVtsStore()
const { run } = useVtsAction()

function addProfile() {
  const defaultName = vts.currentModelName ? `${vts.currentModelName} 方案` : '新配置方案'
  run(
    () =>
      vts.createProfile(
        defaultName,
        vts.currentModelId
          ? { modelId: vts.currentModelId, modelName: vts.currentModelName ?? undefined, autoApplyOnModelLoad: false }
          : undefined,
      ),
    '已创建配置方案',
  )
}

function applyProfile(id: string) {
  run(() => vts.applyProfile(id), '已应用配置方案')
}

function captureToProfile(id: string) {
  run(() => vts.captureCurrentToProfile(id), '已用当前配置覆盖')
}

function updateProfile(p: VtsProfile) {
  void run(() => vts.updateProfile(p))
}

function bindCurrentModel(p: VtsProfile) {
  if (!vts.currentModelId) return
  run(
    () =>
      vts.updateProfile({
        ...p,
        modelId: vts.currentModelId ?? undefined,
        modelName: vts.currentModelName ?? undefined,
      }),
    `已绑定模型：${vts.currentModelName || vts.currentModelId}`,
  )
}

function unbindModel(p: VtsProfile) {
  run(
    () =>
      vts.updateProfile({
        ...p,
        modelId: undefined,
        modelName: undefined,
        autoApplyOnModelLoad: false,
      }),
    '已解除模型绑定',
  )
}

function sanitizeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60) || 'profile'
}

function exportProfile(p: VtsProfile) {
  run(() => {
    const json = JSON.stringify(vts.exportProfile(p.id), null, 2)
    saveAs(new Blob([json], { type: 'application/json;charset=utf-8' }), `vts_profile_${sanitizeFileName(p.name)}.json`)
  }, '已导出配置文件')
}

const { open: openProfileImport } = useFilePicker({
  accept: 'application/json',
  onSelect: ([file]) => {
    run(async () => {
      const text = await file.text()
      await vts.importProfile(JSON.parse(text))
    }, '已导入配置方案')
  },
})
</script>

<template>
  <Card>
    <CardHeader class="p-3 border-b flex flex-row items-center justify-between gap-2 flex-wrap">
      <div class="flex items-center gap-2">
        <CardTitle>配置方案 (Profile)</CardTitle>
        <Badge
          v-if="vts.profiles.length > 0"
          variant="secondary"
          size="xs"
          class="tabular-nums"
        >
          {{ vts.profiles.length }}
        </Badge>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <Button
          size="xs"
          variant="outline"
          class="gap-1"
          @click="openProfileImport()"
        >
          <Upload class="size-3" />
          导入
        </Button>
        <Button
          size="xs"
          class="gap-1"
          @click="addProfile"
        >
          <Plus class="size-3" />
          从当前创建
        </Button>
      </div>
    </CardHeader>

    <CardContent class="p-3 space-y-3">
      <p class="text-[11px] text-muted-foreground">
        完整保存操作台、热键外观、机位预设、组合宏、参数槽与道具配置（不含连接凭据）；可绑定指定模型并在换皮时自动切换。
      </p>

      <div
        v-if="vts.profiles.length === 0"
        class="py-4"
      >
        <Empty description="暂无配置方案，换皮前可先将当前模型配置存为方案" />
      </div>

      <div
        v-else
        class="space-y-2"
      >
        <div
          v-for="p in vts.profiles"
          :key="p.id"
          class="p-2.5 rounded-md border border-border bg-muted/20 space-y-2"
        >
          <div class="flex-between gap-3 flex-wrap">
            <div class="flex items-center gap-2 flex-wrap min-w-0">
              <Badge
                v-if="vts.currentProfileId === p.id"
                variant="success"
                size="xs"
              >
                当前
              </Badge>
              <Input
                v-model="p.name"
                placeholder="方案名称"
                class="w-44"
                @blur="updateProfile({ ...p })"
              />
              <span class="text-[11px] text-muted-foreground tabular-nums">
                操作台 {{ p.data.deck?.length ?? 0 }} · 预设 {{ p.data.presets.length }} · 宏
                {{ p.data.macros.length }} · 参数 {{ p.data.paramSlots.length }}
              </span>
            </div>

            <div class="flex items-center gap-1.5 flex-wrap">
              <Button
                size="xs"
                @click="applyProfile(p.id)"
              >
                应用
              </Button>
              <Button
                size="xs"
                variant="outline"
                class="gap-1"
                @click="exportProfile(p)"
              >
                <Download class="size-3" />
                导出
              </Button>
              <Popconfirm
                title="用当前配置覆盖此方案？"
                @confirm="captureToProfile(p.id)"
              >
                <Button
                  size="xs"
                  variant="outline"
                >
                  覆盖保存
                </Button>
              </Popconfirm>
              <Popconfirm
                title="确认删除此配置方案？"
                @confirm="vts.deleteProfile(p.id)"
              >
                <Button
                  size="xs"
                  variant="outline"
                  class="border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  删除
                </Button>
              </Popconfirm>
            </div>
          </div>

          <!-- 模型绑定与自动切换 -->
          <div class="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-border/60 text-xs">
            <div class="flex items-center gap-2 flex-wrap">
              <Link2 class="size-3.5 text-muted-foreground" />
              <span class="text-muted-foreground">
                绑定模型：{{ p.modelName || (p.modelId ? p.modelId.slice(0, 12) : '未绑定') }}
              </span>
              <Button
                v-if="vts.currentModelId"
                size="xs"
                variant="ghost"
                @click="bindCurrentModel(p)"
              >
                {{ p.modelId === vts.currentModelId ? '重新绑定当前模型' : '绑定当前模型' }}
              </Button>
              <Button
                v-if="p.modelId"
                size="xs"
                variant="ghost"
                class="text-muted-foreground"
                @click="unbindModel(p)"
              >
                解绑
              </Button>
            </div>

            <label
              v-if="p.modelId"
              class="flex items-center gap-1.5 cursor-pointer select-none"
            >
              <Switch
                :checked="Boolean(p.autoApplyOnModelLoad)"
                @update:checked="(val) => updateProfile({ ...p, autoApplyOnModelLoad: val })"
              />
              <span class="text-[11px] text-muted-foreground">切到此模型时自动应用</span>
            </label>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
