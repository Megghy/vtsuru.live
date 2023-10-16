<script setup lang="ts">
import {
  NAlert,
  NAvatar,
  NButton,
  NCard,
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
  NSpace,
  NSpin,
  NSwitch,
  NText,
  NTime,
  useMessage,
} from 'naive-ui'
import { h, onMounted, ref } from 'vue'
import { BrowsersOutline, Chatbox, Moon, MusicalNote, Sunny } from '@vicons/ionicons5'
import { Lottery24Filled } from '@vicons/fluent'
import { isLoadingAccount, useAccount } from '@/api/account'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'
import { RouterLink } from 'vue-router'
import { useElementSize, useStorage } from '@vueuse/core'
import { ACCOUNT_API_URL } from '@/data/constants'
import { QueryGetAPI } from '@/api/query'
import { ThemeType } from '@/api/api-models'
import { isDarkMode } from '@/Utils'

const accountInfo = useAccount()
const message = useMessage()

const windowWidth = window.innerWidth
const sider = ref()
const { width } = useElementSize(sider)
const themeType = useStorage('Settings.Theme', ThemeType.Auto)

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
            name: 'manage-songList',
          },
          disabled: !accountInfo.value?.isEmailVerified,
        },
        { default: () => '歌单' }
      ),
    key: 'manage-songList',
    icon: renderIcon(MusicalNote),
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
      console.error(err)
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
            <NButton size="small" style="right: 0px; position: relative" type="primary" @click="$router.push({ name: 'user-index', params: { id: accountInfo.id } })"> 回到主页 </NButton>
          </NSpace>
        </template>
      </NPageHeader>
    </NLayoutHeader>
    <NLayout has-sider style="height: calc(100vh - 50px)">
      <NLayoutSider ref="sider" bordered show-trigger collapse-mode="width" :default-collapsed="windowWidth < 750" :collapsed-width="64" :width="180" :native-scrollbar="false">
        <NSpace justify="center" style="margin-top: 16px">
          <NButton @click="$router.push({ name: 'manage-index' })" type="info" style="width: 100%">
            <template #icon>
              <NIcon :component="BrowsersOutline" />
            </template>
            <template v-if="width >= 180"> 面板 </template>
          </NButton>
        </NSpace>
        <NMenu
          style="margin-top: 12px"
          :disabled="accountInfo?.isEmailVerified != true"
          :default-value="$route.name?.toString()"
          :collapsed-width="64"
          :collapsed-icon-size="22"
          :options="menuOptions"
        />
        <NSpace justify="center">
          <NText depth="3" v-if="width > 150">
            有更多功能建议请
            <NButton text type="info"> 反馈 </NButton>
          </NText>
        </NSpace>
      </NLayoutSider>
      <NLayout style="height: 100%">
        <div style="box-sizing: border-box; padding: 20px">
          <RouterView v-slot="{ Component }" v-if="accountInfo?.isEmailVerified">
            <KeepAlive>
              <component :is="Component" />
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
        </div>
      </NLayout>
    </NLayout>
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
        <NSpin :loading="isLoadingAccount">
          正在请求账户数据...
        </NSpin>
      </template>
    </NLayoutContent>
  </template>
</template>
