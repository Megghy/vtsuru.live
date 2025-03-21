<!-- eslint-disable vue/component-name-in-template-casing -->
<script setup lang="ts">
import { NavigateToNewTab, isDarkMode } from '@/Utils'
import { useAccount } from '@/api/account'
import { FunctionTypes, ThemeType, UserInfo } from '@/api/api-models'
import { useUser } from '@/api/user'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'
import { FETCH_API } from '@/data/constants'
import { useAuthStore } from '@/store/useAuthStore'
import {
  BookCoins20Filled,
  CalendarClock24Filled,
  Person48Filled,
  VideoAdd20Filled,
  WindowWrench20Filled,
} from '@vicons/fluent'
import { Chatbox, Home, Moon, MusicalNote, Sunny } from '@vicons/ionicons5'
import { useElementSize, useStorage } from '@vueuse/core'
import {
  MenuOption,
  NAvatar,
  NBackTop,
  NButton,
  NEllipsis,
  NIcon,
  NLayout,
  NLayoutContent,
  NLayoutHeader,
  NLayoutSider,
  NMenu,
  NModal,
  NPageHeader,
  NResult,
  NSpace,
  NSpin,
  NSwitch,
  NText,
  useMessage,
} from 'naive-ui'
import { computed, h, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()
const id = computed(() => {
  return route.params.id
})
const themeType = useStorage('Settings.Theme', ThemeType.Auto)

const userInfo = ref<UserInfo>()
const biliUserInfo = ref()
const accountInfo = useAccount()
const useAuth = useAuthStore()
const message = useMessage()

const notfount = ref(false)

const registerAndLoginModalVisiable = ref(false)
const sider = ref()
const { width } = useElementSize(sider)
const windowWidth = window.innerWidth

function renderIcon(icon: unknown) {
  return () => h(NIcon, null, { default: () => h(icon as any) })
}
const menuOptions = ref<MenuOption[]>()
async function RequestBiliUserData() {
  await fetch(FETCH_API + `https://workers.vrp.moe/api/bilibili/user-info/${userInfo.value?.biliId}`).then(
    async (respone) => {
      const data = await respone.json()
      if (data.code == 0) {
        biliUserInfo.value = data.card
      } else {
        throw new Error('Bili User API Error: ' + data.message)
      }
    },
  )
}
function gotoAuthPage() {
  if (!accountInfo.value?.biliUserAuthInfo) {
    message.error('你尚未进行 Bilibili 认证, 请前往面板进行认证和绑定')
    return
  }
  /*useAuthStore()
    .setCurrentAuth(accountInfo.value?.biliUserAuthInfo.token)
    .then(() => {
      NavigateToNewTab('/bili-user')
    })*/
  NavigateToNewTab('/bili-user')
}
onMounted(async () => {
  userInfo.value = await useUser(id.value?.toString())
  if (!userInfo.value) {
    notfount.value = true
  }

  menuOptions.value = [
    {
      label: () =>
        h(
          RouterLink,
          {
            to: {
              name: 'user-index',
            },
          },
          { default: () => '主页' },
        ),
      key: 'user-index',
      icon: renderIcon(Home),
    },
    {
      label: () =>
        h(
          RouterLink,
          {
            to: {
              name: 'user-songList',
            },
          },
          { default: () => '歌单' },
        ),
      show: (userInfo.value?.extra?.enableFunctions.indexOf(FunctionTypes.SongList) ?? -1) > -1,
      key: 'user-songList',
      icon: renderIcon(MusicalNote),
    },
    {
      label: () =>
        h(
          RouterLink,
          {
            to: {
              name: 'user-schedule',
            },
          },
          { default: () => '日程' },
        ),
      show: (userInfo.value?.extra?.enableFunctions.indexOf(FunctionTypes.Schedule) ?? -1) > -1,
      key: 'user-schedule',
      icon: renderIcon(CalendarClock24Filled),
    },
    {
      label: () =>
        h(
          RouterLink,
          {
            to: {
              name: 'user-questionBox',
            },
          },
          { default: () => '棉花糖 (提问箱' },
        ),
      show: (userInfo.value?.extra?.enableFunctions.indexOf(FunctionTypes.QuestionBox) ?? -1) > -1,
      key: 'user-questionBox',
      icon: renderIcon(Chatbox),
    },
    {
      label: () =>
        h(
          RouterLink,
          {
            to: {
              name: 'user-video-collect',
            },
          },
          { default: () => '视频征集' },
        ),
      show: (userInfo.value?.extra?.enableFunctions.indexOf(FunctionTypes.VideoCollect) ?? -1) > -1,
      key: 'user-video-collect',
      icon: renderIcon(VideoAdd20Filled),
    },
    {
      label: () =>
        h(
          RouterLink,
          {
            to: {
              name: 'user-goods',
            },
          },
          { default: () => '积分' },
        ),
      show: (userInfo.value?.extra?.enableFunctions.indexOf(FunctionTypes.Point) ?? -1) > -1,
      key: 'user-goods',
      icon: renderIcon(BookCoins20Filled),
    },
  ]
  await RequestBiliUserData()
})
</script>

<template>
  <NLayoutContent v-if="!id" style="height: 100vh">
    <NResult status="error" title="输入的uId无效" description="再检查检查" />
  </NLayoutContent>
  <NLayoutContent v-else-if="notfount" style="height: 100vh">
    <NResult status="error" title="未找到指定 uId 的用户" description="或者是没有进行认证" />
  </NLayoutContent>
  <NLayout v-else style="height: 100vh">
    <NLayoutHeader style="height: 50px; padding: 5px 15px 5px 15px">
      <NPageHeader :subtitle="($route.meta.title as string) ?? ''" style="margin-top: 6px">
        <template #extra>
          <NSpace align="center">
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
            <template v-if="accountInfo.id">
              <NSpace>
                <NButton
                  v-if="useAuth.isAuthed || accountInfo.biliUserAuthInfo"
                  style="right: 0px; position: relative"
                  type="primary"
                  tag="a"
                  href="/bili-user"
                  target="_blank"
                  size="small"
                  secondary
                >
                  <template #icon>
                    <NIcon :component="Person48Filled" />
                  </template>
                  <span v-if="windowWidth >= 768"> 认证用户中心 </span>
                </NButton>
                <NButton
                  style="right: 0px; position: relative"
                  type="primary"
                  @click="$router.push({ name: 'manage-index' })"
                  size="small"
                >
                  <template #icon>
                    <NIcon :component="WindowWrench20Filled" />
                  </template>
                  <span v-if="windowWidth >= 768"> 主播后台 </span>
                </NButton>
              </NSpace>
            </template>
            <template v-else>
              <NButton
                style="right: 0px; position: relative"
                type="primary"
                @click="registerAndLoginModalVisiable = true"
              >
                注册 / 登陆
              </NButton>
            </template>
          </NSpace>
        </template>
        <template #title>
          <NButton text tag="a" @click="$router.push({ name: 'index' })">
            <NText strong style="font-size: 1.5rem; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1)"> VTSURU </NText>
          </NButton>
        </template>
      </NPageHeader>
    </NLayoutHeader>
    <NLayout has-sider style="height: calc(100vh - 50px)">
      <NLayoutSider
        ref="sider"
        show-trigger
        default-collapsed
        collapse-mode="width"
        :collapsed-width="64"
        :width="180"
        :native-scrollbar="false"
        style="height: 100%"
      >
        <Transition>
          <div v-if="accountInfo.streamerInfo" style="margin-top: 8px">
            <NSpace vertical justify="center" align="center">
              <NAvatar
                :src="accountInfo.streamerInfo.faceUrl"
                :img-props="{ referrerpolicy: 'no-referrer' }"
                round
                bordered
                :style="{
                  boxShadow: isDarkMode ? 'rgb(195 192 192 / 35%) 0px 0px 8px' : '0 2px 3px rgba(0, 0, 0, 0.1)',
                }"
              />
              <NEllipsis v-if="width > 100" style="max-width: 100%">
                <NText strong>
                  {{ accountInfo.streamerInfo.name }}
                </NText>
              </NEllipsis>
            </NSpace>
          </div>
        </Transition>
        <NMenu
          :default-value="$route.name?.toString()"
          :collapsed-width="64"
          :collapsed-icon-size="22"
          :options="menuOptions"
        />
        <NSpace v-if="width > 150" justify="center" align="center" vertical>
          <NText depth="3">
            有更多功能建议请
            <NButton text type="info" tag="a" href="/feedback" target="_blank"> 反馈 </NButton>
          </NText>
          <NText depth="3">
            <NButton text type="info" tag="a" href="/about" target="_blank"> 关于本站 </NButton>
          </NText>
        </NSpace>
      </NLayoutSider>
      <NLayout style="height: 100%">
        <div
          class="viewer-page-content"
          :style="`box-shadow:${isDarkMode ? 'rgb(28 28 28 / 9%) 5px 5px 6px inset, rgba(139, 139, 139, 0.09) -5px -5px 6px inset' : 'inset 5px 5px 6px #8b8b8b17, inset -5px -5px 6px #8b8b8b17;'}`"
        >
          <RouterView v-if="userInfo" v-slot="{ Component }">
            <KeepAlive>
              <component :is="Component" :bili-info="biliUserInfo" :user-info="userInfo" />
            </KeepAlive>
          </RouterView>
          <template v-else>
            <NSpin show />
          </template>
          <NBackTop />
        </div>
      </NLayout>
    </NLayout>
  </NLayout>
  <NModal v-model:show="registerAndLoginModalVisiable" style="width: 500px; max-width: 90vw">
    <div>
      <RegisterAndLogin />
    </div>
  </NModal>
</template>

<style lang="stylus" scoped>
.viewer-page-content{
    height: 100%;
    border-radius: 18px;
    padding: 15px;
    margin-right: 10px;
    box-sizing: border-box;
    overflow-y: auto;
}
</style>
