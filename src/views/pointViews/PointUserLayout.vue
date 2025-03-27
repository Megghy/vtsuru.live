<script setup lang="ts">
import { UserInfo } from '@/api/api-models'
import { POINT_API_URL } from '@/data/constants'
import { useAuthStore } from '@/store/useAuthStore'
import { useRouteHash } from '@vueuse/router'
import {
  NAlert,
  NButton,
  NCard,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NDivider,
  NFlex,
  NLayout,
  NLayoutContent,
  NLayoutHeader,
  NList,
  NListItem,
  NResult,
  NSpin,
  NTabPane,
  NTabs,
  NText,
  useMessage,
} from 'naive-ui'
import { computed, h, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PointOrderView from './PointOrderView.vue'
import PointUserHistoryView from './PointUserHistoryView.vue'
import PointUserSettings from './PointUserSettings.vue'

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
const router = useRouter()

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
    title: '更多',
    key: 'action',
    render: (row: { owner: UserInfo; points: number }) => {
      return h(NFlex, {}, () => [
        h(
          NButton,
          {
            onClick: () => {
              router.push({ name: 'user-goods', params: { id: row.owner.name } })
            },
            size: 'small',
            secondary: true,
            type: 'info',
          },
          () => '查看礼物',
        ),
      ])
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
      points.value = data.data
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
let isFirstMounted = true
function onAllPointPaneMounted() {
  if (!isFirstMounted) return
  isFirstMounted = false
  getAllPoints()
}

onMounted(async () => {
  const route = useRoute()
  if (route.query.auth) {
    useAuth.biliToken = route.query.auth as string
    console.log(route.query.auth)
  }
  if (biliAuth.value?.id < 0) {
    isLoading.value = true
    await useAuth.getAuthInfo()
    isLoading.value = false
  }
})
</script>

<template>
  <NLayout style="height: 100vh">
    <NSpin
      v-if="useAuth.isLoading && useAuth.currentToken"
      :show="useAuth.isLoading"
    />
    <NLayoutContent
      v-else-if="(!useAuth.currentToken && useAuth.biliTokens.length > 0) || useAuth.isInvalid"
      style="height: 100vh; padding: 50px"
    >
      <NAlert
        v-if="useAuth.isInvalid"
        type="error"
      >
        当前登录的 Bilibili 账号已失效
      </NAlert>
      <NCard
        title="选择B站账号"
        embedded
      >
        <template #header-extra>
          <NButton
            type="primary"
            size="small"
            secondary
            @click="$router.push({ name: 'bili-auth' })"
          >
            认证其他账号
          </NButton>
        </template>
        <NList
          clickable
          bordered
        >
          <NListItem
            v-for="item in useAuth.biliTokens"
            :key="item.token"
            @click="switchAuth(item.token)"
          >
            <NFlex align="center">
              {{ item.name }} - {{ item.uId }}
            </NFlex>
          </NListItem>
        </NList>
      </NCard>
    </NLayoutContent>
    <NLayoutContent
      v-else-if="!useAuth.currentToken"
      style="height: 100vh"
    >
      <NAlert
        v-if="useAuth.isInvalid"
        type="error"
      >
        当前登录的 Bilibili 账号已失效
      </NAlert>
      <NResult
        status="error"
        title="你还未进行过B站账户验证"
        description="请先进行认证"
        style="padding-top: 64px"
      >
        <template #footer>
          <NButton
            type="primary"
            @click="$router.push({ name: 'bili-auth' })"
          >
            去认证
          </NButton>
        </template>
      </NResult>
    </NLayoutContent>
    <template v-else>
      <NLayoutHeader
        style="padding: 10px"
        bordered
      >
        <NFlex justify="center">
          <NText style="font-size: 24px">
            认证用户个人中心
          </NText>
        </NFlex>
      </NLayoutHeader>
      <NLayoutContent content-style="padding: 24px;">
        <NFlex
          align="center"
          justify="center"
        >
          <div style="max-width: 95vw; width: 1200px">
            <NCard title="我的信息">
              <NDescriptions
                label-placement="left"
                bordered
                size="small"
                :column="2"
              >
                <NDescriptionsItem
                  label="用户名"
                  style="min-width: 100px;"
                >
                  {{ biliAuth.name ?? '未知' }}
                </NDescriptionsItem>
                <NDescriptionsItem label="UserId">
                  {{ biliAuth.userId }}
                </NDescriptionsItem>
                <NDescriptionsItem label="OpenId">
                  {{ biliAuth.openId }}
                </NDescriptionsItem>
              </NDescriptions>
            </NCard>
            <NDivider />
            <NTabs
              v-if="hash"
              v-model:value="hash"
              default-value="points"
              animated
            >
              <NTabPane
                name="points"
                tab="我的积分"
                display-directive="show:lazy"
                @vue:mounted="onAllPointPaneMounted"
              >
                <NDivider style="margin-top: 10px" />
                <NButton
                  style="margin-bottom: 10px"
                  size="small"
                  type="primary"
                  @click="getAllPoints()"
                >
                  刷新
                </NButton>
                <NDivider />
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
              <NTabPane
                name="orders"
                tab="我的订单"
                display-directive="show:lazy"
              >
                <NDivider style="margin-top: 10px" />
                <PointOrderView />
              </NTabPane>
              <NTabPane
                name="histories"
                tab="积分记录"
                display-directive="show:lazy"
              >
                <NDivider style="margin-top: 10px" />
                <PointUserHistoryView />
              </NTabPane>
              <NTabPane
                name="settings"
                tab="设置"
                display-directive="show:lazy"
              >
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
