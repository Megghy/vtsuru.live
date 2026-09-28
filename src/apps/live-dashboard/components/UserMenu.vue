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
import { NButton, NIcon, NInput, NPopover } from 'naive-ui'
import { computed, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import { FunctionTypes } from '@/api/api-models'
import { copyToClipboard } from '@/shared/utils'

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
  window.$message.success(noteDraft.value.trim() ? '备注已保存' : '备注已清除')
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
</script>

<template>
  <NPopover
    :show="!!menu"
    :x="menu?.x"
    :y="menu?.y"
    trigger="manual"
    placement="bottom-start"
    :style="{ width: '340px', padding: '10px 12px' }"
    @clickoutside="onClickOutside"
  >
    <template #trigger>
      <!-- 按 x/y 定位；trigger 插槽不可为空，放一个不可见占位 -->
      <span class="user-menu-anchor" />
    </template>
    <div
      v-if="event"
      class="user-menu"
    >
      <div class="user-menu__head">
        <img
          v-if="event.uface"
          class="user-menu__avatar"
          :src="avatarUrl(event.uface, 96)"
          referrerpolicy="no-referrer"
        >
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

      <div class="user-menu__actions">
        <NButton
          size="tiny"
          secondary
          @click="toggleFilter"
        >
          <template #icon>
            <NIcon :component="filtering ? ArrowHookUpLeft16Regular : Filter16Regular" />
          </template>
          {{ filtering ? '转至上下文' : '筛选该用户' }}
        </NButton>
        <NButton
          size="tiny"
          secondary
          @click="run(() => dashboard.toggleRead(event!))"
        >
          <template #icon>
            <NIcon :component="Checkmark16Regular" />
          </template>
          {{ dashboard.isRead(event) ? '标为未读' : '标为已读' }}
        </NButton>
        <NButton
          size="tiny"
          secondary
          @click="run(() => (ui.imageTarget = event!))"
        >
          <template #icon>
            <NIcon :component="Image16Regular" />
          </template>
          保存为图片
        </NButton>
        <NButton
          size="tiny"
          secondary
          @click="run(() => copyToClipboard(event!.uname))"
        >
          <template #icon>
            <NIcon :component="Copy16Regular" />
          </template>
          复制用户名
        </NButton>
        <NButton
          v-if="event.uid > 0"
          size="tiny"
          secondary
          tag="a"
          :href="`https://space.bilibili.com/${event.uid}`"
          target="_blank"
        >
          <template #icon>
            <NIcon :component="Open16Regular" />
          </template>
          个人空间
        </NButton>
        <NButton
          v-if="event.ouid"
          size="tiny"
          secondary
          :type="actions.isBlocked(event) ? 'default' : 'error'"
          @click="run(() => actions.toggleBlock(event!))"
        >
          <template #icon>
            <NIcon :component="PersonProhibited16Regular" />
          </template>
          {{ actions.isBlocked(event) ? '移出黑名单' : '拉黑' }}
        </NButton>
      </div>

      <UserPoints
        v-if="pointEnabled && event.ouid"
        :event="event"
      />

      <NInput
        v-model:value="noteDraft"
        type="textarea"
        size="small"
        placeholder="备注（仅保存在本机，失焦后保存）"
        :autosize="{ minRows: 1, maxRows: 4 }"
        @blur="saveNote"
      />

      <UserHistory :event="event" />
    </div>
  </NPopover>
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
  color: var(--vtsuru-fg-muted);
}

.user-menu__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
