<script setup lang="ts">
import { Ban, Plus, RefreshCw, Shield, ShieldAlert, Trash2, UserCheck, UserMinus, UserPlus } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import {
  addRoomAdmin,
  addShieldKeyword,
  banLiveRoomUser,
  deleteShieldKeyword,
  getRoomAdminList,
  getShieldKeywords,
  getSilentUserList,
  removeRoomAdmin,
  type RoomAdminItem,
  type RoomSilentModeType,
  setRoomSilentMode,
  type ShieldKeywordItem,
  type SilentUserItem,
  unbanLiveRoomUser,
} from '@/apps/client/api/room-control'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Spin } from '@/shared/ui/spin'

const account = useAccount()
const roomId = computed(() => account.value?.biliRoomId ?? 0)

const loading = ref(false)
const silentUsers = ref<SilentUserItem[]>([])
const roomAdmins = ref<RoomAdminItem[]>([])
const shieldKeywords = ref<ShieldKeywordItem[]>([])

// 快捷禁言
const banUidInput = ref('')
const banHourSelect = ref('1')
const banning = ref(false)

// 全局发言门槛
const silentMode = ref<RoomSilentModeType>('off')
const silentLevel = ref(1)
const silentMinute = ref(0)
const applyingSilentMode = ref(false)

// 任命房管
const adminUidInput = ref('')
const addingAdmin = ref(false)

// 屏蔽词
const newKeywordInput = ref('')
const addingKeyword = ref(false)

async function refreshAll() {
  if (!roomId.value) return
  loading.value = true
  try {
    const [silentRes, adminsRes, keywordsRes] = await Promise.allSettled([
      getSilentUserList(roomId.value),
      getRoomAdminList(roomId.value),
      getShieldKeywords(roomId.value),
    ])
    if (silentRes.status === 'fulfilled') silentUsers.value = silentRes.value.items
    if (adminsRes.status === 'fulfilled') roomAdmins.value = adminsRes.value
    if (keywordsRes.status === 'fulfilled') shieldKeywords.value = keywordsRes.value
    const failures = [
      silentRes.status === 'rejected' ? `禁言列表: ${silentRes.reason instanceof Error ? silentRes.reason.message : silentRes.reason}` : null,
      adminsRes.status === 'rejected' ? `房管列表: ${adminsRes.reason instanceof Error ? adminsRes.reason.message : adminsRes.reason}` : null,
      keywordsRes.status === 'rejected' ? `屏蔽词: ${keywordsRes.reason instanceof Error ? keywordsRes.reason.message : keywordsRes.reason}` : null,
    ].filter(Boolean)
    if (failures.length > 0) {
      toast.warning('部分场控数据加载失败', { description: failures.join('；') })
    }
  } catch (err) {
    toast.error('拉取场控数据失败', { description: err instanceof Error ? err.message : String(err) })
  } finally {
    loading.value = false
  }
}

async function handleQuickBan() {
  const uid = Number(banUidInput.value.trim())
  if (!roomId.value || !Number.isInteger(uid) || uid <= 0) {
    toast.error('请输入有效的目标用户 UID')
    return
  }
  banning.value = true
  try {
    const hour = Number(banHourSelect.value)
    await banLiveRoomUser(roomId.value, uid, hour)
    toast.success(`已禁言 UID ${uid}`)
    banUidInput.value = ''
    await refreshAll()
  } catch (err) {
    toast.error('禁言失败', { description: err instanceof Error ? err.message : String(err) })
  } finally {
    banning.value = false
  }
}

async function handleUnban(item: SilentUserItem) {
  if (!roomId.value) return
  try {
    await unbanLiveRoomUser(roomId.value, item.tuid)
    silentUsers.value = silentUsers.value.filter((u) => u.tuid !== item.tuid)
    toast.success(`已解除 ${item.tname || item.tuid} 的禁言`)
  } catch (err) {
    toast.error('解除禁言失败', { description: err instanceof Error ? err.message : String(err) })
  }
}

async function handleApplySilentMode() {
  if (!roomId.value) return
  applyingSilentMode.value = true
  try {
    await setRoomSilentMode(roomId.value, silentMode.value, silentLevel.value, silentMinute.value)
    const labelMap: Record<RoomSilentModeType, string> = {
      off: '已关闭全局禁言/门槛限制',
      member: '已开启全员禁言',
      level: `已开启用户等级 ≥ ${silentLevel.value} 发言门槛`,
      medal: `已开启粉丝勋章 ≥ ${silentLevel.value} 级发言门槛`,
    }
    toast.success(labelMap[silentMode.value])
  } catch (err) {
    toast.error('设置直播间发言门槛失败', { description: err instanceof Error ? err.message : String(err) })
  } finally {
    applyingSilentMode.value = false
  }
}

async function handleAddAdmin() {
  const uid = Number(adminUidInput.value.trim())
  if (!roomId.value || !Number.isInteger(uid) || uid <= 0) {
    toast.error('请输入有效的用户 UID')
    return
  }
  addingAdmin.value = true
  try {
    await addRoomAdmin(roomId.value, uid)
    toast.success(`已将 UID ${uid} 设为房管`)
    adminUidInput.value = ''
    await refreshAll()
  } catch (err) {
    toast.error('任命房管失败', { description: err instanceof Error ? err.message : String(err) })
  } finally {
    addingAdmin.value = false
  }
}

async function handleRemoveAdmin(admin: RoomAdminItem) {
  if (!roomId.value) return
  try {
    await removeRoomAdmin(roomId.value, admin.uid)
    roomAdmins.value = roomAdmins.value.filter((a) => a.uid !== admin.uid)
    toast.success(`已撤销 ${admin.uname || admin.uid} 的房管权限`)
  } catch (err) {
    toast.error('撤销房管失败', { description: err instanceof Error ? err.message : String(err) })
  }
}

async function handleAddKeyword() {
  const kw = newKeywordInput.value.trim()
  if (!roomId.value || !kw) return
  addingKeyword.value = true
  try {
    await addShieldKeyword(roomId.value, kw)
    toast.success(`已添加屏蔽词「${kw}」`)
    newKeywordInput.value = ''
    await refreshAll()
  } catch (err) {
    toast.error('添加屏蔽词失败', { description: err instanceof Error ? err.message : String(err) })
  } finally {
    addingKeyword.value = false
  }
}

async function handleDeleteKeyword(kw: string) {
  if (!roomId.value) return
  try {
    await deleteShieldKeyword(roomId.value, kw)
    shieldKeywords.value = shieldKeywords.value.filter((item) => item.keyword !== kw)
    toast.success(`已移除屏蔽词「${kw}」`)
  } catch (err) {
    toast.error('删除屏蔽词失败', { description: err instanceof Error ? err.message : String(err) })
  }
}

onMounted(() => {
  void refreshAll()
})
</script>

<template>
  <div class="space-y-3">
    <div class="flex-between gap-2">
      <div class="text-xs text-muted-foreground">
        房间号 <span class="font-mono text-foreground">{{ roomId || '未绑定' }}</span> · 使用主播主账号凭证执行场控操作
      </div>
      <Button
        variant="outline"
        size="xs"
        :disabled="loading || !roomId"
        @click="refreshAll"
      >
        <RefreshCw
          class="size-3.5 mr-1"
          :class="{ 'animate-spin': loading }"
        />
        刷新全部
      </Button>
    </div>

    <!-- 快捷禁言 + 全局发言门槛 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <Card>
        <CardHeader class="p-3 border-b">
          <CardTitle class="text-xs font-semibold flex items-center gap-1.5">
            <Ban class="size-3.5 text-destructive" />
            快捷禁言用户
          </CardTitle>
          <CardDescription class="text-[11px]">
            支持中控台右键单条弹幕快捷禁言，或直接输入目标 UID 封禁
          </CardDescription>
        </CardHeader>
        <CardContent class="p-3 space-y-3">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <FormField label="目标 UID">
              <Input
                v-model="banUidInput"
                placeholder="输入 B 站 UID"
                @keyup.enter="handleQuickBan"
              />
            </FormField>
            <FormField label="禁言时长">
              <Select v-model="banHourSelect">
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">本场直播</SelectItem>
                  <SelectItem value="1">1 小时</SelectItem>
                  <SelectItem value="24">24 小时</SelectItem>
                  <SelectItem value="168">7 天 (168小时)</SelectItem>
                  <SelectItem value="720">30 天 (720小时)</SelectItem>
                  <SelectItem value="-1">永久禁言</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <Button
            variant="destructive"
            :disabled="banning || !roomId"
            @click="handleQuickBan"
          >
            <Ban class="size-3.5 mr-1.5" />
            执行禁言
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="p-3 border-b">
          <CardTitle class="text-xs font-semibold flex items-center gap-1.5">
            <ShieldAlert class="size-3.5 text-amber-500" />
            全局禁言与发言门槛
          </CardTitle>
          <CardDescription class="text-[11px]">
            突发刷屏或节奏时可快速开启粉丝牌/等级限制或全员禁言
          </CardDescription>
        </CardHeader>
        <CardContent class="p-3 space-y-3">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <FormField label="限制模式">
              <Select v-model="silentMode">
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">关闭限制</SelectItem>
                  <SelectItem value="medal">仅粉丝勋章</SelectItem>
                  <SelectItem value="level">仅用户等级</SelectItem>
                  <SelectItem value="member">全员禁言</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              v-if="silentMode === 'medal' || silentMode === 'level'"
              label="最低等级"
            >
              <NumberField
                v-model="silentLevel"
                :min="1"
                :max="60"
              />
            </FormField>
            <FormField
              v-if="silentMode !== 'off'"
              label="持续分钟 (0=本场)"
            >
              <NumberField
                v-model="silentMinute"
                :min="0"
                :max="1440"
              />
            </FormField>
          </div>
          <Button
            :disabled="applyingSilentMode || !roomId"
            @click="handleApplySilentMode"
          >
            <Shield class="size-3.5 mr-1.5" />
            应用发言门槛
          </Button>
        </CardContent>
      </Card>
    </div>

    <!-- 禁言名单 + 房管管理 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <Card>
        <CardHeader class="p-3 border-b flex-between flex-row">
          <div>
            <CardTitle class="text-xs font-semibold">
              禁言名单 ({{ silentUsers.length }})
            </CardTitle>
            <CardDescription class="text-[11px]">直播间当前被禁言观众，支持一键解禁</CardDescription>
          </div>
        </CardHeader>
        <CardContent class="p-3">
          <div
            v-if="loading && silentUsers.length === 0"
            class="flex-center py-6"
          >
            <Spin />
          </div>
          <Empty
            v-else-if="silentUsers.length === 0"
            description="暂无禁言用户"
          />
          <div
            v-else
            class="space-y-1.5 max-h-64 overflow-y-auto scrollbar-thin"
          >
            <div
              v-for="item in silentUsers"
              :key="item.id"
              class="flex-between gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5"
            >
              <div class="min-w-0">
                <div class="text-xs font-medium truncate">
                  {{ item.tname || `UID ${item.tuid}` }}
                  <span class="text-[11px] text-muted-foreground font-mono ml-1">{{ item.tuid }}</span>
                </div>
                <div class="text-[11px] text-muted-foreground truncate">
                  {{ item.block_end_time ? `解禁: ${item.block_end_time}` : item.ctime }}
                  <span v-if="item.msg"> · {{ item.msg }}</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="xs"
                @click="handleUnban(item)"
              >
                解禁
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="p-3 border-b">
          <CardTitle class="text-xs font-semibold flex items-center gap-1.5">
            <UserCheck class="size-3.5 text-brand" />
            房管列表 ({{ roomAdmins.length }})
          </CardTitle>
          <CardDescription class="text-[11px]">查看、任命或撤销直播间房管</CardDescription>
        </CardHeader>
        <CardContent class="p-3 space-y-3">
          <div class="flex items-center gap-2">
            <Input
              v-model="adminUidInput"
              placeholder="输入要任命为房管的用户 UID"
              class="flex-1"
              @keyup.enter="handleAddAdmin"
            />
            <Button
              :disabled="addingAdmin || !roomId"
              @click="handleAddAdmin"
            >
              <UserPlus class="size-3.5 mr-1" />
              任命
            </Button>
          </div>
          <Empty
            v-if="roomAdmins.length === 0"
            description="暂无房管记录"
          />
          <div
            v-else
            class="space-y-1.5 max-h-56 overflow-y-auto scrollbar-thin"
          >
            <div
              v-for="admin in roomAdmins"
              :key="admin.uid"
              class="flex-between gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5"
            >
              <div class="min-w-0">
                <div class="text-xs font-medium truncate">
                  {{ admin.uname || `UID ${admin.uid}` }}
                  <span class="text-[11px] text-muted-foreground font-mono ml-1">{{ admin.uid }}</span>
                </div>
                <div
                  v-if="admin.ctime"
                  class="text-[11px] text-muted-foreground"
                >
                  任命时间: {{ admin.ctime }}
                </div>
              </div>
              <Button
                variant="ghost"
                size="xs"
                class="text-destructive hover:text-destructive"
                @click="handleRemoveAdmin(admin)"
              >
                <UserMinus class="size-3.5 mr-1" />
                撤销
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- 屏蔽词管理 -->
    <Card>
      <CardHeader class="p-3 border-b">
        <CardTitle class="text-xs font-semibold">
          直播间屏蔽词 ({{ shieldKeywords.length }})
        </CardTitle>
        <CardDescription class="text-[11px]">命中的弹幕与 SC 将在 B 站侧被自动拦截</CardDescription>
      </CardHeader>
      <CardContent class="p-3 space-y-3">
        <div class="flex items-center gap-2 max-w-md">
          <Input
            v-model="newKeywordInput"
            placeholder="输入要屏蔽的关键词"
            class="flex-1"
            @keyup.enter="handleAddKeyword"
          />
          <Button
            :disabled="addingKeyword || !roomId"
            @click="handleAddKeyword"
          >
            <Plus class="size-3.5 mr-1" />
            添加
          </Button>
        </div>
        <Empty
          v-if="shieldKeywords.length === 0"
          description="尚未配置屏蔽词"
        />
        <div
          v-else
          class="flex flex-wrap gap-1.5"
        >
          <Badge
            v-for="item in shieldKeywords"
            :key="item.keyword"
            variant="secondary"
            class="gap-1.5 py-1 px-2"
          >
            <span>{{ item.keyword }}</span>
            <button
              type="button"
              class="text-muted-foreground hover:text-destructive"
              :aria-label="`删除屏蔽词 ${item.keyword}`"
              @click="handleDeleteKeyword(item.keyword)"
            >
              <Trash2 class="size-3" />
            </button>
          </Badge>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
