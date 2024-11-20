<script setup lang="ts">
import { NavigateToNewTab, isDarkMode } from '@/Utils'
import { isLoadingAccount, useAccount } from '@/api/account'
import { ThemeType } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'
import { ACCOUNT_API_URL } from '@/data/constants'
import { useAuthStore } from '@/store/useAuthStore'
import { useMusicRequestProvider } from '@/store/useMusicRequest'
import {
  BookCoins20Filled,
  CalendarClock24Filled,
  Chat24Filled,
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
import { AnalyticsSharp, BrowsersOutline, Chatbox, Moon, MusicalNote, Sunny } from '@vicons/ionicons5'
import { useElementSize, useStorage } from '@vueuse/core'
import {
  NAlert,
  NBackTop,
  NButton,
  NCountdown,
  NDivider,
  NIcon,
  NLayout,
  NLayoutContent,
  NLayoutFooter,
  NLayoutHeader,
  NLayoutSider,
  NMenu,
  NPageHeader,
  NPopconfirm,
  NScrollbar,
  NSpace,
  NSpin,
  NSwitch,
  NTag,
  NText,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, h, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import APlayer from 'vue3-aplayer'
import DanmakuLayout from './manage/DanmakuLayout.vue'

const accountInfo = useAccount()
const message = useMessage()
const route = useRoute()

const windowWidth = window.innerWidth
const sider = ref()
const { width } = useElementSize(sider)
const themeType = useStorage('Settings.Theme', ThemeType.Auto)
const type = computed(() => {
  if (route.meta.danmaku) {
    return 'danmaku'
  }
  return ''
})
const cookie = useStorage('JWT_Token', '')
const musicRquestStore = useMusicRequestProvider()

const canResendEmail = ref(false)

const aplayerHeight = computed(() => {
  return musicRquestStore.originMusics.length == 0 ? '0' : '80'
})
const aplayer = ref()
watch(aplayer, () => {
  musicRquestStore.aplayerRef = aplayer.value
})

function renderIcon(icon: unknown) {
  return () => h(NIcon, null, { default: () => h(icon as any) })
}

const menuOptions = [
  {
    label: () =>
      h(
        RouterLink,
        {
          to: {
            name: 'manage-history',
          },
        },
        { default: () => '历史' },
      ),
    key: 'manage-history',
    disabled: accountInfo.value?.isEmailVerified == false,
    icon: renderIcon(AnalyticsSharp),
  },
  {
    label: () =>
      h(
        RouterLink,
        {
          to: {
            name: 'manage-event',
          },
        },
        { default: () => '舰长和SC' },
      ),
    key: 'manage-event',
    disabled: accountInfo.value?.isEmailVerified == false,
    icon: renderIcon(VehicleShip24Filled),
  },
  {
    label: () =>
      h(
        RouterLink,
        {
          to: {
            name: 'manage-point',
          },
        },
        { default: () => '积分和礼物' },
      ),
    key: 'manage-point',
    disabled: accountInfo.value?.isEmailVerified == false,
    icon: renderIcon(BookCoins20Filled),
  },
  {
    label: () =>
      h(
        RouterLink,
        {
          to: {
            name: 'manage-live',
          },
        },
        { default: () => '直播记录' },
      ),
    key: 'manage-live',
    disabled: accountInfo.value?.isEmailVerified == false,
    icon: renderIcon(Live24Filled),
  },
  {
    label: () =>
      h(
        RouterLink,
        {
          to: {
            name: 'manage-schedule',
          },
        },
        { default: () => '日程' },
      ),
    key: 'manage-schedule',
    icon: renderIcon(CalendarClock24Filled),
    disabled: accountInfo.value?.isEmailVerified == false,
  },
  {
    label: () =>
      h(
        RouterLink,
        {
          to: {
            name: 'manage-songList',
          },
        },
        { default: () => '歌单' },
      ),
    key: 'manage-songList',
    icon: renderIcon(MusicalNote),
    disabled: accountInfo.value?.isEmailVerified == false,
  },
  {
    label: () =>
      h(
        RouterLink,
        {
          to: {
            name: 'manage-questionBox',
          },
        },
        { default: () => '棉花糖 (提问箱' },
      ),
    key: 'manage-questionBox',
    icon: renderIcon(Chatbox),
    disabled: accountInfo.value?.isEmailVerified == false,
  },
  {
    label: () =>
      h(
        RouterLink,
        {
          to: {
            name: 'manage-videoCollect',
          },
        },
        { default: () => '视频征集' },
      ),
    key: 'manage-videoCollect',
    icon: renderIcon(VideoAdd20Filled),
    disabled: accountInfo.value?.isEmailVerified == false,
    //disabled: accountInfo.value?.isEmailVerified == false,
  },
  {
    label: () =>
      h(
        RouterLink,
        {
          to: {
            name: 'manage-lottery',
          },
        },
        { default: () => '动态抽奖' },
      ),
    key: 'manage-lottery',
    icon: renderIcon(Lottery24Filled),
    //disabled: accountInfo.value?.isEmailVerified == false,
  },
  {
    label: () =>
      h(
        NTooltip,
        {},
        {
          trigger: () =>
            h(NText, () => [
              '弹幕相关',
              h(
                NTooltip,
                {
                  style: 'padding: 0;',
                },
                {
                  trigger: () => h(NIcon, { component: Info24Filled }),
                  default: () =>
                    h(
                      NAlert,
                      {
                        type: 'warning',
                        size: 'small',
                        title: '可用性警告',
                        style: 'max-width: 600px;',
                      },
                      () =>
                        h('div', {}, [
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
                              href: 'https://www.yuque.com/megghy/dez70g/vfvcyv3024xvaa1p',
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
            ]),
          default: () =>
            accountInfo.value?.isBiliVerified
              ? '需要使用直播弹幕的功能'
              : '你尚未进行 Bilibili 认证, 请前往面板进行绑定',
        },
      ),
    key: 'manage-danmaku',
    icon: renderIcon(Chat24Filled),
    disabled: accountInfo.value?.isEmailVerified == false,
    children: [
      {
        label: () =>
          h(
            RouterLink,
            {
              to: {
                name: 'manage-liveLottery',
              },
            },
            { default: () => '抽奖' },
          ),
        key: 'manage-liveLottery',
        icon: renderIcon(Lottery24Filled),
      },
      {
        label: () =>
          h(
            NTooltip,
            {},
            {
              trigger: () =>
                h(
                  RouterLink,
                  {
                    to: {
                      name: 'manage-liveRequest',
                    },
                  },
                  {
                    default: () => '点播',
                  },
                ),
              default: () => '歌势之类用的, 可以用来点歌或者跳舞什么的',
            },
          ),
        key: 'manage-liveRequest',
        icon: renderIcon(MusicalNote),
      },
      {
        label: () =>
          h(
            NTooltip,
            {},
            {
              trigger: () =>
                h(
                  RouterLink,
                  {
                    to: {
                      name: 'manage-musicRequest',
                    },
                  },
                  {
                    default: () => '点歌',
                  },
                ),
              default: () => '就是传统的点歌机, 发弹幕后播放指定的歌曲',
            },
          ),
        key: 'manage-musicRequest',
        icon: renderIcon(MusicalNote),
      },
      {
        label: () =>
          h(
            RouterLink,
            {
              to: {
                name: 'manage-liveQueue',
              },
            },
            { default: () => '排队' },
          ),
        key: 'manage-liveQueue',
        icon: renderIcon(PeopleQueue24Filled),
      },
      {
        label: () =>
          h(
            RouterLink,
            {
              to: {
                name: 'manage-speech',
              },
            },
            { default: () => '读弹幕' },
          ),
        key: 'manage-speech',
        icon: renderIcon(TabletSpeaker24Filled),
      },
    ],
  },
]

async function resendEmail() {
  await QueryGetAPI(ACCOUNT_API_URL + 'send-verify-email')
    .then((data) => {
      if (data.code == 200) {
        canResendEmail.value = false
        message.success('发送成功, 请检查你的邮箱. 如果没有收到, 请检查垃圾邮件')
        if (accountInfo.value && accountInfo.value.nextSendEmailTime) accountInfo.value.nextSendEmailTime += 1000 * 60
      } else {
        message.error('发送失败: ' + data.message)
      }
    })
    .catch((err) => {
      message.error('发送失败')
    })
}
function logout() {
  cookie.value = undefined
  window.location.reload()
}
function onNextMusic() {
  musicRquestStore.nextMusic()
}
function gotoAuthPage() {
  if (!accountInfo.value?.biliUserAuthInfo) {
    message.error('你尚未进行 Bilibili 认证, 请前往面板进行认证和绑定')
    return
  }
  useAuthStore()
    .setCurrentAuth(accountInfo.value?.biliUserAuthInfo.token)
    .then(() => {
      NavigateToNewTab('/bili-user')
    })
}

onMounted(() => {
  if (accountInfo.value?.isEmailVerified == false) {
    if ((accountInfo.value?.nextSendEmailTime ?? -1) <= 0) {
      canResendEmail.value = true
    }
  }
})
</script>

<template>
  <NLayout v-if="accountInfo.id" style="height: 100vh">
    <NLayoutHeader bordered style="height: 50px; padding: 10px 15px 5px 15px">
      <NPageHeader>
        <template #title>
          <NText strong style="font-size: 1.4rem; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1)"> VTSURU CENTER </NText>
        </template>
        <template #extra>
          <NSpace align="center" justify="center">
            <NSwitch
              :default-value="!isDarkMode"
              @update:value="
                (value: string & number & boolean) => (themeType = value ? ThemeType.Light : ThemeType.Dark)
              "
            >
              <template #checked>
                <NIcon :component="Sunny" />
              </template>
              <template #unchecked>
                <NIcon :component="Moon" />
              </template>
            </NSwitch>
            <NButton
              size="small"
              style="right: 0px; position: relative"
              type="primary"
              @click="$router.push({ name: 'user-index', params: { id: accountInfo?.name } })"
            >
              回到展示页
            </NButton>
          </NSpace>
        </template>
      </NPageHeader>
    </NLayoutHeader>
    <NLayout has-sider style="height: calc(100vh - 50px)">
      <NLayoutSider
        ref="sider"
        bordered
        show-trigger
        collapse-mode="width"
        :default-collapsed="windowWidth < 750"
        :collapsed-width="64"
        :width="180"
        :native-scrollbar="false"
        :scrollbar-props="{ trigger: 'none', style: {} }"
      >
        <NSpace vertical style="margin-top: 16px" align="center">
          <NSpace justify="center">
            <NButton @click="$router.push({ name: 'manage-index' })" type="info" style="width: 100%">
              <template #icon>
                <NIcon :component="BrowsersOutline" />
              </template>
              <template v-if="width >= 180"> 面板 </template>
            </NButton>
            <NTooltip v-if="width >= 180">
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
          <NButton v-if="accountInfo.biliUserAuthInfo" @click="gotoAuthPage()" type="info" secondary>
            <template #icon>
              <NIcon :component="Person48Filled" />
            </template>
            <template v-if="width >= 180"> 认证用户主页 </template>
          </NButton>
        </NSpace>
        <NMenu
          style="margin-top: 12px"
          :disabled="accountInfo?.isEmailVerified != true"
          :default-value="($route.meta.parent as string) ?? $route.name?.toString()"
          :collapsed-width="64"
          :collapsed-icon-size="22"
          :options="menuOptions"
        />
        <NSpace v-if="width > 150" justify="center" align="center" vertical>
          <NText depth="3">
            有更多功能建议请
            <NButton text type="info" @click="$router.push({ name: 'manage-feedback' })"> 反馈 </NButton>
          </NText>
          <NText depth="3">
            <NButton text type="info" @click="$router.push({ name: 'about' })"> 关于本站 </NButton>
          </NText>
        </NSpace>
      </NLayoutSider>
      <NLayout>
        <NScrollbar :style="`height: calc(100vh - 50px - ${aplayerHeight}px)`">
          <NLayoutContent style="box-sizing: border-box; padding: 20px; min-width: 300px; height: 100%">
            <RouterView v-if="accountInfo?.isEmailVerified" v-slot="{ Component, route }">
              <KeepAlive>
                <Suspense>
                  <component :is="Component" />
                  <template #fallback>
                    <NSpin show />
                  </template>
                </Suspense>
              </KeepAlive>
            </RouterView>
            <template v-else>
              <NAlert type="info">
                请进行邮箱验证
                <br /><br />
                <NSpace>
                  <NButton size="small" type="info" :disabled="!canResendEmail" @click="resendEmail">
                    重新发送验证邮件
                  </NButton>
                  <NCountdown
                    v-if="!canResendEmail"
                    :duration="(accountInfo?.nextSendEmailTime ?? 0) - Date.now()"
                    @finish="canResendEmail = true"
                  />

                  <NPopconfirm @positive-click="logout" size="small">
                    <template #trigger>
                      <NButton type="error"> 登出 </NButton>
                    </template>
                    确定登出?
                  </NPopconfirm>
                </NSpace>
              </NAlert>
            </template>
            <NBackTop />
          </NLayoutContent>
        </NScrollbar>
        <NLayoutFooter :style="`height: ${aplayerHeight}px;overflow: auto`">
          <div style="display: flex; align-items: center; margin: 0 10px 0 10px">
            <APlayer
              v-if="musicRquestStore.aplayerMusics.length > 0"
              ref="aplayer"
              :list="musicRquestStore.aplayerMusics"
              v-model:music="musicRquestStore.currentMusic"
              v-model:volume="musicRquestStore.settings.volume"
              v-model:shuffle="musicRquestStore.settings.shuffle"
              v-model:repeat="musicRquestStore.settings.repeat"
              :listMaxHeight="'200'"
              mutex
              listFolded
              @ended="musicRquestStore.onMusicEnd"
              @play="musicRquestStore.onMusicPlay"
              style="flex: 1; min-width: 400px"
            />
            <NSpace vertical>
              <NTag :bordered="false" type="info" size="small">
                队列: {{ musicRquestStore.waitingMusics.length }}
              </NTag>
              <NButton size="small" type="info" @click="onNextMusic"> 下一首 </NButton>
            </NSpace>
          </div>
        </NLayoutFooter>
      </NLayout>
    </NLayout>
  </NLayout>
  <template v-else>
    <NLayoutContent
      style="
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
        padding: 50px;
        height: 100%;
        box-sizing: border-box;
      "
    >
      <template v-if="!isLoadingAccount">
        <NSpace vertical justify="center" align="center">
          <NText> 请登录或注册后使用 </NText>
          <NButton tag="a" href="/"> 回到主页 </NButton>
        </NSpace>
        <NDivider />
        <RegisterAndLogin style="max-width: 500px; min-width: 350px" />
      </template>
      <template v-else>
        <NSpin :loading="isLoadingAccount" style="overflow: hidden"> 正在请求账户数据... </NSpin>
      </template>
    </NLayoutContent>
  </template>
</template>
