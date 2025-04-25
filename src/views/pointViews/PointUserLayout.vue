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
  NTag,
  useMessage,
} from 'naive-ui'
import { computed, h, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PointOrderView from './PointOrderView.vue'
import PointUserHistoryView from './PointUserHistoryView.vue'
import PointUserSettings from './PointUserSettings.vue'

// 定义组件接口
interface ComponentWithReset {
  reset: () => void;
}

interface OrderViewInstance extends ComponentWithReset {
  getOrders: () => Promise<any>;
}

interface HistoryViewInstance extends ComponentWithReset {
  getHistories: () => Promise<any>;
}

interface SettingsViewInstance extends ComponentWithReset {
  // 设置组件可能需要的方法
}

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
const isFirstMounted = ref(true)
// 分别定义各组件引用，使用正确的类型
const orderViewRef = ref<OrderViewInstance | null>(null)
const historyViewRef = ref<HistoryViewInstance | null>(null)
const settingsViewRef = ref<SettingsViewInstance | null>(null)

// 跟踪各标签页数据是否已加载
const tabDataLoaded = ref({
  points: false,
  orders: false,
  histories: false,
  settings: true // 设置页面不需要加载数据
})

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
      tabDataLoaded.value.points = true
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

// 重置所有数据
function resetData() {
  points.value = []
  isFirstMounted.value = true
  // 重置数据加载状态
  Object.keys(tabDataLoaded.value).forEach(key => {
    tabDataLoaded.value[key as keyof typeof tabDataLoaded.value] = false
  })
  tabDataLoaded.value.settings = true // 设置页不需要加载数据
  // 重置所有子组件的数据
  orderViewRef.value?.reset?.()
  historyViewRef.value?.reset?.()
  settingsViewRef.value?.reset?.()
}

function switchAuth(token: string) {
  if (token == useAuth.biliToken) {
    message.info('当前正在使用该账号')
    return
  }
  resetData()
  useAuth.setCurrentAuth(token)
  message.success('已选择账号')
}

function onAllPointPaneMounted() {
  if (!isFirstMounted.value) return
  isFirstMounted.value = false
  getAllPoints()
}

// 处理选项卡切换
function onTabChange(tabName: string) {
  // 只在数据未加载时刷新
  switch(tabName) {
    case 'points':
      if (!tabDataLoaded.value.points) {
        getAllPoints()
      }
      break
    case 'orders':
      if (!tabDataLoaded.value.orders && orderViewRef.value) {
        orderViewRef.value.getOrders()
        tabDataLoaded.value.orders = true
      }
      break
    case 'histories':
      if (!tabDataLoaded.value.histories && historyViewRef.value) {
        historyViewRef.value.getHistories()
        tabDataLoaded.value.histories = true
      }
      break
  }
}

// 监听 biliToken 变化
watch(() => useAuth.biliToken, (newToken) => {
  if (newToken) {
    resetData()
    getAllPoints()
  }
})

// 手动刷新当前标签页数据
function refreshCurrentTab() {
  if (!hash.value) return

  // 将当前标签设为未加载状态
  tabDataLoaded.value[hash.value as keyof typeof tabDataLoaded.value] = false

  // 触发刷新
  onTabChange(hash.value)
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
        <NFlex
          justify="space-between"
          align="center"
        >
          <NButton
            type="primary"
            secondary
            @click="$router.back()"
          >
            返回
          </NButton>
          <NText style="font-size: 24px">
            认证用户个人中心
          </NText>
          <NButton
            size="small"
            type="primary"
            :disabled="!hash"
            @click="refreshCurrentTab"
          >
            刷新数据
          </NButton>
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
                <NDescriptionsItem label="状态">
                  <NTag
                    v-if="biliAuth.id > 0"
                    type="success"
                  >
                    已认证
                  </NTag>
                  <NTag
                    v-else
                    type="error"
                  >
                    未认证
                  </NTag>
                </NDescriptionsItem>
              </NDescriptions>
            </NCard>
            <NDivider />
            <NTabs
              v-if="hash"
              v-model:value="hash"
              default-value="points"
              animated
              @update:value="onTabChange"
            >
              <NTabPane
                name="points"
                tab="我的积分"
                display-directive="show:lazy"
                @vue:mounted="onAllPointPaneMounted"
              >
                <NDivider style="margin-top: 10px" />
                <NFlex justify="end" style="margin-bottom: 10px">
                  <NButton
                    size="small"
                    type="primary"
                    @click="() => {
                      tabDataLoaded.points = false;
                      getAllPoints();
                    }"
                  >
                    刷新积分
                  </NButton>
                </NFlex>
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
                <PointOrderView
                  ref="orderViewRef"
                  @data-loaded="tabDataLoaded.orders = true"
                />
              </NTabPane>
              <NTabPane
                name="histories"
                tab="积分记录"
                display-directive="show:lazy"
              >
                <NDivider style="margin-top: 10px" />
                <PointUserHistoryView
                  ref="historyViewRef"
                  @data-loaded="tabDataLoaded.histories = true"
                />
              </NTabPane>
              <NTabPane
                name="settings"
                tab="设置"
                display-directive="show:lazy"
              >
                <NDivider style="margin-top: 10px" />
                <PointUserSettings ref="settingsViewRef" />
              </NTabPane>
            </NTabs>
          </div>
        </NFlex>
      </NLayoutContent>
    </template>
  </NLayout>
</template>
