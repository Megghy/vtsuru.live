<!-- eslint-disable vue/component-name-in-template-casing -->
<script setup lang="ts">
import { NAvatar, NIcon, NLayout, NLayoutHeader, NLayoutSider, NMenu, NSpace, NText, NButton, NResult, NPageHeader, NSwitch, NModal, NEllipsis, MenuOption, NSpin } from 'naive-ui'
import { computed, h, onMounted, ref } from 'vue'
import { BookOutline as BookIcon, Chatbox, Home, Moon, MusicalNote, PersonOutline as PersonIcon, Sunny, WineOutline as WineIcon } from '@vicons/ionicons5'
import { GetInfo, useUser, useUserWithUId } from '@/api/user'
import { RouterLink, useRoute } from 'vue-router'
import { FunctionTypes, ThemeType, UserInfo } from '@/api/api-models'
import { FETCH_API } from '@/data/constants'
import { useAccount } from '@/api/account'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'
import { useElementSize, useStorage } from '@vueuse/core'
import { isDarkMode } from '@/Utils'
import { CalendarClock24Filled } from '@vicons/fluent'

const route = useRoute()
const id = computed(() => {
  return route.params.id
})
const themeType = useStorage('Settings.Theme', ThemeType.Auto)

const userInfo = ref<UserInfo>()
const biliUserInfo = ref()
const accountInfo = useAccount()

const registerAndLoginModalVisiable = ref(false)
const sider = ref()
const { width } = useElementSize(sider)

function renderIcon(icon: unknown) {
  return () => h(NIcon, null, { default: () => h(icon as any) })
}
const menuOptions = ref<MenuOption[]>()
async function RequestBiliUserData() {
  await fetch(FETCH_API + `https://account.bilibili.com/api/member/getCardByMid?mid=${userInfo.value?.biliId}`)
    .then(async (respone) => {
      let data = await respone.json()
      if (data.code == 0) {
        biliUserInfo.value = data.card
      } else {
        throw new Error('Bili User API Error: ' + data.message)
      }
    })
    .catch((err) => {
      console.error(err)
    })
}

onMounted(async () => {
  userInfo.value = await useUser()
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
          { default: () => '主页' }
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
          { default: () => '歌单' }
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
          { default: () => '日程' }
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
          { default: () => '棉花糖 (提问箱' }
        ),
      show: (userInfo.value?.extra?.enableFunctions.indexOf(FunctionTypes.QuestionBox) ?? -1) > -1,
      key: 'user-questionBox',
      icon: renderIcon(Chatbox),
    },
  ]
  await RequestBiliUserData()
})
</script>

<template>
  <NResult v-if="!id" status="error" title="输入的uId无效" description="再检查检查" />
  <NResult v-else-if="false" status="error" title="未找到指定 uId 的用户" description="或者是没有进行认证" />
  <NLayout v-else style="height: 100vh">
    <NLayoutHeader style="height: 50px; padding: 5px 15px 5px 15px">
      <NPageHeader :subtitle="($route.meta.title as string) ?? ''">
        <template #extra>
          <NSpace align="center">
            <NSwitch :default-value="!isDarkMode()" @update:value="(value: string & number & boolean) => themeType = value ? ThemeType.Light : ThemeType.Dark">
              <template #checked>
                <NIcon :component="Sunny" />
              </template>
              <template #unchecked>
                <NIcon :component="Moon" />
              </template>
            </NSwitch>
            <template v-if="accountInfo">
              <NButton style="right: 0px; position: relative" type="primary" @click="$router.push({ name: 'manage-index' })"> 个人中心 </NButton>
            </template>
            <template v-else>
              <NButton style="right: 0px; position: relative" type="primary" @click="registerAndLoginModalVisiable = true"> 注册 / 登陆 </NButton>
            </template>
          </NSpace>
        </template>
        <template #title>
          <NText strong style="font-size: 1.5rem; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1)"> VTSURU </NText>
        </template>
      </NPageHeader>
    </NLayoutHeader>
    <NLayout has-sider style="height: calc(100vh - 50px)">
      <NLayoutSider ref="sider" show-trigger default-collapsed collapse-mode="width" :collapsed-width="64" :width="180" :native-scrollbar="false">
        <Transition>
          <div v-if="biliUserInfo" style="margin-top: 8px">
            <NSpace vertical justify="center" align="center">
              <NAvatar :src="biliUserInfo.face" :img-props="{ referrerpolicy: 'no-referrer' }" round bordered style="box-shadow: 0 2px 3px rgba(0, 0, 0, 0.1)" />
              <NEllipsis v-if="width > 100" style="max-width: 100%">
                <NText strong>
                  {{ biliUserInfo.name }}
                </NText>
              </NEllipsis>
            </NSpace>
          </div>
        </Transition>
        <NMenu :default-value="$route.name?.toString()" :collapsed-width="64" :collapsed-icon-size="22" :options="menuOptions" />
      </NLayoutSider>
      <NLayout style="height: 100%">
        <div
          class="viewer-page-content"
          :style="`box-shadow:${isDarkMode() ? 'rgb(28 28 28 / 9%) 5px 5px 6px inset, rgba(139, 139, 139, 0.09) -5px -5px 6px inset' : 'inset 5px 5px 6px #8b8b8b17, inset -5px -5px 6px #8b8b8b17;'}`"
        >
          <RouterView v-if="userInfo" v-slot="{ Component }">
            <KeepAlive>
              <component :is="Component" :bili-info="biliUserInfo" :user-info="userInfo" />
            </KeepAlive>
          </RouterView>
          <template v-else>
            <NSpin show />
          </template>
        </div>
      </NLayout>
    </NLayout>
  </NLayout>
  <NModal v-model:show="registerAndLoginModalVisiable" style="width: 500px; max-width: 90vw">
    <RegisterAndLogin />
  </NModal>
</template>

<style lang="stylus" scoped>
.viewer-page-content{
    height: 100%;
    border-radius: 18px;
    padding: 15px;
    margin-right: 10px;
    box-sizing: border-box;
}
</style>
