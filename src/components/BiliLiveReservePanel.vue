<script setup lang="ts">
import CalendarLtr20Regular from '@vicons/fluent/es/CalendarLtr20Regular'
import Clock20Regular from '@vicons/fluent/es/Clock20Regular'
import { Plus, Trash2 } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import type { ResponseBiliLiveReserveItem } from '@/api/generated/model'
import { isTauri } from '@/shared/config'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'
import { formatBiliLiveReserveInterval, formatBiliLiveReserveTime } from '@/shared/utils/formatBiliLiveReserve'

const props = defineProps<{
  items: ResponseBiliLiveReserveItem[]
  fetchedAt: number
  intervalMinutes: number
  liveRoomUrl?: string
  manage?: boolean
  autoSync?: boolean
  refreshing?: boolean
  syncing?: boolean
}>()

const emit = defineEmits<{
  refresh: []
  'update:autoSync': [value: boolean]
}>()

const inTauri = isTauri()
const createDialogOpen = ref(false)
const reserveTitle = ref('')
const reserveDateTime = ref('')
const reserveWithDynamic = ref(true)
const submitting = ref(false)
const cancellingSid = ref<number | null>(null)

const upcoming = computed(() => {
  const now = Date.now() / 1000
  return props.items.filter((item) => item.planStart >= now - 2 * 3600)
})

const fetchedLabel = computed(() => {
  if (!props.fetchedAt) return '尚未同步'
  return `上次同步 ${formatBiliLiveReserveTime(props.fetchedAt)}`
})

function openCreateDialog() {
  const defaultDate = new Date(Date.now() + 2 * 3600 * 1000)
  defaultDate.setMinutes(0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  reserveDateTime.value = `${defaultDate.getFullYear()}-${pad(defaultDate.getMonth() + 1)}-${pad(defaultDate.getDate())}T${pad(defaultDate.getHours())}:${pad(defaultDate.getMinutes())}`
  reserveTitle.value = ''
  reserveWithDynamic.value = true
  createDialogOpen.value = true
}

async function handleCreateReserve() {
  const title = reserveTitle.value.trim()
  if (!title) {
    toast.error('请填写直播预约标题')
    return
  }
  const tsMs = new Date(reserveDateTime.value).getTime()
  if (!reserveDateTime.value || Number.isNaN(tsMs)) {
    toast.error('请选择有效的开播时间')
    return
  }
  submitting.value = true
  try {
    const { createBiliLiveReserve } = await import('@/apps/client/api/bili-reserve')
    await createBiliLiveReserve(title, Math.floor(tsMs / 1000), { dynamic: reserveWithDynamic.value })
    toast.success('B 站直播预约创建成功')
    createDialogOpen.value = false
    emit('refresh')
  } catch (err) {
    toast.error('创建直播预约失败', { description: err instanceof Error ? err.message : String(err) })
  } finally {
    submitting.value = false
  }
}

async function handleCancelReserve(item: ResponseBiliLiveReserveItem) {
  if (!item.sid) return
  cancellingSid.value = item.sid
  try {
    const { cancelBiliLiveReserve } = await import('@/apps/client/api/bili-reserve')
    await cancelBiliLiveReserve(item.sid)
    toast.success(`已撤销直播预约「${item.title}」`)
    emit('refresh')
  } catch (err) {
    toast.error('撤销预约失败', { description: err instanceof Error ? err.message : String(err) })
  } finally {
    cancellingSid.value = null
  }
}
</script>

<template>
  <section
    data-site-surface="card"
    class="grid gap-2.5 min-w-0 py-3.5 px-4 border border-border rounded-[var(--radius,10px)] bg-popover"
  >
    <header class="flex items-start justify-between gap-3 flex-wrap">
      <div class="flex min-w-0 gap-2.5">
        <component
          :is="CalendarLtr20Regular"
          class="size-5 shrink-0 text-[#fb7299] mt-0.5"
        />
        <div>
          <strong class="block text-sm font-semibold text-foreground">B 站直播预约</strong>
          <p class="text-xs text-muted-foreground mt-0.5 leading-[1.45]">
            {{ fetchedLabel }} · {{ formatBiliLiveReserveInterval(intervalMinutes) }}
          </p>
        </div>
      </div>

      <div
        v-if="manage"
        class="bili-reserve__actions flex items-center gap-2 flex-wrap"
      >
        <div class="flex items-center gap-1.5">
          <span class="text-xs text-muted-foreground">写入日程表</span>
          <Switch
            :checked="autoSync"
            :disabled="syncing"
            @update:checked="emit('update:autoSync', $event)"
          />
        </div>
        <Button
          v-if="inTauri"
          size="xs"
          @click="openCreateDialog"
        >
          <Plus class="size-3.5 mr-1" />
          新建预约
        </Button>
        <Button
          variant="outline"
          size="xs"
          :disabled="refreshing"
          @click="emit('refresh')"
        >
          立即刷新
        </Button>
      </div>
    </header>

    <p
      v-if="manage"
      class="text-xs text-muted-foreground m-0 leading-[1.45]"
    >
      开启后会把预约合并进周历展示和日历订阅，手填日程不会被覆盖。
      <span v-if="inTauri">当前处于桌面客户端，可直接新建或撤销 B 站直播预约，也可在日程条目上点击一键推送。</span>
    </p>

    <Empty
      v-if="!upcoming.length"
      description="暂无即将开始的 B 站预约"
      class="py-4"
    />
    <ul
      v-else
      class="grid gap-2 m-0 p-0 list-none"
    >
      <li
        v-for="item in upcoming"
        :key="item.sid"
        class="flex items-center gap-2"
      >
        <a
          v-if="liveRoomUrl"
          :href="liveRoomUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="flex-1 min-w-0 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 py-2 px-2.5 rounded-md bg-muted no-underline text-inherit hover:bg-muted/80"
        >
          <span class="flex items-center text-xs text-muted-foreground">
            <component
              :is="Clock20Regular"
              class="size-3.5 inline mr-1"
            />
            {{ formatBiliLiveReserveTime(item.planStart) }}
          </span>
          <strong class="text-[13px] truncate">{{ item.title }}</strong>
          <em
            v-if="item.total > 0"
            class="text-[11px] not-italic text-[#fb7299]"
            >{{ item.total }} 人预约</em
          >
        </a>
        <div
          v-else
          class="flex-1 min-w-0 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 py-2 px-2.5 rounded-md bg-muted text-inherit"
        >
          <span class="flex items-center text-xs text-muted-foreground">
            <component
              :is="Clock20Regular"
              class="size-3.5 inline mr-1"
            />
            {{ formatBiliLiveReserveTime(item.planStart) }}
          </span>
          <strong class="text-[13px] truncate">{{ item.title }}</strong>
          <em
            v-if="item.total > 0"
            class="text-[11px] not-italic text-[#fb7299]"
            >{{ item.total }} 人预约</em
          >
        </div>

        <Button
          v-if="manage && inTauri && item.sid > 0"
          variant="ghost"
          size="icon-xs"
          class="text-muted-foreground hover:text-destructive shrink-0"
          :disabled="cancellingSid === item.sid"
          title="撤销此 B 站直播预约"
          @click="handleCancelReserve(item)"
        >
          <Trash2 class="size-3.5" />
        </Button>
      </li>
    </ul>

    <Dialog v-model:open="createDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新建 B 站直播预约</DialogTitle>
          <DialogDescription>使用客户端主账号 Cookie 在 B 站空间创建直播预约，完成后自动同步回日程表</DialogDescription>
        </DialogHeader>
        <div class="space-y-3 py-2">
          <FormField
            label="预约标题"
            description="建议 20 字以内"
          >
            <Input
              v-model="reserveTitle"
              placeholder="例如：周五歌回点歌台"
              maxlength="40"
            />
          </FormField>
          <FormField label="计划开播时间">
            <Input
              v-model="reserveDateTime"
              type="datetime-local"
            />
          </FormField>
          <SettingRow
            type="switch"
            variant="compact"
            title="同时发布预约动态"
            hint="向关注粉丝推送预约卡片动态"
            v-model="reserveWithDynamic"
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            @click="createDialogOpen = false"
          >
            取消
          </Button>
          <Button
            :disabled="submitting"
            @click="handleCreateReserve"
          >
            {{ submitting ? '创建中...' : '确认创建' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>
