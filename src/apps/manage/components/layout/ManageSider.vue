<script setup lang="ts">
  import type { AccountInfo } from '@/api/api-models';
  import { NavigateToNewTab } from '@/shared/utils';
  import { useBiliAuth } from '@/store/useBiliAuth';
  import {
    BookCoins20Filled, CalendarClock24Filled, Info24Filled, Live24Filled, Lottery24Filled, PeopleQueue24Filled, Person48Filled, PersonFeedback24Filled, TabletSpeaker24Filled, VehicleShip24Filled, VideoAdd20Filled, } from '@vicons/fluent';
  import {
    AnalyticsSharp, Bookmark, BookmarkOutline, Chatbox, ChatbubbleEllipsesOutline, DocumentTextOutline, Eye, GridOutline, MusicalNote, MusicalNotesOutline, PlayCircleOutline
  } from '@vicons/ionicons5';
  import { usePersistedStorage } from '@/shared/storage/persist';
  import { NButton, NIcon, NScrollbar, NTooltip, useMessage } from 'naive-ui'
  import { computed, watchEffect } from 'vue';
  import { RouterLink, useRoute, useRouter } from 'vue-router';

  const props = defineProps<{
    accountInfo: AccountInfo;
  }>();

  type ManageNavGroupId = 'favorites' | 'common' | 'data' | 'tools' | 'danmaku';
  type ManageNavGroupKey = `group-${ManageNavGroupId}`;

  type ManageNavItem = {
    key: string;
    label: string;
    icon: any;
    to?: { name: string; };
    disabled?: boolean;
    disabledReason?: string;
    group: Exclude<ManageNavGroupId, 'favorites'>;
  };

  const message = useMessage();
  const route = useRoute();
  const router = useRouter();

  const defaultCollapsed = window.innerWidth < 750;
  const collapsed = usePersistedStorage<boolean>('Settings.ManageSiderCollapsed', defaultCollapsed);
  const siderWidth = 180;
  const siderCollapsedWidth = 56;

  const expandedGroups = usePersistedStorage<string[]>('Settings.ManageSiderExpandedGroups', [
    'group-favorites',
    'group-common',
    'group-data',
    'group-tools',
    'group-danmaku',
  ]);

  const favoriteMenuItems = usePersistedStorage<string[]>('Settings.FavoriteMenuItems', []);
  const isFavorite = (key: string) => (favoriteMenuItems.value ?? []).includes(key);
  function toggleFavorite(key: string) {
    const list = favoriteMenuItems.value ?? [];
    const idx = list.indexOf(key);
    if (idx === -1) list.unshift(key);
    else list.splice(idx, 1);
    favoriteMenuItems.value = [...list];
  }

  const isBiliVerified = computed(() => !!props.accountInfo?.isBiliVerified);
  const needsEmailVerified = computed(() => props.accountInfo?.isEmailVerified === false);

  function gotoAuthPage() {
    if (!props.accountInfo?.biliUserAuthInfo) {
      message.error('你尚未进行 Bilibili 认证, 请前往面板进行认证和绑定');
      return;
    }
    void useBiliAuth()
      .setCurrentAuth(props.accountInfo?.biliUserAuthInfo.token)
      .then(() => {
        NavigateToNewTab('/bili-user');
      });
  }

  const activeKey = computed(() => ((route.meta.parent as string) ?? route.name?.toString()) ?? '');

  const baseItems = computed<ManageNavItem[]>(() => {
    const emailDisabled = needsEmailVerified.value;
    const biliDisabled = !isBiliVerified.value;
    const biliReason = biliDisabled ? '需要完成 Bilibili 认证后才能使用' : undefined;

    return [
      { key: 'manage-history', label: '历史', icon: AnalyticsSharp, to: { name: 'manage-history' }, disabled: emailDisabled, group: 'common' },
      { key: 'manage-live', label: '直播记录', icon: Live24Filled, to: { name: 'manage-live' }, disabled: emailDisabled, group: 'common' },
      { key: 'manage-analyze', label: '直播数据', icon: Eye, to: { name: 'manage-analyze' }, disabled: emailDisabled, group: 'common' },
      { key: 'org-index', label: '组织', icon: PeopleQueue24Filled, to: { name: 'org-index' }, disabled: emailDisabled, group: 'common' },

      { key: 'manage-event', label: '舰长和SC', icon: VehicleShip24Filled, to: { name: 'manage-event' }, disabled: emailDisabled, group: 'data' },
      { key: 'manage-point', label: '积分和礼物', icon: BookCoins20Filled, to: { name: 'manage-point' }, disabled: emailDisabled, group: 'data' },

      { key: 'manage-schedule', label: '日程', icon: CalendarClock24Filled, to: { name: 'manage-schedule' }, disabled: emailDisabled, group: 'tools' },
      { key: 'manage-songList', label: '歌单', icon: MusicalNote, to: { name: 'manage-songList' }, disabled: emailDisabled, group: 'tools' },
      { key: 'manage-questionBox', label: '棉花糖 (提问箱)', icon: Chatbox, to: { name: 'manage-questionBox' }, disabled: emailDisabled, group: 'tools' },
      { key: 'manage-videoCollect', label: '视频征集', icon: VideoAdd20Filled, to: { name: 'manage-videoCollect' }, disabled: emailDisabled, group: 'tools' },
      { key: 'manage-lottery', label: '动态抽奖', icon: Lottery24Filled, to: { name: 'manage-lottery' }, disabled: emailDisabled, group: 'tools' },

      { key: 'manage-danmuji', label: '弹幕机', icon: ChatbubbleEllipsesOutline, to: { name: 'manage-danmuji' }, disabled: biliDisabled, disabledReason: biliReason, group: 'danmaku' },
      { key: 'manage-liveRequest', label: '点播', icon: PlayCircleOutline, to: { name: 'manage-liveRequest' }, disabled: biliDisabled, disabledReason: biliReason, group: 'danmaku' },
      { key: 'manage-liveLottery', label: '抽奖', icon: Lottery24Filled, to: { name: 'manage-liveLottery' }, disabled: biliDisabled, disabledReason: biliReason, group: 'danmaku' },
      { key: 'manage-musicRequest', label: '点歌机', icon: MusicalNotesOutline, to: { name: 'manage-musicRequest' }, disabled: biliDisabled, disabledReason: biliReason, group: 'danmaku' },
      { key: 'manage-liveQueue', label: '排队', icon: PeopleQueue24Filled, to: { name: 'manage-liveQueue' }, disabled: biliDisabled, disabledReason: biliReason, group: 'danmaku' },
      { key: 'manage-speech', label: '读弹幕', icon: TabletSpeaker24Filled, to: { name: 'manage-speech' }, disabled: biliDisabled, disabledReason: biliReason, group: 'danmaku' },
    ];
  });

  type ManageNavGroup = {
    key: ManageNavGroupKey;
    label: string;
    items: ManageNavItem[];
    hint?: string;
  };

  const groups = computed<ManageNavGroup[]>(() => {
    const items = baseItems.value;
    const map = new Map(items.map(i => [i.key, i]));

    const favorites = (favoriteMenuItems.value ?? [])
      .map(k => map.get(k))
      .filter(Boolean) as ManageNavItem[];

    const notFav = (i: ManageNavItem) => !isFavorite(i.key);
    const next: ManageNavGroup[] = [];

    if (favorites.length) next.push({ key: 'group-favorites', label: '我的收藏', items: favorites });

    const commonItems = items.filter(i => i.group === 'common' && notFav(i));
    if (commonItems.length) next.push({ key: 'group-common', label: '常用', items: commonItems });

    const dataItems = items.filter(i => i.group === 'data' && notFav(i));
    if (dataItems.length) next.push({ key: 'group-data', label: '数据', items: dataItems });

    const toolsItems = items.filter(i => i.group === 'tools' && notFav(i));
    if (toolsItems.length) next.push({ key: 'group-tools', label: '互动与工具', items: toolsItems });

    const danmakuItems = items.filter(i => i.group === 'danmaku' && notFav(i));
    if (danmakuItems.length) {
      next.push({
        key: 'group-danmaku',
        label: '弹幕相关',
        items: danmakuItems,
        hint: isBiliVerified.value ? '需要使用直播弹幕的功能' : '你尚未进行 Bilibili 认证, 请前往面板进行绑定',
      });
    }

    return next;
  });

  function isGroupExpanded(key: ManageNavGroupKey) {
    return (expandedGroups.value ?? []).includes(key);
  }

  function toggleGroup(key: ManageNavGroupKey) {
    const list = expandedGroups.value ?? [];
    const idx = list.indexOf(key);
    if (idx === -1) expandedGroups.value = [...list, key];
    else {
      list.splice(idx, 1);
      expandedGroups.value = [...list];
    }
  }

  watchEffect(() => {
    const allowed: ManageNavGroupKey[] = ['group-favorites', 'group-common', 'group-data', 'group-tools', 'group-danmaku'];
    const list = Array.isArray(expandedGroups.value) ? expandedGroups.value : [];
    const next = list.filter((k): k is ManageNavGroupKey => allowed.includes(k as any));
    if (next.length === 0) next.push(...allowed);
    if (next.join('|') !== list.join('|')) expandedGroups.value = next;
  });

  function onClickNavItem(ev: MouseEvent, item: ManageNavItem) {
    if (item.disabled) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  }

  async function go(name: string) {
    await router.push({ name });
  }
</script>

<template>
  <aside
    v-if="accountInfo?.isEmailVerified" class="manage-sider" :class="{ collapsed }"
    :style="{ width: collapsed ? `${siderCollapsedWidth}px` : `${siderWidth}px` }"
  >
    <div class="manage-sider__top">
      <div class="manage-sider__top-row">
        <NButton
          class="sider-top-btn sider-top-btn--panel" size="small" secondary :circle="collapsed"
          :title="collapsed ? '面板' : undefined" @click="go('manage-index')"
        >
          <template #icon>
            <component :is="GridOutline" class="sider-icon" />
          </template>
          <span v-if="!collapsed" class="sider-top-label">面板</span>
        </NButton>

        <NButton
          v-if="!collapsed" class="sider-top-icon-btn" size="small" quaternary circle
          :title="collapsed ? '反馈' : '反馈'" @click="go('manage-feedback')"
        >
          <template #icon>
            <component :is="PersonFeedback24Filled" class="sider-icon" />
          </template>
        </NButton>
      </div>

      <NButton
        class="sider-top-btn" size="small" type="primary" secondary strong :circle="collapsed"
        :block="!collapsed" :title="collapsed ? '自定义页面' : undefined" @click="go('manage-userPageBuilder')"
      >
        <template #icon>
          <component :is="DocumentTextOutline" class="sider-icon" />
        </template>
        <span v-if="!collapsed" class="sider-btn-label">自定义页面</span>
      </NButton>

      <NButton
        v-if="accountInfo.biliUserAuthInfo" class="sider-top-btn" size="small" type="info" secondary strong
        :circle="collapsed" :block="!collapsed" :title="collapsed ? '认证用户主页' : undefined" @click="gotoAuthPage()"
      >
        <template #icon>
          <component :is="Person48Filled" class="sider-icon" />
        </template>
        <span v-if="!collapsed" class="sider-btn-label">认证用户主页</span>
      </NButton>
    </div>

    <NScrollbar class="manage-sider__nav">
      <nav class="manage-sider__nav-inner" :class="{ collapsed }">
        <template v-for="g in groups" :key="g.key">
          <div class="nav-group">
            <div v-if="!collapsed" class="nav-group__header">
              <button class="nav-group__toggle" type="button" @click="toggleGroup(g.key)">
                <span class="nav-group__label">{{ g.label }}</span>
                <span class="nav-group__chev" :class="{ open: isGroupExpanded(g.key) }">›</span>
              </button>

              <NTooltip v-if="g.key === 'group-danmaku'" placement="right" :show-arrow="false" trigger="hover">
                <template #trigger>
                  <button class="nav-group__info" type="button" :title="g.hint || '提示'">
                    <component :is="Info24Filled" class="nav-group__info-icon" />
                  </button>
                </template>
                <div class="danmaku-tooltip">
                  <div class="danmaku-tooltip__title">
                    可用性警告
                  </div>
                  <div class="danmaku-tooltip__body">
                    当浏览器在后台运行时，定时器和 WebSocket 连接将受到严格限制，可能导致弹幕接收功能无法正常工作（详见
                    <a
                      href="https://developer.chrome.com/blog/background_tabs/" target="_blank"
                      rel="noreferrer"
                    >此文章</a>）。
                    为避免遗漏事件，建议使用
                    <a
                      href="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs" target="_blank"
                      rel="noreferrer"
                    >VtsuruEventFetcher</a>
                    或尽量保持网页在前台运行，并关闭浏览器的“页面休眠/内存节省”功能。
                    <div style="margin-top: 6px">
                      <a
                        href="https://support.google.com/chrome/answer/12929150?hl=zh-Hans#zippy=%2C%E5%BC%80%E5%90%AF%E6%88%96%E5%85%B3%E9%97%AD%E7%9C%81%E5%86%85%E5%AD%98%E6%A8%A1%E5%BC%8F%2C%E8%AE%A9%E7%89%B9%E5%AE%9A%E7%BD%91%E7%AB%99%E4%BF%9D%E6%8C%81%E6%B4%BB%E5%8A%A8%E7%8A%B6%E6%80%81"
                        target="_blank" rel="noreferrer"
                      >Chrome: 让特定网站保持活动状态</a>
                      ，
                      <a
                        href="https://support.microsoft.com/zh-cn/topic/%E4%BA%86%E8%A7%A3-microsoft-edge-%E4%B8%AD%E7%9A%84%E6%80%A7%E8%83%BD%E5%8A%9F%E8%83%BD-7b36f363-2119-448a-8de6-375cfd88ab25"
                        target="_blank" rel="noreferrer"
                      >Edge: 永远不想进入睡眠状态的网站</a>
                    </div>
                  </div>
                </div>
              </NTooltip>
            </div>

            <div v-show="collapsed || isGroupExpanded(g.key)" class="nav-group__items">
              <div v-for="item in g.items" :key="item.key" class="nav-item-row">
                <RouterLink
                  v-if="!item.disabled && item.to" :to="item.to" class="nav-item"
                  :class="{ active: activeKey === item.key }" :title="collapsed ? item.label : undefined"
                  @click="(ev: any) => onClickNavItem(ev, item)"
                >
                  <component :is="item.icon" class="nav-item__icon" />
                  <span v-if="!collapsed" class="nav-item__label">{{ item.label }}</span>

                  <button
                    v-if="!collapsed" class="nav-item__fav" :class="{ active: isFavorite(item.key) }"
                    type="button" :title="isFavorite(item.key) ? '取消收藏' : '收藏'"
                    @click.stop.prevent="toggleFavorite(item.key)"
                  >
                    <NIcon
                      class="nav-item__fav-icon" :class="{ active: isFavorite(item.key) }" :size="12"
                      :component="Bookmark" :color="isFavorite(item.key) ? '#f59e0b' : '#777'"
                    />
                  </button>
                </RouterLink>

                <div v-else class="nav-item nav-item--disabled" :title="item.disabledReason || item.label">
                  <component :is="item.icon" class="nav-item__icon" />
                  <span v-if="!collapsed" class="nav-item__label">{{ item.label }}</span>
                  <button
                    v-if="!collapsed" class="nav-item__fav" :class="{ active: isFavorite(item.key) }"
                    type="button" :title="isFavorite(item.key) ? '取消收藏' : '收藏'"
                    @click.stop.prevent="toggleFavorite(item.key)"
                  >
                    <NIcon class="nav-item__fav-icon" :class="{ active: isFavorite(item.key) }">
                      <component :is="isFavorite(item.key) ? Bookmark : BookmarkOutline" />
                    </NIcon>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </template>
      </nav>
    </NScrollbar>

    <div v-if="!collapsed" class="manage-sider__footer">
      <div class="footer-line">
        有更多功能建议请
        <NButton text type="primary" size="tiny" @click="go('manage-feedback')">
          反馈
        </NButton>
      </div>
      <div class="footer-line">
        <NButton text type="primary" size="tiny" @click="go('about')">
          关于本站
        </NButton>
      </div>
      <div class="footer-by">
        By Megghy
      </div>
    </div>
  </aside>
</template>

<style scoped>
  .manage-sider {
    height: 100%;
    border-right: 1px solid var(--n-border-color);
    background: var(--n-body-color);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: width 180ms var(--n-bezier, cubic-bezier(.4, 0, .2, 1));
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

  .sider-top-btn :deep(.n-button__content) {
    gap: 10px;
  }

  .manage-sider.collapsed .sider-top-btn :deep(.n-button__content) {
    gap: 0;
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
    transition: padding 180ms var(--n-bezier, cubic-bezier(.4, 0, .2, 1));
  }

  .manage-sider__nav-inner.collapsed {
    padding: 4px 6px 10px;
  }

  .nav-group {
    padding: 6px 0;
  }

  .manage-sider.collapsed .nav-group+.nav-group::before {
    content: "";
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
    color: var(--n-text-color-3);
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
    border: 1px solid var(--n-border-color);
    background: transparent;
    color: var(--n-text-color-3);
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
    color: var(--n-text-color-2);
  }

  .danmaku-tooltip__body a {
    color: var(--n-primary-color);
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
    color: var(--n-text-color);
    border: 1px solid transparent;
    background: transparent;
    transition: background-color 120ms ease, border-color 120ms ease;
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
    transition: opacity 120ms ease, background-color 120ms ease, border-color 120ms ease;
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
    color: var(--n-text-color-3);
    transition: color 120ms ease;
  }

  .nav-item__fav-icon.active {
    color: var(--n-warning-color);
  }

  .nav-item__fav.active .nav-item__fav-icon {
    color: rgb(245, 158, 11);
    filter: drop-shadow(0 0 6px rgba(245, 158, 11, 0.28));
  }

  .manage-sider__footer {
    border-top: 1px solid var(--n-border-color);
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
  }

  .footer-line {
    font-size: 12px;
    color: var(--n-text-color-3);
    text-align: center;
  }

  .footer-by {
    margin-top: 4px;
    font-size: 12px;
    text-align: center;
    color: var(--n-text-color-3);
  }
</style>
