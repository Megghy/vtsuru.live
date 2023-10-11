<!-- eslint-disable vue/component-name-in-template-casing -->
<script setup lang="ts">
import { NAvatar, NCard, NIcon, NLayout, NLayoutFooter, NLayoutHeader, NLayoutSider, NMenu, NSpace, NText, NButton, NEmpty, NResult, NPageHeader, NSwitch, useOsTheme, NModal } from 'naive-ui'
import { computed, h, onMounted, ref } from 'vue'
import { BookOutline as BookIcon, PersonOutline as PersonIcon, WineOutline as WineIcon } from '@vicons/ionicons5'
import { GetInfo, useUser, useUserWithUId } from '@/api/user'
import { RouterLink, useRoute } from 'vue-router'
import { UserInfo } from '@/api/api-models'
import { FETCH_API } from '@/data/constants'
import { useAccount } from '@/api/account'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'

const route = useRoute()
const id = computed(() => {
  return Number(route.params.id)
})
const theme = useOsTheme()

const userInfo = ref<UserInfo>()
const biliUserInfo = ref()
const accountInfo = useAccount()

const registerAndLoginModalVisiable = ref(false)

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
            name: 'user-index',
          },
        },
        { default: () => '主页' }
      ),
    key: 'user-index',
    icon: renderIcon(BookIcon),
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
    key: 'user-songList',
    icon: renderIcon(BookIcon),
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
    key: 'user-questionBox',
    icon: renderIcon(BookIcon),
  },
]
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
          <NSpace>
            <NSwitch> </NSwitch>
            <template v-if="accountInfo">
              <NButton style="right: 0px; position: relative" type="primary" @click="$router.push({ name: 'manage-index' })"> 个人中心 </NButton>
            </template>
            <template v-else>
              <NButton style="right: 0px; position: relative" type="primary" @click="registerAndLoginModalVisiable = true"> 注册 / 登陆 </NButton>
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
          <div v-if="biliUserInfo" style="margin-top: 15px;">
            <NSpace vertical justify="center" align="center">
              <NAvatar :src="biliUserInfo.face" :img-props="{ referrerpolicy: 'no-referrer' }" />
              <NText strong>
                {{ biliUserInfo.name }}
              </NText>
            </NSpace>
          </div>
        </Transition>
        <NMenu :default-value="$route.name?.toString()" :collapsed-width="64" :collapsed-icon-size="22" :options="menuOptions" />
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
  <NModal v-model:show="registerAndLoginModalVisiable" style="width: 500px; max-width: 90vw;">
    <RegisterAndLogin />
  </NModal>
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
