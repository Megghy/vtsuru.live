<!-- eslint-disable vue/component-name-in-template-casing -->
<script setup lang="ts">
import { NAvatar, NCard, NIcon, NLayout, NLayoutFooter, NLayoutHeader, NLayoutSider, NMenu, NSpace, NText, NButton, NEmpty, NResult } from 'naive-ui'
import { computed, h, onMounted, ref } from 'vue'
import { BookOutline as BookIcon, PersonOutline as PersonIcon, WineOutline as WineIcon } from '@vicons/ionicons5'
import { GetInfo, useUser } from '@/api/user'
import { useRoute } from 'vue-router'
import { UserInfo } from '@/api/api-models'
import { FETCH_API, USER_URL } from '@/data/constants'
import { useAccount } from '@/api/account'

const route = useRoute()
const uId = computed(() => {
  return Number(route.params.id)
})

const userInfo = ref<UserInfo>()
const biliUserInfo = ref()
const accountInfo = useAccount()

function renderIcon(icon: unknown) {
  return () => h(NIcon, null, { default: () => h(icon as any) })
}
const menuOptions = [
  {
    label: '歌单',
    key: 'hear-the-wind-sing',
    icon: renderIcon(BookIcon),
  },
  {
    label: '舞，舞，舞',
    key: 'dance-dance-dance',
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
  <NResult v-else-if="!userInfo" status="error" title="未找到指定 uId 的用户" description="或者是没有进行认证" />
  <NLayout v-else style="height: 100vh">
    <NLayoutHeader style="height: 50px; display: flex; justify-content: left; align-items: center; padding-left: 15px">
      <NSpace>
        <NText> VTSURU </NText>
        <span>
          {{ $route.meta.title }}
        </span>
      </NSpace>
      <NButton style="right: 0px; position: relative" type="primary"> 控制台 </NButton>
    </NLayoutHeader>
    <NLayout has-sider style="height: calc(100vh - 50px)">
      <NLayoutSider show-trigger collapse-mode="width" :collapsed-width="64" :width="180" :native-scrollbar="false">
        <Transition>
          <div v-if="biliUserInfo">
            <NSpace vertical justify="center" align="center">
              <NAvatar :src="biliUserInfo.face" :img-props="{ referrerpolicy: 'no-referrer' }" />
            </NSpace>
          </div>
        </Transition>
        <NMenu :collapsed-width="64" :collapsed-icon-size="22" :options="menuOptions" />
      </NLayoutSider>
      <NLayout style="height: 100%">
        <RouterView v-slot="{ Component }">
          <KeepAlive>
            <component :is="Component" />
          </KeepAlive>
        </RouterView>
      </NLayout>
    </NLayout>
  </NLayout>
</template>

<style lang="stylus" scoped>
.viewer-page-content{
    height: 100%;
    border-radius: 25px;
    box-shadow: inset 5px 5px 6px #8b8b8b17, inset -5px -5px 6px #8b8b8b17;
    padding: 15px;
    margin-right: 10px;
    box-sizing: border-box;
}
</style>
