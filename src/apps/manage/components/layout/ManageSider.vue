<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import type { AccountInfo } from '@/api/api-models'
import { showErrorToast } from '@/shared/services/toast'
import { usePersistedStorage } from '@/shared/storage/persist'
import { NavigateToNewTab } from '@/shared/utils'
import { useBiliAuth } from '@/store/useBiliAuth'

const props = defineProps<{
  accountInfo: AccountInfo
}>()

type ManageNavGroupId = 'favorites' | 'common' | 'data' | 'tools' | 'danmaku'
type ManageNavGroupKey = `group-${ManageNavGroupId}`

type ManageNavItem = {
  key: string
  label: string
  icon: string
  to?: { name: string }
  disabled?: boolean
  disabledReason?: string
  group: Exclude<ManageNavGroupId, 'favorites'>
}

const route = useRoute()
const router = useRouter()

const defaultCollapsed = window.innerWidth < 750
const collapsed = usePersistedStorage<boolean>('Settings.ManageSiderCollapsed', defaultCollapsed)
const siderWidth = 180
const siderCollapsedWidth = 56

const expandedGroups = usePersistedStorage<string[]>('Settings.ManageSiderExpandedGroups', [
  'group-favorites',
  'group-common',
  'group-data',
  'group-tools',
  'group-danmaku',
])

const favoriteMenuItems = usePersistedStorage<string[]>('Settings.FavoriteMenuItems', [])
const isFavorite = (key: string) => (favoriteMenuItems.value ?? []).includes(key)
function toggleFavorite(key: string) {
  const list = favoriteMenuItems.value ?? []
  const idx = list.indexOf(key)
  if (idx === -1) list.unshift(key)
  else list.splice(idx, 1)
  favoriteMenuItems.value = [...list]
}

const isBiliVerified = computed(() => !!props.accountInfo?.isBiliVerified)
const needsEmailVerified = computed(() => props.accountInfo?.isEmailVerified === false)

function gotoAuthPage() {
  if (!props.accountInfo?.biliUserAuthInfo) {
    showErrorToast('你尚未进行 Bilibili 认证, 请前往面板进行认证和绑定')
    return
  }
  void useBiliAuth()
    .setCurrentAuth(props.accountInfo?.biliUserAuthInfo.token)
    .then(() => {
      NavigateToNewTab('/bili-user')
    })
}

const activeKey = computed(() => (route.meta.parent as string) ?? route.name?.toString() ?? '')

const baseItems = computed<ManageNavItem[]>(() => {
  const emailDisabled = needsEmailVerified.value
  const biliDisabled = !isBiliVerified.value
  const biliReason = biliDisabled ? '需要完成 Bilibili 认证后才能使用' : undefined

  return [
    {
      key: 'manage-history',
      label: '历史',
      icon: 'i-lucide-history',
      to: { name: 'manage-history' },
      disabled: emailDisabled,
      group: 'common',
    },
    {
      key: 'manage-live',
      label: '直播记录',
      icon: 'i-lucide-radio',
      to: { name: 'manage-live' },
      disabled: emailDisabled,
      group: 'common',
    },
    {
      key: 'manage-analyze',
      label: '直播数据',
      icon: 'i-lucide-chart-no-axes-combined',
      to: { name: 'manage-analyze' },
      disabled: emailDisabled,
      group: 'common',
    },
    {
      key: 'org-index',
      label: '组织',
      icon: 'i-lucide-building-2',
      to: { name: 'org-index' },
      disabled: emailDisabled,
      group: 'common',
    },

    {
      key: 'manage-event',
      label: '舰长和SC',
      icon: 'i-lucide-ship-wheel',
      to: { name: 'manage-event' },
      disabled: emailDisabled,
      group: 'data',
    },
    {
      key: 'manage-point',
      label: '积分和礼物',
      icon: 'i-lucide-coins',
      to: { name: 'manage-point' },
      disabled: emailDisabled,
      group: 'data',
    },

    {
      key: 'manage-schedule',
      label: '日程',
      icon: 'i-lucide-calendar-clock',
      to: { name: 'manage-schedule' },
      disabled: emailDisabled,
      group: 'tools',
    },
    {
      key: 'manage-songList',
      label: '歌单',
      icon: 'i-lucide-music-2',
      to: { name: 'manage-songList' },
      disabled: emailDisabled,
      group: 'tools',
    },
    {
      key: 'manage-questionBox',
      label: '棉花糖 (提问箱)',
      icon: 'i-lucide-message-circle-question',
      to: { name: 'manage-questionBox' },
      disabled: emailDisabled,
      group: 'tools',
    },
    {
      key: 'manage-videoCollect',
      label: '视频征集',
      icon: 'i-lucide-video',
      to: { name: 'manage-videoCollect' },
      disabled: emailDisabled,
      group: 'tools',
    },
    {
      key: 'manage-lottery',
      label: '动态抽奖',
      icon: 'i-lucide-ticket-check',
      to: { name: 'manage-lottery' },
      disabled: emailDisabled,
      group: 'tools',
    },
    {
      key: 'manage-tools-dashboard',
      label: '工具箱',
      icon: 'i-lucide-grid-2x2',
      to: { name: 'manage-tools-dashboard' },
      disabled: emailDisabled,
      group: 'tools',
    },

    {
      key: 'manage-danmuji',
      label: '弹幕机',
      icon: 'i-lucide-messages-square',
      to: { name: 'manage-danmuji' },
      disabled: biliDisabled,
      disabledReason: biliReason,
      group: 'danmaku',
    },
    {
      key: 'manage-liveRequest',
      label: '点播',
      icon: 'i-lucide-circle-play',
      to: { name: 'manage-liveRequest' },
      disabled: biliDisabled,
      disabledReason: biliReason,
      group: 'danmaku',
    },
    {
      key: 'manage-liveLottery',
      label: '抽奖',
      icon: 'i-lucide-dices',
      to: { name: 'manage-liveLottery' },
      disabled: biliDisabled,
      disabledReason: biliReason,
      group: 'danmaku',
    },
    {
      key: 'manage-musicRequest',
      label: '点歌机',
      icon: 'i-lucide-list-music',
      to: { name: 'manage-musicRequest' },
      disabled: biliDisabled,
      disabledReason: biliReason,
      group: 'danmaku',
    },
    {
      key: 'manage-liveQueue',
      label: '排队',
      icon: 'i-lucide-list-ordered',
      to: { name: 'manage-liveQueue' },
      disabled: biliDisabled,
      disabledReason: biliReason,
      group: 'danmaku',
    },
    {
      key: 'manage-speech',
      label: '读弹幕',
      icon: 'i-lucide-audio-lines',
      to: { name: 'manage-speech' },
      disabled: biliDisabled,
      disabledReason: biliReason,
      group: 'danmaku',
    },
  ]
})

type ManageNavGroup = {
  key: ManageNavGroupKey
  label: string
  items: ManageNavItem[]
  hint?: string
}

const groups = computed<ManageNavGroup[]>(() => {
  const items = baseItems.value
  const map = new Map(items.map((i) => [i.key, i]))

  const favorites = (favoriteMenuItems.value ?? []).map((k) => map.get(k)).filter(Boolean) as ManageNavItem[]

  const notFav = (i: ManageNavItem) => !isFavorite(i.key)
  const next: ManageNavGroup[] = []

  if (favorites.length) next.push({ key: 'group-favorites', label: '我的收藏', items: favorites })

  const commonItems = items.filter((i) => i.group === 'common' && notFav(i))
  if (commonItems.length) next.push({ key: 'group-common', label: '常用', items: commonItems })

  const dataItems = items.filter((i) => i.group === 'data' && notFav(i))
  if (dataItems.length) next.push({ key: 'group-data', label: '数据', items: dataItems })

  const toolsItems = items.filter((i) => i.group === 'tools' && notFav(i))
  if (toolsItems.length) next.push({ key: 'group-tools', label: '互动与工具', items: toolsItems })

  const danmakuItems = items.filter((i) => i.group === 'danmaku' && notFav(i))
  if (danmakuItems.length) {
    next.push({
      key: 'group-danmaku',
      label: '弹幕相关',
      items: danmakuItems,
      hint: isBiliVerified.value ? '需要使用直播弹幕的功能' : '你尚未进行 Bilibili 认证, 请前往面板进行绑定',
    })
  }

  return next
})

function isGroupExpanded(key: ManageNavGroupKey) {
  return (expandedGroups.value ?? []).includes(key)
}

function toggleGroup(key: ManageNavGroupKey) {
  const list = expandedGroups.value ?? []
  const idx = list.indexOf(key)
  if (idx === -1) expandedGroups.value = [...list, key]
  else {
    list.splice(idx, 1)
    expandedGroups.value = [...list]
  }
}

watchEffect(() => {
  const allowed: ManageNavGroupKey[] = ['group-favorites', 'group-common', 'group-data', 'group-tools', 'group-danmaku']
  const list = Array.isArray(expandedGroups.value) ? expandedGroups.value : []
  const next = list.filter((k): k is ManageNavGroupKey => allowed.includes(k as any))
  if (next.length === 0) next.push(...allowed)
  if (next.join('|') !== list.join('|')) expandedGroups.value = next
})

function onClickNavItem(ev: MouseEvent, item: ManageNavItem) {
  if (item.disabled) {
    ev.preventDefault()
    ev.stopPropagation()
  }
}

async function go(name: string) {
  await router.push({ name })
}
</script>

<template>
  <aside
    v-if="accountInfo?.isEmailVerified"
    class="manage-sider"
    :class="{ collapsed }"
    :style="{ width: collapsed ? `${siderCollapsedWidth}px` : `${siderWidth}px` }"
  >
    <div class="manage-sider__top">
      <div class="manage-sider__top-row">
        <UButton
          class="sider-top-btn sider-top-btn--panel"
          size="small"
          color="neutral"
          variant="soft"
          :square="collapsed"
          icon="i-lucide-layout-dashboard"
          :title="collapsed ? '面板' : undefined"
          @click="go('manage-index')"
        >
          <span
            v-if="!collapsed"
            class="sider-top-label"
            >面板</span
          >
        </UButton>

        <UButton
          v-if="!collapsed"
          class="sider-top-icon-btn"
          size="small"
          color="neutral"
          variant="ghost"
          square
          icon="i-lucide-message-square-heart"
          :title="collapsed ? '反馈' : '反馈'"
          @click="go('manage-feedback')"
        />
      </div>

      <UButton
        class="sider-top-btn"
        size="small"
        variant="soft"
        :square="collapsed"
        :block="!collapsed"
        icon="i-lucide-file-pen-line"
        :title="collapsed ? '自定义页面' : undefined"
        @click="go('manage-userPageBuilder')"
      >
        <span
          v-if="!collapsed"
          class="sider-btn-label"
          >自定义页面</span
        >
      </UButton>

      <UButton
        v-if="accountInfo.biliUserAuthInfo"
        class="sider-top-btn"
        size="small"
        color="info"
        variant="soft"
        :square="collapsed"
        :block="!collapsed"
        icon="i-lucide-circle-user-round"
        :title="collapsed ? '认证用户主页' : undefined"
        @click="gotoAuthPage()"
      >
        <span
          v-if="!collapsed"
          class="sider-btn-label"
          >认证用户主页</span
        >
      </UButton>
    </div>

    <div class="manage-sider__nav">
      <nav
        class="manage-sider__nav-inner"
        :class="{ collapsed }"
      >
        <template
          v-for="g in groups"
          :key="g.key"
        >
          <div class="nav-group">
            <div
              v-if="!collapsed"
              class="nav-group__header"
            >
              <button
                class="nav-group__toggle"
                type="button"
                @click="toggleGroup(g.key)"
              >
                <span class="nav-group__label">{{ g.label }}</span>
                <span
                  class="nav-group__chev"
                  :class="{ open: isGroupExpanded(g.key) }"
                  >›</span
                >
              </button>

              <UTooltip
                v-if="g.key === 'group-danmaku'"
                :text="g.hint"
              >
                <template #trigger>
                  <button
                    class="nav-group__info"
                    type="button"
                    :title="g.hint || '提示'"
                  >
                    <UIcon
                      name="i-lucide-info"
                      class="nav-group__info-icon"
                    />
                  </button>
                </template>
              </UTooltip>
            </div>

            <div
              v-show="collapsed || isGroupExpanded(g.key)"
              class="nav-group__items"
            >
              <div
                v-for="item in g.items"
                :key="item.key"
                class="nav-item-row"
              >
                <RouterLink
                  v-if="!item.disabled && item.to"
                  :to="item.to"
                  class="nav-item"
                  :class="{ active: activeKey === item.key }"
                  :title="collapsed ? item.label : undefined"
                  @click="(ev: any) => onClickNavItem(ev, item)"
                >
                  <UIcon
                    :name="item.icon"
                    class="nav-item__icon"
                  />
                  <span
                    v-if="!collapsed"
                    class="nav-item__label"
                    >{{ item.label }}</span
                  >

                  <button
                    v-if="!collapsed"
                    class="nav-item__fav"
                    :class="{ active: isFavorite(item.key) }"
                    type="button"
                    :title="isFavorite(item.key) ? '取消收藏' : '收藏'"
                    @click.stop.prevent="toggleFavorite(item.key)"
                  >
                    <UIcon
                      name="i-lucide-bookmark"
                      class="nav-item__fav-icon"
                      :class="{ active: isFavorite(item.key) }"
                    />
                  </button>
                </RouterLink>

                <div
                  v-else
                  class="nav-item nav-item--disabled"
                  :title="item.disabledReason || item.label"
                >
                  <UIcon
                    :name="item.icon"
                    class="nav-item__icon"
                  />
                  <span
                    v-if="!collapsed"
                    class="nav-item__label"
                    >{{ item.label }}</span
                  >
                  <button
                    v-if="!collapsed"
                    class="nav-item__fav"
                    :class="{ active: isFavorite(item.key) }"
                    type="button"
                    :title="isFavorite(item.key) ? '取消收藏' : '收藏'"
                    @click.stop.prevent="toggleFavorite(item.key)"
                  >
                    <UIcon
                      :name="isFavorite(item.key) ? 'i-lucide-bookmark-check' : 'i-lucide-bookmark'"
                      class="nav-item__fav-icon"
                      :class="{ active: isFavorite(item.key) }"
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </template>
      </nav>
    </div>

    <div
      v-if="!collapsed"
      class="manage-sider__footer"
    >
      <div class="footer-line">
        有更多功能建议请
        <UButton
          variant="link"
          size="tiny"
          @click="go('manage-feedback')"
        >
          反馈
        </UButton>
      </div>
      <div class="footer-line">
        <UButton
          variant="link"
          size="tiny"
          @click="go('about')"
        >
          关于本站
        </UButton>
      </div>
      <div class="footer-by">By Megghy</div>
    </div>
  </aside>
</template>

<style scoped>
.manage-sider {
  height: 100%;
  border-right: 1px solid var(--vtsuru-border);
  background: var(--vtsuru-bg-surface);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 180ms var(--vtsuru-bezier, cubic-bezier(0.4, 0, 0.2, 1));
}

.manage-sider__top {
  padding: 9px 10px 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.manage-sider__top-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.manage-sider.collapsed .manage-sider__top-row {
  justify-content: center;
}

.sider-top-btn {
  height: 34px;
  justify-content: flex-start;
}

.sider-top-btn--panel {
  flex: 1;
  min-width: 0;
}

.manage-sider.collapsed .sider-top-btn--panel {
  flex: 0 0 auto;
}

.sider-top-icon-btn {
  height: 34px;
  width: 34px;
  flex: 0 0 auto;
}

.manage-sider.collapsed .sider-top-icon-btn {
  height: 32px;
  width: 32px;
}

.manage-sider.collapsed .sider-top-btn {
  height: 32px;
  width: 32px;
  padding: 0;
  justify-content: center;
  margin: 0 auto;
}

.sider-icon {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
}

.sider-top-label,
.sider-btn-label {
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.manage-sider__nav {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.manage-sider__nav-inner {
  padding: 4px 8px 10px;
  transition: padding 180ms var(--vtsuru-bezier, cubic-bezier(0.4, 0, 0.2, 1));
}

.manage-sider__nav-inner.collapsed {
  padding: 4px 6px 10px;
}

.nav-group {
  padding: 6px 0;
}

.manage-sider.collapsed .nav-group + .nav-group::before {
  content: '';
  display: block;
  height: 1px;
  background: linear-gradient(to right, transparent, rgba(127, 127, 127, 0.18), transparent);
  margin: 5px 20px 3px;
  border-radius: 1px;
}

.nav-group__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 2px 4px 6px;
}

.nav-group__toggle {
  border: none;
  background: transparent;
  color: var(--vtsuru-fg-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 2px 0;
}

.nav-group__chev {
  display: inline-block;
  transform: rotate(90deg);
  transition: transform 120ms ease;
  opacity: 0.8;
}

.nav-group__chev.open {
  transform: rotate(270deg);
}

.nav-group__info {
  height: 22px;
  width: 22px;
  border-radius: 7px;
  border: 1px solid var(--vtsuru-border);
  background: transparent;
  color: var(--vtsuru-fg-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.nav-group__info:hover {
  background: rgba(127, 127, 127, 0.08);
}

.nav-group__info-icon {
  width: 14px;
  height: 14px;
}

.danmaku-tooltip {
  width: 320px;
  max-width: min(360px, 70vw);
  padding: 10px 10px;
  border-radius: 12px;
}

.danmaku-tooltip__title {
  font-size: 12px;
  font-weight: 800;
  margin-bottom: 6px;
}

.danmaku-tooltip__body {
  font-size: 12px;
  line-height: 1.55;
  color: var(--vtsuru-fg);
}

.danmaku-tooltip__body a {
  color: var(--vtsuru-primary);
  text-decoration: none;
}

.danmaku-tooltip__body a:hover {
  text-decoration: underline;
}

.nav-group__items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  height: 34px;
  border-radius: 10px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--vtsuru-fg);
  border: 1px solid transparent;
  background: transparent;
  transition:
    background-color 120ms ease,
    border-color 120ms ease;
  box-sizing: border-box;
}

.manage-sider.collapsed .nav-item {
  padding: 0;
  justify-content: center;
}

.nav-item:hover {
  background: rgba(127, 127, 127, 0.08);
}

.nav-item:focus-visible {
  outline: 2px solid rgba(127, 127, 127, 0.28);
  outline-offset: 2px;
}

.nav-item.active {
  background: rgba(127, 127, 127, 0.12);
  border-color: rgba(127, 127, 127, 0.18);
}

.nav-item--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nav-item__icon {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
}

.nav-item__label {
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.nav-item__fav {
  height: 22px;
  width: 22px;
  border-radius: 7px;
  border: 1px solid rgba(127, 127, 127, 0.541);
  background: rgba(127, 127, 127, 0.04);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0.5;
  transition:
    opacity 120ms ease,
    background-color 120ms ease,
    border-color 120ms ease;
}

.nav-item-row:hover .nav-item__fav,
.nav-item__fav.active {
  opacity: 1;
}

.nav-item-row:hover .nav-item__fav {
  background: rgba(127, 127, 127, 0.08);
  border-color: rgba(127, 127, 127, 0.25);
}

.nav-item__fav:hover {
  background: rgba(127, 127, 127, 0.08);
  border-color: rgba(127, 127, 127, 0.22);
}

.nav-item__fav.active {
  background: rgba(245, 158, 11, 0.26);
  border-color: rgba(245, 158, 11, 0.58);
  box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.26);
}

.nav-item__fav-icon {
  font-size: 16px;
  color: var(--vtsuru-fg-muted);
  transition: color 120ms ease;
}

.nav-item__fav-icon.active {
  color: var(--vtsuru-warning);
}

.nav-item__fav.active .nav-item__fav-icon {
  color: rgb(245, 158, 11);
  filter: drop-shadow(0 0 6px rgba(245, 158, 11, 0.28));
}

.manage-sider__footer {
  border-top: 1px solid var(--vtsuru-border);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}

.footer-line {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
  text-align: center;
}

.footer-by {
  margin-top: 4px;
  font-size: 12px;
  text-align: center;
  color: var(--vtsuru-fg-muted);
}
</style>
