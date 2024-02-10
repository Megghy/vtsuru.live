<script setup lang="ts">
import {
  NButton,
  NCard,
  NDataTable,
  NListItem,
  NTabPane,
  NTabs,
  NLayout,
  NLayoutContent,
  NText,
  useMessage,
  NLayoutHeader,
  NFlex,
  NDescriptions,
  NDescriptionsItem,
  NResult,
  NSpin,
  NDivider,
  NTag,
  NList,
} from 'naive-ui'
import { computed, h, onMounted, ref } from 'vue'
import { useAuthStore } from '@/store/useAuthStore'
import { UserInfo } from '@/api/api-models'
import { POINT_API_URL } from '@/data/constants'
import PointUserHistoryView from './PointUserHistoryView.vue'
import PointUserSettings from './PointUserSettings.vue'
import { useRouteHash } from '@vueuse/router'
import PointOrderView from './PointOrderView.vue'
import { useRoute } from 'vue-router'

const useAuth = useAuthStore()
const message = useMessage()
const realHash = useRouteHash('points', {
  mode: 'replace',
})
const hash = computed({
  get() {
    return realHash.value?.startsWith('#') ? realHash.value.slice(1) : realHash.value
  },
  set(val) {
    realHash.value = '#' + val
  },
})

const biliAuth = computed(() => useAuth.biliAuth)
const isLoading = ref(false)
const points = ref<{ owner: UserInfo; points: number }[]>([])

const pointColumn = [
  {
    title: '所属用户',
    key: 'owner.name',
  },
  {
    title: '积分',
    key: 'points',
  },
  {
    title: '详情',
    key: 'action',
    render: (row: { owner: UserInfo; points: number }) => {
      return h(NButton, {
        onClick: () => {},
      })
    },
  },
]

async function getAllPoints() {
  isLoading.value = true
  try {
    const data = await useAuth.QueryBiliAuthGetAPI<{ owner: UserInfo; points: number }[]>(
      POINT_API_URL + 'user/get-all-point',
    )
    if (data.code == 200) {
      console.log('[point] 已获取积分')
      return data.data
    }
  } catch (err) {
    console.error(err)
    message.error('获取积分失败: ' + err)
  } finally {
    isLoading.value = false
  }
  return []
}
function switchAuth(token: string) {
  if (token == useAuth.biliToken) {
    message.info('当前正在使用该账号')
    return
  }
  useAuth.setCurrentAuth(token)
  message.success('已选择账号')
}

onMounted(async () => {
  const route = useRoute()
  if (route.query.auth) {
    useAuth.biliToken = route.query.auth as string
  }
  if (biliAuth.value?.id < 0) {
    isLoading.value = true
    await useAuth.getAuthInfo()
    isLoading.value = false
  }
  if (biliAuth.value.id >= 0) {
    points.value = await getAllPoints()
  }
})
</script>

<template>
  <NLayout>
    <NSpin v-if="!biliAuth.id && useAuth.isLoading" :show="useAuth.isLoading" />
    <NLayoutContent v-else-if="!useAuth.biliToken && useAuth.biliTokens.length > 0" style="height: 100vh">
      <NCard title="选择B站账号" embedded>
        <NList clickable bordered>
          <NListItem v-for="item in useAuth.biliTokens" :key="item.token" @click="switchAuth(item.token)">
            <NFlex align="center"> {{ item.name }} - {{ item.uId }} </NFlex>
          </NListItem>
        </NList>
      </NCard>
    </NLayoutContent>
    <NLayoutContent v-else-if="!biliAuth.id" style="height: 100vh">
      <NResult status="error" title="你还未进行过B站账户验证" description="请先进行认证" style="padding-top: 64px">
        <template #footer>
          <NButton type="primary" @click="$router.push({ name: 'bili-auth' })">去认证</NButton>
        </template>
      </NResult>
    </NLayoutContent>
    <template v-else>
      <NLayoutHeader style="padding: 10px" bordered>
        <NFlex justify="center">
          <NText style="font-size: 24px"> 认证用户个人中心 </NText>
        </NFlex>
      </NLayoutHeader>
      <NLayoutContent content-style="padding: 24px;">
        <NFlex align="center" justify="center">
          <div style="max-width: 95vw; width: 900px">
            <NCard title="我的信息">
              <NDescriptions label-placement="left" bordered size="small">
                <NDescriptionsItem label="OpenId">
                  {{ biliAuth.openId }}
                </NDescriptionsItem>
                <NDescriptionsItem label="UserId">
                  {{ biliAuth.userId }}
                </NDescriptionsItem>
              </NDescriptions>
            </NCard>
            <NDivider />
            <NTabs v-if="hash" v-model:value="hash" default-value="points" animated>
              <NTabPane name="points" tab="我的积分" display-directive="show:lazy">
                <NDivider style="margin-top: 10px" />
                <NFlex justify="center">
                  <NDataTable
                    :loading="isLoading"
                    :columns="pointColumn"
                    :data="points"
                    :pagination="{ defaultPageSize: 10, showSizePicker: true, pageSizes: [10, 25, 50, 100] }"
                    size="small"
                    style="max-width: 600px"
                  />
                </NFlex>
              </NTabPane>
              <NTabPane name="orders" tab="我的订单" display-directive="show:lazy">
                <NDivider style="margin-top: 10px" />
                <PointOrderView />
              </NTabPane>
              <NTabPane name="histories" tab="积分记录" display-directive="show:lazy">
                <NDivider style="margin-top: 10px" />
                <PointUserHistoryView />
              </NTabPane>
              <NTabPane name="settings" tab="设置" display-directive="show:lazy">
                <NDivider style="margin-top: 10px" />
                <PointUserSettings />
              </NTabPane>
            </NTabs>
          </div>
        </NFlex>
      </NLayoutContent>
    </template>
  </NLayout>
</template>
