<script setup lang="ts">
import { NAvatar, NButton, NCard, NDivider, NIcon, NLayout, NLayoutFooter, NLayoutHeader, NLayoutSider, NMenu, NSpace, NText } from 'naive-ui'
import { h } from 'vue'
import { BookOutline } from '@vicons/ionicons5'
import { useAccount } from '@/api/account'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'
import { RouterLink } from 'vue-router'

const accountInfo = useAccount()

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
        },
        { default: () => '歌单' }
      ),
    key: 'manage-songList',
    icon: renderIcon(BookOutline),
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
    icon: renderIcon(BookOutline),
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
    icon: renderIcon(BookOutline),
  },
]
</script>

<template>
  <NLayout v-if="accountInfo">
    <NLayoutHeader bordered style="height: 50px"> Header Header Header </NLayoutHeader>
    <NLayout has-sider style="height: calc(100vh - 50px)">
      <NLayoutSider bordered show-trigger collapse-mode="width" :collapsed-width="64" :width="180" :native-scrollbar="false" style="max-height: 320px">
        <NButton>
          <RouterLink :to="{ name: 'manage-index' }"> 个人中心 </RouterLink>
        </NButton>
        <NMenu :default-value="$route.name?.toString()" :collapsed-width="64" :collapsed-icon-size="22" :options="menuOptions" />
      </NLayoutSider>
      <NLayout style="height: 100%">
        <div style="box-sizing: border-box; padding: 20px">
          <RouterView v-slot="{ Component }">
            <KeepAlive>
              <component :is="Component" />
            </KeepAlive>
          </RouterView>
        </div>
      </NLayout>
    </NLayout>
  </NLayout>
  <template v-else>
    <div style="display: flex; justify-content: center; align-items: center; flex-direction: column; padding: 50px; height: 100%; box-sizing: border-box">
      <NText> 请登录或注册后使用 </NText>
      <NButton tag="a" href="/"> 回到主页 </NButton>
      <NDivider />
      <RegisterAndLogin style="max-width: 500px; min-width: 350px" />
    </div>
  </template>
</template>
