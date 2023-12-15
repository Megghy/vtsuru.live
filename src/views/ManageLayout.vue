<script setup lang="ts">
import {
  NButton,
  NDivider,
  NIcon,
  NLayout,
  NLayoutContent,
  NLayoutHeader,
  NPageHeader,
  NSpace,
  NSpin,
  NSwitch,
  NText,
  NScrollbar,
  useMessage,
  NMenu,
  NLayoutSider,
  NAlert,
  NBackTop,
  NCountdown,
  NTooltip,
} from 'naive-ui'
import { h, onMounted, ref } from 'vue'
import { BrowsersOutline, Chatbox, Moon, MusicalNote, Sunny, AnalyticsSharp } from '@vicons/ionicons5'
import { CalendarClock24Filled, Chat24Filled, Info24Filled, Live24Filled, Lottery24Filled, PeopleQueue24Filled, PersonFeedback24Filled, VehicleShip24Filled, VideoAdd20Filled } from '@vicons/fluent'
import { isLoadingAccount, useAccount } from '@/api/account'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'
import { RouterLink, useRoute } from 'vue-router'
import { useElementSize, useStorage } from '@vueuse/core'
import { ACCOUNT_API_URL } from '@/data/constants'
import { QueryGetAPI } from '@/api/query'
import { FunctionTypes, ThemeType } from '@/api/api-models'
import { isDarkMode } from '@/Utils'
import DanmakuLayout from './manage/DanmakuLayout.vue'
import { computed } from '@vue/reactivity'

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

const canResendEmail = ref(false)

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
        { default: () => '历史' }
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
        { default: () => '舰长和SC' }
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
            name: 'manage-live',
          },
        },
        { default: () => '直播记录' }
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
        { default: () => '日程' }
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
        { default: () => '歌单' }
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
        { default: () => '棉花糖 (提问箱' }
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
        { default: () => '视频征集' }
      ),
    key: 'manage-videoCollect',
    icon: renderIcon(VideoAdd20Filled),
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
        { default: () => '动态抽奖' }
      ),
    key: 'manage-lottery',
    icon: renderIcon(Lottery24Filled),
    //disabled: accountInfo.value?.isEmailVerified == false,
  },
  {
    label: () =>
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
                    '当浏览器在后台运行时, 定时器和 Websocket 连接将受到严格限制, 这会导致弹幕接收功能无法正常工作 (详见',
                    h(
                      NButton,
                      {
                        text: true,
                        tag: 'a',
                        href: 'https://developer.chrome.com/blog/background_tabs/',
                        target: '_blank',
                        type: 'info',
                      },
                      () => '此文章'
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
                      () => 'VtsuruEventFetcher'
                    ),
                    ', 否则请在使用功能时尽量保持网页在前台运行',
                  ])
              ),
          }
        ),
      ]),
    key: 'manage-danmaku',
    icon: renderIcon(Chat24Filled),
    //disabled: accountInfo.value?.isEmailVerified == false,
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
            { default: () => '抽奖' }
          ),
        key: 'manage-liveLottery',
        icon: renderIcon(Lottery24Filled),
        //disabled: accountInfo.value?.isEmailVerified == false,
      },
      {
        label: () =>
          h(
            RouterLink,
            {
              to: {
                name: 'manage-songRequest',
              },
            },
            { default: () => '点歌' }
          ),
        key: 'manage-songRequest',
        icon: renderIcon(MusicalNote),
        //disabled: accountInfo.value?.isEmailVerified == false,
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
            { default: () => '排队' }
          ),
        key: 'manage-liveQueue',
        icon: renderIcon(PeopleQueue24Filled),
        //disabled: accountInfo.value?.isEmailVerified == false,
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

onMounted(() => {
  if (accountInfo.value?.isEmailVerified == false) {
    if ((accountInfo.value?.nextSendEmailTime ?? -1) <= 0) {
      canResendEmail.value = true
    }
  }
})
</script>

<template>
  <NLayout v-if="accountInfo">
    <NLayoutHeader bordered style="height: 50px; padding: 10px 15px 5px 15px">
      <NPageHeader>
        <template #title>
          <NText strong style="font-size: 1.4rem; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1)"> VTSURU CENTER </NText>
        </template>
        <template #extra>
          <NSpace align="center" justify="center">
            <NSwitch :default-value="!isDarkMode()" @update:value="(value: string & number & boolean) => themeType = value ? ThemeType.Light : ThemeType.Dark">
              <template #checked>
                <NIcon :component="Sunny" />
              </template>
              <template #unchecked>
                <NIcon :component="Moon" />
              </template>
            </NSwitch>
            <NButton size="small" style="right: 0px; position: relative" type="primary" @click="$router.push({ name: 'user-index', params: { id: accountInfo?.name } })"> 回到主页 </NButton>
          </NSpace>
        </template>
      </NPageHeader>
    </NLayoutHeader>
    <NScrollbar x-scrollable>
      <NLayout has-sider>
        <NLayoutSider ref="sider" bordered show-trigger collapse-mode="width" :default-collapsed="windowWidth < 750" :collapsed-width="64" :width="180" :native-scrollbar="false">
          <NSpace justify="center" style="margin-top: 16px">
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
        <NScrollbar style="height: calc(100vh - 50px)">
          <NLayout>
            <div style="box-sizing: border-box; padding: 20px; min-width: 300px">
              <RouterView v-if="accountInfo?.isEmailVerified" v-slot="{ Component, route }">
                <KeepAlive>
                  <DanmakuLayout v-if="route.meta.danmaku" :component="Component" />
                  <Suspense v-else>
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
                  <NButton size="small" type="info" :disabled="!canResendEmail" @click="resendEmail"> 重新发送验证邮件 </NButton>
                  <NCountdown v-if="!canResendEmail" :duration="(accountInfo?.nextSendEmailTime ?? 0) - Date.now()" @finish="canResendEmail = true" />
                </NAlert>
              </template>
              <NBackTop />
            </div>
          </NLayout>
        </NScrollbar>
      </NLayout>
    </NScrollbar>
  </NLayout>
  <template v-else>
    <NLayoutContent style="display: flex; justify-content: center; align-items: center; flex-direction: column; padding: 50px; height: 100%; box-sizing: border-box">
      <template v-if="!isLoadingAccount">
        <NSpace vertical justify="center" align="center">
          <NText> 请登录或注册后使用 </NText>
          <NButton tag="a" href="/"> 回到主页 </NButton>
        </NSpace>
        <NDivider />
        <RegisterAndLogin style="max-width: 500px; min-width: 350px" />
      </template>
      <template v-else>
        <NSpin :loading="isLoadingAccount"> 正在请求账户数据... </NSpin>
      </template>
    </NLayoutContent>
  </template>
</template>
