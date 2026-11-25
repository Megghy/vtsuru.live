<script setup lang="ts">
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { Flame, FolderOpen, Loader2, Play, Scissors, Square, Trash2 } from 'lucide-vue-next'
import { ref } from 'vue'
import { toast } from 'vue-sonner'

import { useStreamClipRecorder } from '@/apps/client/store/useStreamClipRecorder'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'

const recorder = useStreamClipRecorder()

const clipLabel = ref('')
const clipDuration = ref(String(recorder.config.defaultClipSeconds))

function formatSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}

async function handleToggleBuffer() {
  try {
    if (recorder.isBuffering) {
      await recorder.stopBuffer()
      toast.info('已停止直播流回溯缓冲')
    } else {
      await recorder.startBuffer()
    }
  } catch (err) {
    toast.error('操作失败', { description: err instanceof Error ? err.message : String(err) })
  }
}

async function handleSaveClip() {
  try {
    await recorder.saveClip(clipLabel.value.trim() || '高光切片', Number(clipDuration.value))
    clipLabel.value = ''
  } catch (err) {
    toast.error('保存切片失败', { description: err instanceof Error ? err.message : String(err) })
  }
}

async function pickOutputDir() {
  const selected = await openDialog({ directory: true, multiple: false, title: '选择切片保存目录' })
  if (typeof selected === 'string' && selected) {
    recorder.updateConfig({ outputDir: selected })
    toast.success('已更新保存目录')
  }
}
</script>

<template>
  <div class="space-y-4">
    <Card>
      <CardHeader>
        <div class="flex-between flex-wrap gap-2">
          <div>
            <CardTitle class="text-sm flex items-center gap-1.5">
              <Scissors class="size-4 text-primary" />
              本地直播流高光切片（回溯缓冲）
            </CardTitle>
            <CardDescription>
              复用直播拉流通道在本地维护环形无损缓冲，出现名场面时一键将最近几分钟直接合成为 MP4。
            </CardDescription>
          </div>
          <div class="flex items-center gap-2">
            <Badge :variant="recorder.isBuffering ? 'default' : 'outline'">
              {{ recorder.isBuffering ? `缓冲中 · 约 ${recorder.bufferedSecondsEstimate}s` : '未启动' }}
            </Badge>
            <Button
              :variant="recorder.isBuffering ? 'destructive' : 'default'"
              :disabled="recorder.isStarting"
              @click="handleToggleBuffer"
            >
              <Loader2
                v-if="recorder.isStarting"
                class="size-3.5 mr-1 animate-spin"
              />
              <Square
                v-else-if="recorder.isBuffering"
                class="size-3.5 mr-1"
              />
              <Play
                v-else
                class="size-3.5 mr-1"
              />
              {{ recorder.isBuffering ? '停止缓冲' : '开启回溯缓冲' }}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent class="space-y-4">
        <div
          v-if="recorder.lastError"
          class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {{ recorder.lastError }}
        </div>

        <div class="grid grid-cols-1 md:grid-cols-[1fr_140px_auto] gap-2 items-end">
          <FormField label="切片标签（可选）">
            <Input
              v-model="clipLabel"
              placeholder="例如 精彩五杀 / 翻唱名场面"
              @keyup.enter="handleSaveClip"
            />
          </FormField>
          <FormField label="回溯时长">
            <Select v-model="clipDuration">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="60">最近 1 分钟</SelectItem>
                <SelectItem value="120">最近 2 分钟</SelectItem>
                <SelectItem value="180">最近 3 分钟</SelectItem>
                <SelectItem value="300">最近 5 分钟</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <Button
            :disabled="!recorder.isBuffering || recorder.isSavingClip"
            @click="handleSaveClip"
          >
            <Loader2
              v-if="recorder.isSavingClip"
              class="size-3.5 mr-1 animate-spin"
            />
            <Scissors
              v-else
              class="size-3.5 mr-1"
            />
            保存高光切片
          </Button>
        </div>

        <div class="space-y-2 border-t border-border pt-3">
          <SettingRow
            title="最大环形缓冲时长"
            description="仅保留最近 N 分钟的分片，自动循环覆盖以控制磁盘占用"
          >
            <Select
              :model-value="String(recorder.config.bufferSeconds)"
              :disabled="recorder.isBuffering"
              @update:model-value="recorder.updateConfig({ bufferSeconds: Number($event) })"
            >
              <SelectTrigger class="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="180">3 分钟</SelectItem>
                <SelectItem value="300">5 分钟</SelectItem>
                <SelectItem value="600">10 分钟</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow
            title="切片保存目录"
            :description="recorder.config.outputDir || '默认保存至系统视频目录 / VTsuruClips'"
          >
            <div class="flex items-center gap-1.5">
              <Button
                variant="outline"
                @click="pickOutputDir"
              >
                选择目录
              </Button>
              <Button
                variant="ghost"
                @click="recorder.openOutputFolder()"
              >
                <FolderOpen class="size-3.5 mr-1" />
                打开
              </Button>
            </div>
          </SettingRow>

          <SettingRow
            title="弹幕突增自动切片"
            description="中控台在线时，若短时间内弹幕数超过阈值则自动延迟 15 秒保存高光切片"
          >
            <Switch
              :checked="recorder.config.autoTriggerOnBurst"
              @update:checked="recorder.updateConfig({ autoTriggerOnBurst: $event })"
            />
          </SettingRow>

          <div
            v-if="recorder.config.autoTriggerOnBurst"
            class="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-2"
          >
            <FormField label="触发阈值（15 秒内弹幕条数）">
              <Input
                type="number"
                min="5"
                max="300"
                :model-value="recorder.config.burstThreshold"
                @update:model-value="recorder.updateConfig({ burstThreshold: Number($event) || 25 })"
              />
            </FormField>
            <FormField label="自动切片冷却（秒）">
              <Input
                type="number"
                min="30"
                max="600"
                :model-value="recorder.config.burstCooldownSeconds"
                @update:model-value="recorder.updateConfig({ burstCooldownSeconds: Number($event) || 90 })"
              />
            </FormField>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm flex items-center gap-1.5">
          <Flame class="size-4 text-primary" />
          已保存切片 ({{ recorder.recentClips.length }})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          v-if="recorder.recentClips.length > 0"
          class="space-y-1.5"
        >
          <div
            v-for="clip in recorder.recentClips"
            :key="clip.id"
            class="flex-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2"
          >
            <div class="min-w-0">
              <div class="text-xs font-medium truncate">{{ clip.label }}</div>
              <div class="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                <span>{{ formatTime(clip.createdAt) }}</span>
                <span>约 {{ clip.durationSeconds }}s</span>
                <span v-if="clip.sizeBytes">{{ formatSize(clip.sizeBytes) }}</span>
              </div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <Button
                variant="outline"
                size="xs"
                @click="recorder.revealClip(clip.filePath)"
              >
                <FolderOpen class="size-3.5 mr-1" />
                定位文件
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                class="text-muted-foreground hover:text-destructive"
                @click="recorder.removeClipRecord(clip.id)"
              >
                <Trash2 class="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
        <Empty
          v-else
          description="尚未导出本地切片；开启缓冲后点击「保存高光切片」或在中控台打点（Alt+M）即可保存"
        />
      </CardContent>
    </Card>
  </div>
</template>
