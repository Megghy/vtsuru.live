<script setup lang="ts">
import { Checkmark24Regular, Copy24Regular, Open24Regular, People24Regular } from '@vicons/fluent'
import { useClipboard } from '@vueuse/core'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import type { PngtuberState } from '@/shared/pngtuber/types'
import { usePngtuberCollab } from '@/shared/pngtuber/usePngtuberCollab'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Progress } from '@/shared/ui/progress'

const props = defineProps<{
  state?: PngtuberState
}>()

const collab = usePngtuberCollab()
const account = useAccount()
const inputCode = ref('')
const loading = ref(false)
const copied = ref(false)
const { copy, isSupported: isCopySupported } = useClipboard()

const obsCollabUrl = computed(() => {
  if (!collab.currentRoomCode.value || typeof window === 'undefined') return ''
  const base = `${window.location.origin}/obs-store/pngtuber-collab`
  return `${base}?room=${encodeURIComponent(collab.currentRoomCode.value)}`
})

async function handleCreate() {
  if (loading.value) return
  loading.value = true
  try {
    const code = await collab.createRoom()
    // 注入当前立绘配置
    if (props.state) {
      await collab.joinRoom(code, true, props.state)
    }
    toast.success(`组队房间已创建：${code}`)
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : String(err))
  } finally {
    loading.value = false
  }
}

async function handleJoin() {
  const code = inputCode.value.trim().toUpperCase()
  if (!code) {
    toast.warning('请输入有效的 6 位房间码')
    return
  }
  loading.value = true
  try {
    await collab.joinRoom(code, false, props.state)
    inputCode.value = ''
    toast.success(`已加入组队房间：${code}`)
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : String(err))
  } finally {
    loading.value = false
  }
}

function handleLeave() {
  collab.leaveRoom()
  toast.info('已退出组队联动')
}

async function copyObsLink() {
  if (!obsCollabUrl.value) return
  if (!isCopySupported.value) {
    toast.warning('当前环境不支持直接写入剪贴板，请手动复制')
    return
  }
  try {
    await copy(obsCollabUrl.value)
    copied.value = true
    toast.success('已复制 OBS 组队画面源链接到剪贴板')
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    toast.error('复制失败，请手动复制')
  }
}
</script>

<template>
  <Card class="border border-border/80 bg-card/60">
    <CardHeader class="py-3 px-4 flex flex-row items-center justify-between gap-2 border-b border-border/50">
      <div class="flex items-center gap-2 flex-wrap">
        <div class="flex items-center gap-1.5 font-semibold text-sm">
          <People24Regular class="size-4 text-brand" />
          <CardTitle class="text-sm font-semibold">多人联动（组队模式）</CardTitle>
        </div>
        <Badge
          v-if="collab.inRoom.value"
          variant="outline"
          class="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-xs gap-1 font-mono"
        >
          组队中 · {{ collab.currentRoomCode.value }}
          <span class="font-sans">({{ collab.isHost.value ? '房主' : '队员' }})</span>
        </Badge>
      </div>

      <div
        v-if="collab.inRoom.value"
        class="flex items-center gap-1.5"
      >
        <Button
          variant="secondary"
          size="xs"
          class="gap-1 text-xs h-7"
          @click="copyObsLink"
        >
          <Checkmark24Regular
            v-if="copied"
            class="size-3.5"
          />
          <Copy24Regular
            v-else
            class="size-3.5"
          />
          复制组队 OBS 链接
        </Button>
        <Button
          variant="outline"
          size="xs"
          class="gap-1 text-xs h-7"
          as-child
        >
          <a
            :href="obsCollabUrl"
            target="_blank"
            rel="noopener"
          >
            <Open24Regular class="size-3.5" />
            画面预览
          </a>
        </Button>
        <Button
          variant="destructive"
          size="xs"
          class="text-xs h-7"
          @click="handleLeave"
        >
          {{ collab.isHost.value ? '解散房间' : '退出组队' }}
        </Button>
      </div>
    </CardHeader>

    <CardContent class="p-4 space-y-3">
      <Alert
        v-if="collab.collabError.value"
        variant="destructive"
      >
        <AlertDescription class="text-xs">{{ collab.collabError.value }}</AlertDescription>
      </Alert>

      <!-- 未加入房间：提供建房与加入入口 -->
      <div
        v-if="!collab.inRoom.value"
        class="space-y-3"
      >
        <p class="text-xs text-muted-foreground leading-relaxed m-0">
          通过 6 位房间码与其他主播快速连麦组队！加入后将在同一个 OBS 画面中并排展示双方立绘，并实时同步说话状态。
        </p>

        <div class="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
          <div class="flex items-center gap-1.5 flex-1">
            <Input
              v-model="inputCode"
              placeholder="输入 6 位房间码（如 MEUK86）"
              class="uppercase tracking-widest font-mono text-xs h-8"
              maxlength="16"
              @keyup.enter="handleJoin"
            />
            <Button
              variant="secondary"
              size="sm"
              class="shrink-0 h-8 text-xs"
              :disabled="loading || !inputCode.trim()"
              @click="handleJoin"
            >
              加入组队
            </Button>
          </div>

          <div class="h-4 w-px bg-border/80 hidden sm:block shrink-0" />

          <Button
            size="sm"
            class="shrink-0 h-8 text-xs"
            :disabled="loading"
            @click="handleCreate"
          >
            创建组队房间
          </Button>
        </div>
      </div>

      <!-- 已加入房间：队伍成员列表与实时动态 -->
      <div
        v-else
        class="space-y-3"
      >
        <div class="text-xs text-muted-foreground flex items-center justify-between">
          <span>队伍成员 ({{ collab.members.value.length }} 人)</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div
            v-for="member in collab.members.value"
            :key="member.userId"
            class="p-2.5 rounded-md border border-border bg-card/70 flex flex-col gap-1.5 transition-colors"
            :class="{ 'ring-1 ring-primary/60 border-primary/50': member.isSpeaking }"
          >
            <div class="flex items-center justify-between text-xs">
              <div class="flex items-center gap-1.5 truncate">
                <span
                  class="size-2 rounded-full shrink-0"
                  :class="member.isSpeaking ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40'"
                />
                <span class="font-medium truncate">{{ member.name }}</span>
                <span
                  v-if="member.userId === account.id"
                  class="text-[10px] text-muted-foreground shrink-0"
                  >(我)</span
                >
              </div>

              <div class="flex items-center gap-1 shrink-0">
                <Badge
                  v-if="member.muted"
                  variant="outline"
                  class="text-[10px] px-1 py-0 h-4 border-amber-500/40 text-amber-500"
                >
                  静音
                </Badge>
                <Badge
                  v-else-if="member.away"
                  variant="outline"
                  class="text-[10px] px-1 py-0 h-4 border-muted text-muted-foreground"
                >
                  暂离
                </Badge>
                <Badge
                  v-else-if="member.isSpeaking"
                  variant="outline"
                  class="text-[10px] px-1 py-0 h-4 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                >
                  说话中
                </Badge>
                <span class="text-[11px] font-mono text-muted-foreground">
                  {{ Math.round(member.volume) }}%
                </span>
              </div>
            </div>

            <Progress
              :model-value="Math.min(100, Math.max(0, Math.round(member.volume)))"
              class="h-1.5"
            />
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
