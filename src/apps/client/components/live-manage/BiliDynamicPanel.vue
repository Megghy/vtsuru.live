<script setup lang="ts">
import { ImagePlus, Loader2, Pin, PinOff, RefreshCw, Send, Trash2, X } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'

import {
  deleteBiliDynamic,
  fetchMyRecentDynamics,
  type MyBiliDynamicItem,
  publishBiliDynamicWithBlobs,
  removeTopBiliDynamic,
  setTopBiliDynamic,
} from '@/apps/client/api/bili-dynamic'
import { useBiliDynamicAutomation } from '@/apps/client/store/useBiliDynamicAutomation'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { SettingRow } from '@/shared/ui/setting-row'
import { Spin } from '@/shared/ui/spin'
import { Textarea } from '@/shared/ui/textarea'

const automation = useBiliDynamicAutomation()

const contentText = ref('')
const pinAfterPublish = ref(false)
const selectedFiles = ref<Array<{ file: File; previewUrl: string }>>([])
const publishing = ref(false)
const uploadProgress = ref('')

const loadingList = ref(false)
const recentDynamics = ref<MyBiliDynamicItem[]>([])

function onFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  const remaining = Math.max(0, 9 - selectedFiles.value.length)
  for (const file of files.slice(0, remaining)) {
    selectedFiles.value.push({
      file,
      previewUrl: URL.createObjectURL(file),
    })
  }
  input.value = ''
}

function removeSelectedFile(idx: number) {
  const removed = selectedFiles.value.splice(idx, 1)[0]
  if (removed) URL.revokeObjectURL(removed.previewUrl)
}

async function handlePublish() {
  if (!contentText.value.trim() && selectedFiles.value.length === 0) {
    toast.error('请输入动态文案或选择图片')
    return
  }
  publishing.value = true
  uploadProgress.value = ''
  try {
    const dynId = await publishBiliDynamicWithBlobs(
      contentText.value,
      selectedFiles.value.map((f) => ({ blob: f.file, filename: f.file.name })),
      (done, total) => {
        uploadProgress.value = `正在上传图片 (${done}/${total})...`
      },
    )
    if (pinAfterPublish.value) {
      await setTopBiliDynamic(dynId).catch(() => {})
    }
    toast.success('B 站动态发布成功', { description: `动态 ID: ${dynId}` })
    contentText.value = ''
    for (const f of selectedFiles.value) URL.revokeObjectURL(f.previewUrl)
    selectedFiles.value = []
    await refreshDynamics()
  } catch (err) {
    toast.error('发布动态失败', { description: err instanceof Error ? err.message : String(err) })
  } finally {
    publishing.value = false
    uploadProgress.value = ''
  }
}

async function refreshDynamics() {
  loadingList.value = true
  try {
    recentDynamics.value = await fetchMyRecentDynamics()
  } catch (err) {
    toast.error('拉取近期动态失败', { description: err instanceof Error ? err.message : String(err) })
  } finally {
    loadingList.value = false
  }
}

async function handleToggleTop(item: MyBiliDynamicItem) {
  try {
    if (item.isTop) {
      await removeTopBiliDynamic(item.idStr)
      item.isTop = false
      toast.success('已取消置顶')
    } else {
      await setTopBiliDynamic(item.idStr)
      recentDynamics.value.forEach((d) => (d.isTop = d.idStr === item.idStr))
      toast.success('已置顶该动态')
    }
  } catch (err) {
    toast.error('置顶操作失败', { description: err instanceof Error ? err.message : String(err) })
  }
}

async function handleDelete(item: MyBiliDynamicItem) {
  try {
    await deleteBiliDynamic(item.idStr)
    recentDynamics.value = recentDynamics.value.filter((d) => d.idStr !== item.idStr)
    if (automation.config.lastLiveDynamicId === item.idStr) {
      automation.config.lastLiveDynamicId = ''
    }
    toast.success('已删除该动态')
  } catch (err) {
    toast.error('删除动态失败', { description: err instanceof Error ? err.message : String(err) })
  }
}

async function handleCleanupNow() {
  try {
    const res = await automation.cleanupLastLiveDynamic()
    if (!res.deleted) {
      toast.info('当前没有待清理的开播动态记录')
      return
    }
    toast.success('已清理上次开播动态', {
      description: res.restoredTop ? '已同步恢复原置顶动态' : undefined,
    })
    await refreshDynamics()
  } catch (err) {
    toast.error('清理失败', { description: err instanceof Error ? err.message : String(err) })
  }
}

onMounted(() => {
  void refreshDynamics()
})
</script>

<template>
  <div class="space-y-3">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <!-- 发布新动态 -->
      <Card>
        <CardHeader class="p-3 border-b">
          <CardTitle class="text-xs font-semibold flex items-center gap-1.5">
            <Send class="size-3.5 text-brand" />
            快捷发布 B 站动态
          </CardTitle>
          <CardDescription class="text-[11px]">支持纯文字或最多 9 张图片，工具箱九图/封面也可直出</CardDescription>
        </CardHeader>
        <CardContent class="p-3 space-y-3">
          <Textarea
            v-model="contentText"
            class="min-h-[96px]"
            placeholder="输入动态文案..."
          />

          <div
            v-if="selectedFiles.length > 0"
            class="grid grid-cols-3 gap-2"
          >
            <div
              v-for="(item, idx) in selectedFiles"
              :key="item.previewUrl"
              class="relative aspect-square rounded-md overflow-hidden border border-border bg-muted"
            >
              <img
                :src="item.previewUrl"
                class="w-full h-full object-cover"
              />
              <button
                type="button"
                class="absolute top-1 right-1 size-5 rounded-full bg-black/60 text-white flex-center hover:bg-destructive"
                @click="removeSelectedFile(idx)"
              >
                <X class="size-3" />
              </button>
            </div>
          </div>

          <div class="flex-between gap-2 flex-wrap">
            <label class="inline-flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              <ImagePlus class="size-3.5" />
              <span>添加图片 ({{ selectedFiles.length }}/9)</span>
              <input
                type="file"
                accept="image/*"
                multiple
                class="hidden"
                :disabled="selectedFiles.length >= 9"
                @change="onFileSelect"
              />
            </label>

            <SettingRow
              type="switch"
              variant="none"
              title="发布后置顶"
              v-model="pinAfterPublish"
            />
          </div>

          <div class="flex-between gap-2">
            <span class="text-[11px] text-muted-foreground">{{ uploadProgress }}</span>
            <Button
              :disabled="publishing"
              @click="handlePublish"
            >
              <Loader2
                v-if="publishing"
                class="size-3.5 mr-1.5 animate-spin"
              />
              <Send
                v-else
                class="size-3.5 mr-1.5"
              />
              {{ publishing ? '发布中...' : '发布动态' }}
            </Button>
          </div>
        </CardContent>
      </Card>

      <!-- 开播动态自动管理 -->
      <Card>
        <CardHeader class="p-3 border-b">
          <CardTitle class="text-xs font-semibold">开播 / 下播动态自动联动</CardTitle>
          <CardDescription class="text-[11px]">
            开播时自动发通知动态并置顶，下播自动删除并恢复自我介绍置顶动态
          </CardDescription>
        </CardHeader>
        <CardContent class="p-3 space-y-3">
          <SettingRow
            type="switch"
            variant="compact"
            title="开播自动发布通知动态"
            hint="使用下方文案模板自动发布"
            v-model="automation.config.autoPublishOnLiveStart"
          />

          <FormField
            label="开播动态模板"
            description="支持变量：{title} 直播标题、{roomId} 房间号、{uname} 昵称"
          >
            <Textarea
              v-model="automation.config.liveStartTemplate"
              class="min-h-[68px]"
            />
          </FormField>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <SettingRow
              type="switch"
              variant="compact"
              title="开播动态自动置顶"
              v-model="automation.config.pinLiveStartDynamic"
            />
            <SettingRow
              type="switch"
              variant="compact"
              title="下播自动删除开播动态"
              v-model="automation.config.autoDeleteOnLiveEnd"
            />
          </div>

          <FormField
            label="下播后恢复置顶的动态 ID（可选）"
            description="可从下方近期动态列表一键设为恢复目标"
          >
            <Input
              v-model="automation.config.restoreTopDynamicId"
              placeholder="例如 987654321012345678"
            />
          </FormField>

          <div
            v-if="automation.config.lastLiveDynamicId"
            class="flex-between gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-[11px]"
          >
            <span class="truncate text-muted-foreground">
              待清理开播动态：<span class="font-mono text-foreground">{{ automation.config.lastLiveDynamicId }}</span>
            </span>
            <Button
              variant="outline"
              size="xs"
              @click="handleCleanupNow"
            >
              立即清理
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- 近期动态管理 -->
    <Card>
      <CardHeader class="p-3 border-b flex-between flex-row">
        <div>
          <CardTitle class="text-xs font-semibold">主账号近期动态</CardTitle>
          <CardDescription class="text-[11px]">支持一键置顶/取消置顶、删除，或设为下播恢复置顶目标</CardDescription>
        </div>
        <Button
          variant="outline"
          size="xs"
          :disabled="loadingList"
          @click="refreshDynamics"
        >
          <RefreshCw
            class="size-3.5 mr-1"
            :class="{ 'animate-spin': loadingList }"
          />
          刷新
        </Button>
      </CardHeader>
      <CardContent class="p-3">
        <div
          v-if="loadingList && recentDynamics.length === 0"
          class="flex-center py-6"
        >
          <Spin />
        </div>
        <Empty
          v-else-if="recentDynamics.length === 0"
          description="暂无动态数据"
        />
        <div
          v-else
          class="space-y-2 max-h-80 overflow-y-auto scrollbar-thin"
        >
          <div
            v-for="item in recentDynamics"
            :key="item.idStr"
            class="flex-between gap-3 rounded-md border border-border bg-muted/25 px-3 py-2"
          >
            <div class="min-w-0 flex-1 space-y-0.5">
              <div class="flex items-center gap-1.5 flex-wrap">
                <Badge
                  v-if="item.isTop"
                  variant="secondary"
                  class="text-[10px]"
                >
                  已置顶
                </Badge>
                <span class="text-[11px] text-muted-foreground">{{ item.pubTimeText }}</span>
                <span class="text-[11px] text-muted-foreground font-mono">{{ item.idStr }}</span>
              </div>
              <div class="text-xs text-foreground line-clamp-2">
                {{ item.text || '（无文字内容 / 转发或卡片动态）' }}
              </div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="xs"
                @click="automation.config.restoreTopDynamicId = item.idStr"
              >
                设为常驻置顶
              </Button>
              <Button
                variant="outline"
                size="xs"
                @click="handleToggleTop(item)"
              >
                <component
                  :is="item.isTop ? PinOff : Pin"
                  class="size-3.5 mr-1"
                />
                {{ item.isTop ? '取消置顶' : '置顶' }}
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                class="text-muted-foreground hover:text-destructive"
                title="删除动态"
                @click="handleDelete(item)"
              >
                <Trash2 class="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
