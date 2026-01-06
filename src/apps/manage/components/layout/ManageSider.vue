<script setup lang="ts">
import type { AccountInfo } from '@/api/api-models'
import {
  BookCoins20Filled,
  CalendarClock24Filled,
  Info24Filled,
  Live24Filled,
  Lottery24Filled,
  PeopleQueue24Filled,
  Person48Filled,
  PersonFeedback24Filled,
  TabletSpeaker24Filled,
  VehicleShip24Filled,
  VideoAdd20Filled,
} from '@vicons/fluent'
import {
  AnalyticsSharp,
  Bookmark,
  BookmarkOutline,
  BrowsersOutline,
  Chatbox,
  Eye,
  MusicalNote,
} from '@vicons/ionicons5'
import { useStorage } from '@vueuse/core'
import {
  NAlert,
  NButton,
  NDivider,
  NFlex,
  NIcon,
  NLayoutSider,
  NMenu,
  NSpace,
  NText,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, h } from 'vue'
import { RouterLink } from 'vue-router'
import { useBiliAuth } from '@/store/useBiliAuth'
import { NavigateToNewTab, isDarkMode } from '@/shared/utils'

const props = defineProps<{
  accountInfo: AccountInfo
}>()

const message = useMessage()

const defaultCollapsed = window.innerWidth < 750
const collapsed = useStorage<boolean>('Settings.ManageSiderCollapsed', defaultCollapsed)
const siderWidth = 180
const siderCollapsedWidth = 64

const expandedKeys = useStorage<string[]>('Settings.MenuExpandedKeys', ['manage-danmaku'])

const favoriteMenuItems = useStorage<string[]>('Settings.FavoriteMenuItems', [])
const isFavorite = (key: string) => favoriteMenuItems.value?.includes(key)
function toggleFavorite(key: string) {
  const list = favoriteMenuItems.value ?? []
  const idx = list.indexOf(key)
  if (idx === -1) list.unshift(key)
  else list.splice(idx, 1)
  favoriteMenuItems.value = [...list]
}

function renderFavoriteExtra(key: string) {
  return () => {
    if (collapsed.value) return null
    return h(
      'span',
      { class: ['menu-fav', isFavorite(key) ? 'active' : ''] },
      [
        h(
          NTooltip,
          { placement: 'right' },
          {
            trigger: () =>
              h(
                NButton,
                {
                  text: true,
                  size: 'tiny',
                  circle: true,
                  onClick: (e: MouseEvent) => {
                    e.stopPropagation()
                    toggleFavorite(key)
                  },
                  style: 'padding: 0; height: 18px; width: 18px;',
                },
                {
                  icon: () =>
                    h(NIcon, {
                      component: isFavorite(key) ? Bookmark : BookmarkOutline,
                      size: 16,
                      color: isFavorite(key) ? '#f5c451' : undefined,
                    }),
                },
              ),
            default: () => (isFavorite(key) ? '取消收藏' : '收藏'),
          },
        ),
      ],
    )
  }
}

const isBiliVerified = computed(() => props.accountInfo?.isBiliVerified)

function gotoAuthPage() {
  if (!props.accountInfo?.biliUserAuthInfo) {
    message.error('你尚未进行 Bilibili 认证, 请前往面板进行认证和绑定')
    return
  }
  void useBiliAuth()
    .setCurrentAuth(props.accountInfo?.biliUserAuthInfo.token)
    .then(() => {
      NavigateToNewTab('/bili-user')
    })
}

const renderIcon = (icon: unknown) => () => h(NIcon, null, { default: () => h(icon as any) })

const menuOptions = computed(() => {
  const withFavoriteExtra = (item: any): any => {
    if (item?.children?.length) {
      return {
        ...item,
        children: item.children.map(withFavoriteExtra),
      }
    }
    return {
      ...item,
      extra: collapsed.value ? undefined : renderFavoriteExtra(item.key),
    }
  }

  const baseMenuItems = [
    {
      label: () => h(RouterLink, { to: { name: 'manage-history' } }, { default: () => '历史' }),
      key: 'manage-history',
      disabled: props.accountInfo?.isEmailVerified === false,
      icon: renderIcon(AnalyticsSharp),
      group: 'common',
    },
    {
      label: () => h(RouterLink, { to: { name: 'manage-live' } }, { default: () => '直播记录' }),
      key: 'manage-live',
      disabled: props.accountInfo?.isEmailVerified === false,
      icon: renderIcon(Live24Filled),
      group: 'common',
    },
    {
      label: () => h(RouterLink, { to: { name: 'manage-analyze' } }, { default: () => '直播数据' }),
      key: 'manage-analyze',
      disabled: props.accountInfo?.isEmailVerified === false,
      icon: renderIcon(Eye),
      group: 'common',
    },
    {
      label: () => h(RouterLink, { to: { name: 'org-index' } }, { default: () => '组织' }),
      key: 'org-index',
      disabled: props.accountInfo?.isEmailVerified === false,
      icon: renderIcon(PeopleQueue24Filled),
      group: 'common',
    },
    {
      label: () => h(RouterLink, { to: { name: 'manage-event' } }, { default: () => '舰长和SC' }),
      key: 'manage-event',
      disabled: props.accountInfo?.isEmailVerified === false,
      icon: renderIcon(VehicleShip24Filled),
      group: 'data',
    },
    {
      label: () => h(RouterLink, { to: { name: 'manage-point' } }, { default: () => '积分和礼物' }),
      key: 'manage-point',
      disabled: props.accountInfo?.isEmailVerified === false,
      icon: renderIcon(BookCoins20Filled),
      group: 'data',
    },
    {
      label: () => h(RouterLink, { to: { name: 'manage-schedule' } }, { default: () => '日程' }),
      key: 'manage-schedule',
      icon: renderIcon(CalendarClock24Filled),
      disabled: props.accountInfo?.isEmailVerified === false,
      group: 'tools',
    },
    {
      label: () => h(RouterLink, { to: { name: 'manage-songList' } }, { default: () => '歌单' }),
      key: 'manage-songList',
      icon: renderIcon(MusicalNote),
      disabled: props.accountInfo?.isEmailVerified === false,
      group: 'tools',
    },
    {
      label: () => h(RouterLink, { to: { name: 'manage-questionBox' } }, { default: () => '棉花糖 (提问箱' }),
      key: 'manage-questionBox',
      icon: renderIcon(Chatbox),
      disabled: props.accountInfo?.isEmailVerified === false,
      group: 'tools',
    },
    {
      label: () => h(RouterLink, { to: { name: 'manage-videoCollect' } }, { default: () => '视频征集' }),
      key: 'manage-videoCollect',
      icon: renderIcon(VideoAdd20Filled),
      disabled: props.accountInfo?.isEmailVerified === false,
      group: 'tools',
    },
    {
      label: () => h(RouterLink, { to: { name: 'manage-lottery' } }, { default: () => '动态抽奖' }),
      key: 'manage-lottery',
      icon: renderIcon(Lottery24Filled),
      group: 'tools',
    },
    {
      label: () => !isBiliVerified.value
        ? '弹幕机'
        : h(NTooltip, {}, {
          trigger: () => h(
            RouterLink,
            { to: { name: 'manage-danmuji' } },
            { default: () => '弹幕机' },
          ),
          default: () => '兼容 blivechat 样式 (其实就是直接用的 blivechat 组件',
        }),
      key: 'manage-danmuji',
      disabled: !isBiliVerified.value,
      icon: renderIcon(Lottery24Filled),
      group: 'danmaku',
    },
    {
      label: () => !isBiliVerified.value
        ? '点播'
        : h(
          NTooltip,
          {},
          {
            trigger: () => h(
              RouterLink,
              { to: { name: 'manage-liveRequest' } },
              { default: () => '点播' },
            ),
            default: () => '歌势之类用的, 可以用来点歌或者跳舞什么的',
          },
        ),
      key: 'manage-liveRequest',
      icon: renderIcon(MusicalNote),
      disabled: !isBiliVerified.value,
      group: 'danmaku',
    },
    {
      label: () => !isBiliVerified.value
        ? '抽奖'
        : h(
          RouterLink,
          { to: { name: 'manage-liveLottery' } },
          { default: () => '抽奖' },
        ),
      key: 'manage-liveLottery',
      icon: renderIcon(Lottery24Filled),
      disabled: !isBiliVerified.value,
      group: 'danmaku',
    },
    {
      label: () => !isBiliVerified.value
        ? '点歌'
        : h(
          NTooltip,
          {},
          {
            trigger: () => h(
              RouterLink,
              { to: { name: 'manage-musicRequest' } },
              { default: () => '点歌机' },
            ),
            default: () => '就是传统的点歌机, 发弹幕后播放指定的歌曲',
          },
        ),
      key: 'manage-musicRequest',
      icon: renderIcon(MusicalNote),
      disabled: !isBiliVerified.value,
      group: 'danmaku',
    },
    {
      label: () => !isBiliVerified.value
        ? '排队'
        : h(
          RouterLink,
          { to: { name: 'manage-liveQueue' } },
          { default: () => '排队' },
        ),
      key: 'manage-liveQueue',
      icon: renderIcon(PeopleQueue24Filled),
      disabled: !isBiliVerified.value,
      group: 'danmaku',
    },
    {
      label: () => !isBiliVerified.value
        ? '读弹幕'
        : h(
          RouterLink,
          { to: { name: 'manage-speech' } },
          { default: () => '读弹幕' },
        ),
      key: 'manage-speech',
      icon: renderIcon(TabletSpeaker24Filled),
      disabled: !isBiliVerified.value,
      group: 'danmaku',
    },
  ]

  const allMenuItems = baseMenuItems.map(withFavoriteExtra)
  const itemMap = new Map(allMenuItems.map(i => [i.key, i]))

  const favorites = (favoriteMenuItems.value ?? [])
    .map(k => itemMap.get(k))
    .filter(Boolean) as any[]

  const notFav = (i: any) => !isFavorite(i.key)
  const groups: any[] = []

  if (favorites.length > 0) {
    groups.push({
      type: 'group',
      key: 'group-favorites',
      label: '我的收藏',
      children: favorites,
    })
  }

  const commonItems = allMenuItems.filter(i => i.group === 'common' && notFav(i))
  if (commonItems.length > 0) {
    groups.push({
      type: 'group',
      key: 'group-common',
      label: '常用',
      children: commonItems,
    })
  }

  const dataItems = allMenuItems.filter(i => i.group === 'data' && notFav(i))
  if (dataItems.length > 0) {
    groups.push({
      type: 'group',
      key: 'group-data',
      label: '数据',
      children: dataItems,
    })
  }

  const toolsItems = allMenuItems.filter(i => i.group === 'tools' && notFav(i))
  if (toolsItems.length > 0) {
    groups.push({
      type: 'group',
      key: 'group-tools',
      label: '互动与工具',
      children: toolsItems,
    })
  }

  const danmakuItems = allMenuItems.filter(i => i.group === 'danmaku' && notFav(i))
  if (danmakuItems.length > 0) {
    groups.push({
      type: 'group',
      key: 'group-danmaku',
      label: () => h(
        NTooltip,
        {},
        {
          trigger: () => h(
            NText,
            () => [
              '弹幕相关',
              h(
                NTooltip,
                { style: 'padding: 0; margin-left: 4px;' },
                {
                  trigger: () => h(NIcon, { component: Info24Filled, size: 14 }),
                  default: () => h(
                    NAlert,
                    {
                      type: 'warning',
                      size: 'small',
                      title: '可用性警告',
                      style: 'max-width: 600px;',
                    },
                    () => h('div', {}, [
                      '    当浏览器在后台运行时, 定时器和 Websocket 连接将受到严格限制, 这会导致弹幕接收功能无法正常工作 (详见',
                      h(
                        NButton,
                        {
                          text: true,
                          tag: 'a',
                          href: 'https://developer.chrome.com/blog/background_tabs/',
                          target: '_blank',
                          type: 'info',
                        },
                        () => '此文章',
                      ),
                      '), 虽然本站已经针对此问题做出了处理, 一般情况下即使掉线了也会重连, 不过还是有可能会遗漏事件',
                      h('br'),
                      '为避免这种情况, 建议注册本站账后使用',
                      h(
                        NButton,
                        {
                          type: 'primary',
                          text: true,
                          size: 'small',
                          tag: 'a',
                          href: 'https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs',
                          target: '_blank',
                        },
                        () => 'VtsuruEventFetcher',
                      ),
                      ', 否则请在使用功能时尽量保持网页在前台运行, 同时关闭浏览器的 页面休眠/内存节省 功能',
                      h('br'),
                      'Chrome: ',
                      h(
                        NButton,
                        {
                          type: 'info',
                          text: true,
                          size: 'small',
                          tag: 'a',
                          href: 'https://support.google.com/chrome/answer/12929150?hl=zh-Hans#zippy=%2C%E5%BC%80%E5%90%AF%E6%88%96%E5%85%B3%E9%97%AD%E7%9C%81%E5%86%85%E5%AD%98%E6%A8%A1%E5%BC%8F%2C%E8%AE%A9%E7%89%B9%E5%AE%9A%E7%BD%91%E7%AB%99%E4%BF%9D%E6%8C%81%E6%B4%BB%E5%8A%A8%E7%8A%B6%E6%80%81',
                          target: '_blank',
                        },
                        () => '让特定网站保持活动状态',
                      ),
                      ', Edge: ',
                      h(
                        NButton,
                        {
                          type: 'info',
                          text: true,
                          size: 'small',
                          tag: 'a',
                          href: 'https://support.microsoft.com/zh-cn/topic/%E4%BA%86%E8%A7%A3-microsoft-edge-%E4%B8%AD%E7%9A%84%E6%80%A7%E8%83%BD%E5%8A%9F%E8%83%BD-7b36f363-2119-448a-8de6-375cfd88ab25',
                          target: '_blank',
                        },
                        () => '永远不想进入睡眠状态的网站',
                      ),
                    ]),
                  ),
                },
              ),
            ],
          ),
          default: () => (isBiliVerified.value
            ? '需要使用直播弹幕的功能'
            : '你尚未进行 Bilibili 认证, 请前往面板进行绑定'),
        },
      ),
      children: danmakuItems,
    })
  }

  return groups
})
</script>

<template>
  <NLayoutSider
    v-if="accountInfo?.isEmailVerified"
    v-model:collapsed="collapsed"
    bordered
    show-trigger
    collapse-mode="width"
    :collapsed-width="siderCollapsedWidth"
    :width="siderWidth"
    :native-scrollbar="false"
    :scrollbar-props="{ trigger: 'none', style: {} }"
    :class="{ 'sider-collapsed': collapsed }"
  >
    <NSpace vertical style="margin-top: 16px" align="center">
      <NSpace justify="center">
        <NButton type="info" style="width: 100%" @click="$router.push({ name: 'manage-index' })">
          <template #icon>
            <NIcon :component="BrowsersOutline" />
          </template>
          <template v-if="!collapsed">
            面板
          </template>
        </NButton>
        <NTooltip v-if="!collapsed">
          <template #trigger>
            <NButton @click="$router.push({ name: 'manage-feedback' })">
              <template #icon>
                <NIcon :component="PersonFeedback24Filled" />
              </template>
            </NButton>
          </template>
          反馈
        </NTooltip>
      </NSpace>
      <NButton v-if="accountInfo.biliUserAuthInfo" type="info" secondary @click="gotoAuthPage()">
        <template #icon>
          <NIcon :component="Person48Filled" />
        </template>
        <template v-if="!collapsed">
          认证用户主页
        </template>
      </NButton>
    </NSpace>

    <NMenu
      v-model:expanded-keys="expandedKeys"
      class="manage-sider-menu"
      style="margin-top: 12px"
      :disabled="accountInfo?.isEmailVerified !== true"
      :default-value="($route.meta.parent as string) ?? $route.name?.toString()"
      :default-expanded-keys="['group-common', 'group-data', 'group-tools', 'group-danmaku', 'group-favorites']"
      :collapsed="collapsed"
      :collapsed-width="siderCollapsedWidth"
      :collapsed-icon-size="22"
      :icon-size="16"
      :root-indent="10"
      :indent="12"
      :options="menuOptions"
    />

    <NSpace v-if="!collapsed" justify="center" align="center" vertical>
      <NText depth="3">
        有更多功能建议请
        <NButton text type="info" @click="$router.push({ name: 'manage-feedback' })">
          反馈
        </NButton>
      </NText>
      <NText depth="3">
        <NButton text type="info" @click="$router.push({ name: 'about' })">
          关于本站
        </NButton>
      </NText>
    </NSpace>
    <NDivider style="margin-bottom: 8px;" />
    <NFlex justify="center" align="center">
      <NText
        v-if="!collapsed"
        :style="`font-size: 12px; text-align: center;color: ${isDarkMode ? '#555' : '#c0c0c0'}`"
      >
        By Megghy
      </NText>
    </NFlex>
  </NLayoutSider>
</template>

<style scoped>
:deep(.manage-sider-menu .menu-fav) {
  opacity: 0;
  width: 0;
  margin-left: 0;
  overflow: hidden;
  transition: opacity 0.15s ease, width 0.15s ease, margin-left 0.15s ease;
  pointer-events: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

:deep(.n-menu-item) {
  height: 36px;
}

:deep(.manage-sider-menu .n-menu-item:hover .menu-fav),
:deep(.manage-sider-menu .menu-fav.active) {
  opacity: 1;
  width: 18px;
  margin-left: 6px;
  pointer-events: auto;
}

:deep(.manage-sider-menu .menu-fav .n-button) {
  padding: 0;
  height: 18px;
  width: 18px;
}

:deep(.sider-collapsed .manage-sider-menu .n-menu-item .n-menu-item-content) {
  display: flex;
  justify-content: center;
}

:deep(.n-menu-item) {
  margin-top: 3px;
}


.sider-collapsed :deep(.manage-sider-menu .menu-fav) {
  display: none !important;
}
</style>

