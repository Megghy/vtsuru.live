<script setup lang="ts">
import {
  ArrowHookUpLeft16Regular,
  Checkmark16Regular,
  Copy16Regular,
  Filter16Regular,
  Image16Regular,
  Open16Regular,
  PersonProhibited16Regular,
} from '@vicons/fluent'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import { FunctionTypes } from '@/api/api-models'
import { Button } from '@/shared/ui/button'
import { Textarea } from '@/shared/ui/textarea'
import { copyToClipboard, useMessage } from '@/shared/utils'

const message = useMessage()

import { avatarUrl, formatClock, formatRelative } from '../core/format'
import { userKeyOf } from '../core/types'
import { useEventActions } from '../store/eventActions'
import { useDashboardUi } from '../store/ui'
import { useLiveDashboard } from '../store/useLiveDashboard'
import EventBadges from './EventBadges.vue'
import UserHistory from './UserHistory.vue'
import UserPoints from './UserPoints.vue'

const dashboard = useLiveDashboard()
const ui = useDashboardUi()
const actions = useEventActions()
const account = useAccount()
const pointEnabled = computed(() => account.value.settings.enableFunctions.includes(FunctionTypes.Point))

const menu = computed(() => ui.userMenu)
const event = computed(() => menu.value?.event)
const userKey = computed(() => (event.value ? userKeyOf(event.value) : ''))
const filtering = computed(() => !!userKey.value && dashboard.userFilter?.userKey === userKey.value)
const noteDraft = ref('')

watch(userKey, (key) => {
  noteDraft.value = key ? (dashboard.notes.get(key)?.note ?? '') : ''
})

function close() {
  ui.userMenu = null
}

/** 点击其他用户名时由其自身切换菜单目标，不视为点击外部 */
function onClickOutside(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('[data-user-trigger]')) return
  close()
}

async function saveNote() {
  const e = event.value
  if (!e || noteDraft.value.trim() === (dashboard.notes.get(userKey.value)?.note ?? '')) return
  await dashboard.notes.set(userKey.value, e.uname, noteDraft.value)
  message.success(noteDraft.value.trim() ? '备注已保存' : '备注已清除')
}

function toggleFilter() {
  const e = event.value!
  if (filtering.value) dashboard.backToContext()
  else dashboard.filterByUser(e, e.key)
  close()
}

function run(action: () => void) {
  action()
  close()
}

const popoverStyle = computed(() => {
  if (!menu.value) return {}
  const maxX = typeof window !== 'undefined' ? window.innerWidth - 350 : 0
  const maxY = typeof window !== 'undefined' ? window.innerHeight - 450 : 0
  return {
    left: `${Math.min(menu.value.x, maxX)}px`,
    top: `${Math.min(menu.value.y, maxY)}px`,
  }
})

onMounted(() => {
  window.addEventListener('click', onClickOutside)
})

onUnmounted(() => {
  window.removeEventListener('click', onClickOutside)
})
</script>

<template>
  <div
    v-if="menu && event"
    class="user-menu-popover fixed z-50 w-[340px] rounded-md border bg-popover p-3 text-popover-foreground shadow-md"
    :style="popoverStyle"
    @click.stop
  >
    <div class="user-menu">
      <div class="user-menu__head">
        <img
          v-if="event.uface"
          class="user-menu__avatar"
          :src="avatarUrl(event.uface, 96)"
          referrerpolicy="no-referrer"
        />
        <div class="user-menu__who">
          <div class="user-menu__name">
            {{ event.uname || '匿名用户' }}
            <EventBadges
              :event="event"
              show-medal
            />
          </div>
          <div class="user-menu__sub">
            <span v-if="event.uid > 0">UID {{ event.uid }}</span>
            <span :title="dashboard.settings.absoluteTime ? formatRelative(event.time) : formatClock(event.time)">
              {{ dashboard.settings.absoluteTime ? formatClock(event.time) : formatRelative(event.time) }}
            </span>
          </div>
        </div>
      </div>

      <div class="user-menu__actions flex flex-wrap gap-1">
        <Button
          variant="secondary"
          class="px-2"
          @click="toggleFilter"
        >
          <component
            :is="filtering ? ArrowHookUpLeft16Regular : Filter16Regular"
            class="h-3.5 w-3.5 mr-1"
          />
          {{ filtering ? '转至上下文' : '筛选该用户' }}
        </Button>
        <Button
          variant="secondary"
          class="px-2"
          @click="run(() => dashboard.toggleRead(event!))"
        >
          <component
            :is="Checkmark16Regular"
            class="h-3.5 w-3.5 mr-1"
          />
          {{ dashboard.isRead(event) ? '标为未读' : '标为已读' }}
        </Button>
        <Button
          variant="secondary"
          class="px-2"
          @click="run(() => (ui.imageTarget = event!))"
        >
          <component
            :is="Image16Regular"
            class="h-3.5 w-3.5 mr-1"
          />
          保存为图片
        </Button>
        <Button
          variant="secondary"
          class="px-2"
          @click="run(() => copyToClipboard(event!.uname))"
        >
          <component
            :is="Copy16Regular"
            class="h-3.5 w-3.5 mr-1"
          />
          复制用户名
        </Button>
        <Button
          v-if="event.uid > 0"
          variant="secondary"
          as="a"
          :href="`https://space.bilibili.com/${event.uid}`"
          target="_blank"
          class="px-2"
        >
          <component
            :is="Open16Regular"
            class="h-3.5 w-3.5 mr-1"
          />
          个人空间
        </Button>
        <Button
          v-if="event.ouid"
          :variant="actions.isBlocked(event) ? 'secondary' : 'destructive'"
          class="px-2"
          @click="run(() => actions.toggleBlock(event!))"
        >
          <component
            :is="PersonProhibited16Regular"
            class="h-3.5 w-3.5 mr-1"
          />
          {{ actions.isBlocked(event) ? '移出黑名单' : '拉黑' }}
        </Button>
      </div>

      <UserPoints
        v-if="pointEnabled && event.ouid"
        :event="event"
      />

      <Textarea
        v-model="noteDraft"
        class="text-xs min-h-[38px] max-h-[96px]"
        placeholder="备注（仅保存在本机，失焦后保存）"
        @blur="saveNote"
      />

      <UserHistory :event="event" />
    </div>
  </div>
</template>

<style scoped>
.user-menu-anchor {
  display: none;
}

.user-menu {
  display: grid;
  gap: 10px;
}

.user-menu__head {
  display: flex;
  gap: 10px;
  align-items: center;
}

.user-menu__avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
}

.user-menu__who {
  min-width: 0;
}

.user-menu__name {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  font-weight: 600;
}

.user-menu__sub {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--muted-foreground);
}

.user-menu__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
