<script setup lang="ts">
import { isDarkMode } from '@/Utils'
import { OpenLiveInfo, ThemeType } from '@/api/api-models'
import DanmakuClient, { AuthInfo } from '@/data/DanmakuClient'
import { Lottery24Filled } from '@vicons/fluent'
import { Moon, MusicalNote, Sunny } from '@vicons/ionicons5'
import { useElementSize, useStorage } from '@vueuse/core'
import {
  NAvatar,
  NIcon,
  NLayout,
  NLayoutHeader,
  NLayoutSider,
  NMenu,
  NSpace,
  NText,
  NButton,
  NResult,
  NPageHeader,
  NSwitch,
  NModal,
  NEllipsis,
  MenuOption,
  NSpin,
  NLayoutContent,
  NLayoutFooter,
  NBackTop,
  NScrollbar,
  useMessage,
  NDivider,
  NTag,
} from 'naive-ui'
import { ref, onMounted, h } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()
const message = useMessage()
const themeType = useStorage('Settings.Theme', ThemeType.Auto)

const sider = ref()
const { width } = useElementSize(sider)

const authInfo = ref<AuthInfo>()
const client = ref<DanmakuClient>()

const menuOptions = [
  {
    label: () =>
      h(
        RouterLink,
        {
          to: {
            name: 'open-live-lottery',
            query: route.query,
          },
        },
        { default: () => '抽奖' }
      ),
    key: 'open-live-lottery',
    icon: renderIcon(Lottery24Filled),
  },
  {
    label: () =>
      h(
        RouterLink,
        {
          to: {
            name: 'open-live-song-request',
            query: route.query,
          },
        },
        { default: () => '点歌' }
      ),
    key: 'open-live-song-request',
    icon: renderIcon(MusicalNote),
  },
]

function renderIcon(icon: unknown) {
  return () => h(NIcon, null, { default: () => h(icon as any) })
}

onMounted(async () => {
  authInfo.value = route.query as unknown as AuthInfo
  if (authInfo.value?.Code) {
    client.value = new DanmakuClient(authInfo.value)
    await client.value.Start()
  } else {
    message.error('你不是从幻星平台访问此页面, 或未提供对应参数, 无法使用此功能')
  }
})
</script>

<template>
  <NLayoutContent v-if="!authInfo?.Code" style="height: 100vh">
    <NResult status="error" title="无效访问">
      <template #footer>
        请前往
        <NButton text type="primary" tag="a" href="https://play-live.bilibili.com/details/1698742711771" target="_blank"> 幻星平台 | VTsuru </NButton>
        并点击 获取 , 再点击 获取 H5 插件链接来获取可用链接
        <br />
        或者直接在那个页面用也可以, 虽然并不推荐
      </template>
    </NResult>
  </NLayoutContent>
  <NLayout v-else style="height: 100vh">
    <NLayoutHeader style="height: 45px; padding: 5px 15px 5px 15px" bordered>
      <NPageHeader :subtitle="($route.meta.title as string) ?? ''">
        <template #extra>
          <NSpace align="center">
            <NTag :type="client ? 'success' : 'warning'"> {{ client ? `已连接 | ${client.roomAuthInfo.value?.anchor_info.uname}` : '未连接' }} </NTag>
            <NSwitch :default-value="!isDarkMode()" @update:value="(value: string & number & boolean) => themeType = value ? ThemeType.Light : ThemeType.Dark">
              <template #checked>
                <NIcon :component="Sunny" />
              </template>
              <template #unchecked>
                <NIcon :component="Moon" />
              </template>
            </NSwitch>
          </NSpace>
        </template>
        <template #title>
          <NText strong style="font-size: 1.4rem; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); text-justify: auto"> VTSURU | 开放平台 </NText>
        </template>
      </NPageHeader>
    </NLayoutHeader>
    <NLayout has-sider style="height: calc(100vh - 45px - 30px)">
      <NLayoutSider bordered ref="sider" show-trigger default-collapsed collapse-mode="width" :collapsed-width="64" :width="180" :native-scrollbar="false" style="height: 100%">
        <Transition>
          <div v-if="client?.roomAuthInfo" style="margin-top: 8px">
            <NSpace vertical justify="center" align="center">
              <NAvatar
                :src="client?.roomAuthInfo.value?.anchor_info.uface"
                :img-props="{ referrerpolicy: 'no-referrer' }"
                round
                bordered
                :style="{ boxShadow: isDarkMode() ? 'rgb(195 192 192 / 35%) 0px 0px 8px' : '0 2px 3px rgba(0, 0, 0, 0.1)' }"
              />
              <NEllipsis v-if="width > 100" style="max-width: 100%">
                <NText strong>
                  {{ client?.roomAuthInfo.value?.anchor_info.uname }}
                </NText>
              </NEllipsis>
            </NSpace>
          </div>
        </Transition>
        <NMenu :default-value="$route.name?.toString()" :collapsed-width="64" :collapsed-icon-size="22" :options="menuOptions" />
        <NSpace justify="center">
          <NText depth="3" v-if="width > 150">
            有更多功能建议请
            <NButton text type="info" @click="$router.push({ name: 'about' })"> 反馈 </NButton>
          </NText>
        </NSpace>
      </NLayoutSider>
      <NLayoutContent yle="height: 100%" :native-scrollbar="false">
        <RouterView v-if="client?.roomAuthInfo" v-slot="{ Component }">
          <KeepAlive>
            <component :is="Component" :room-info="client?.roomAuthInfo" :client="client" :code="authInfo.Code" />
          </KeepAlive>
        </RouterView>
        <template v-else>
          <NSpin show />
        </template>
        <NBackTop />
      </NLayoutContent>
    </NLayout>
    <NLayoutFooter style="height: 30px" bordered>
      <NSpace justify="center" align="center" style="height: 100%">
        <NButton text tag="a" href="/" target="_blank" type="info" secondary> vtsuru.live </NButton>
      </NSpace>
    </NLayoutFooter>
  </NLayout>
</template>
