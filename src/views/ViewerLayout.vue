<!-- eslint-disable vue/component-name-in-template-casing -->
<script setup lang="ts">
import { NAvatar, NCard, NIcon, NLayout, NLayoutFooter, NLayoutHeader, NLayoutSider, NMenu, NSpace, NText, NButton, NEmpty, NResult, NPageHeader, NSwitch, useOsTheme } from 'naive-ui'
import { computed, h, onMounted, ref } from 'vue'
import { BookOutline as BookIcon, PersonOutline as PersonIcon, WineOutline as WineIcon } from '@vicons/ionicons5'
import { GetInfo, useUser } from '@/api/user'
import { useRoute } from 'vue-router'
import { UserInfo } from '@/api/api-models'
import { FETCH_API } from '@/data/constants'
import { useAccount } from '@/api/account'

const route = useRoute()
const uId = computed(() => {
  return Number(route.params.id)
})
const theme = useOsTheme()

const userInfo = ref<UserInfo>()
const biliUserInfo = ref()
const accountInfo = useAccount()

function renderIcon(icon: unknown) {
  return () => h(NIcon, null, { default: () => h(icon as any) })
}
const menuOptions = [
  {
    label: '歌单',
    key: 'song-list',
    icon: renderIcon(BookIcon),
  },
  {
    label: '棉花糖(匿名提问',
    key: 'question-box',
    icon: renderIcon(BookIcon),
  },
]
async function RequestBiliUserData() {
  await fetch(FETCH_API + `https://account.bilibili.com/api/member/getCardByMid?mid=${uId.value}`)
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
  await RequestBiliUserData()
  userInfo.value = await useUser(uId.value)
})
</script>

<template>
  <NResult v-if="!uId" status="error" title="输入的uId无效" description="再检查检查" />
  <NResult v-else-if="false" status="error" title="未找到指定 uId 的用户" description="或者是没有进行认证" />
  <NLayout v-else style="height: 100vh">
    <NLayoutHeader style="height: 50px; padding: 5px 15px 5px 15px">
      <NPageHeader :subtitle="($route.meta.title as string) ?? ''">
        <template #extra>
          <NSpace>
            <NSwitch> </NSwitch>
            <template v-if="accountInfo">
              <NButton style="right: 0px; position: relative" type="primary" @click="$router.push({ name: 'manage-index' })"> 个人中心 </NButton>
            </template>
            <template v-else>
              <NButton style="right: 0px; position: relative" type="primary"> 注册 / 登陆 </NButton>
            </template>
          </NSpace>
        </template>
        <template #title>
          <NText style="font-size: 1.5rem"> VTSURU </NText>
        </template>
      </NPageHeader>
    </NLayoutHeader>
    <NLayout has-sider style="height: calc(100vh - 50px)">
      <NLayoutSider show-trigger collapse-mode="width" :collapsed-width="64" :width="180" :native-scrollbar="false">
        <Transition>
          <div v-if="biliUserInfo">
            <NSpace vertical justify="center" align="center">
              <NAvatar :src="biliUserInfo.face" :img-props="{ referrerpolicy: 'no-referrer' }" />
              <NText>
                {{ biliUserInfo.uname }}
              </NText>
            </NSpace>
          </div>
        </Transition>
        <NMenu :collapsed-width="64" :collapsed-icon-size="22" :options="menuOptions" />
      </NLayoutSider>
      <NLayout style="height: 100%">
        <div class="viewer-page-content">
          <RouterView v-slot="{ Component }">
            <KeepAlive>
              <component :is="Component" />
            </KeepAlive>
          </RouterView>
        </div>
      </NLayout>
    </NLayout>
  </NLayout>
</template>

<style lang="stylus" scoped>
.viewer-page-content{
    height: 100%;
    border-radius: 18px;
    box-shadow: inset 5px 5px 6px #8b8b8b17, inset -5px -5px 6px #8b8b8b17;
    padding: 15px;
    margin-right: 10px;
    box-sizing: border-box;
}
</style>
