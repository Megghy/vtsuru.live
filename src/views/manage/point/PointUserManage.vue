<script setup lang="ts">
import { ResponsePointUserModel } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { POINT_API_URL } from '@/data/constants'
import {
  DataTableColumns,
  NButton,
  NCard,
  NCheckbox,
  NDataTable,
  NDivider,
  NEmpty,
  NFlex,
  NList,
  NListItem,
  NModal,
  NPopconfirm,
  NScrollbar,
  NSpin,
  NTag,
  NTime,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, h, onMounted, ref } from 'vue'
import PointUserDetailCard from './PointUserDetailCard.vue'
import { useStorage } from '@vueuse/core'

type PointUserSettings = {
  onlyAuthed: boolean
}

const message = useMessage()

const defaultSettings: PointUserSettings = {
  onlyAuthed: false,
}
const settings = useStorage<PointUserSettings>('Settings.Point.Users', JSON.parse(JSON.stringify(defaultSettings)))

const pn = ref(1)
const ps = ref(25)
const showModal = ref(false)
const isLoading = ref(true)

const users = ref<ResponsePointUserModel[]>([])
const filteredUsers = computed(() => {
  return users.value
    .filter((user) => {
      if (settings.value.onlyAuthed) {
        return user.isAuthed
      }
      return true
    })
    .sort((a, b) => b.updateAt - a.updateAt)
})
const currentUser = ref<ResponsePointUserModel>()

const column: DataTableColumns<ResponsePointUserModel> = [
  {
    title: '认证',
    key: 'auth',
    render: (row: ResponsePointUserModel) => {
      return h(NTag, { type: row.isAuthed ? 'success' : 'error' }, () => (row.isAuthed ? '已认证' : '未认证'))
    },
  },
  {
    title: '用户名',
    key: 'username',
    render: (row: ResponsePointUserModel) => {
      return row.info?.name ?? '未知'
    },
  },
  {
    title: '积分',
    key: 'point',
    sorter: 'default',
    render: (row: ResponsePointUserModel) => {
      return row.point
    },
  },
  {
    title: '订单数量',
    key: 'orders',
    render: (row: ResponsePointUserModel) => {
      return row.isAuthed ? row.orderCount : '无'
    },
  },
  {
    title: '最后更新于',
    key: 'updateAt',
    sorter: 'default',
    render: (row: ResponsePointUserModel) => {
      return h(NTooltip, null, {
        trigger: () => h(NTime, { time: row.updateAt, type: 'relative' }),
        default: () => h(NTime, { time: row.updateAt }),
      })
    },
  },
  {
    title: '操作',
    key: 'action',
    render: (row: ResponsePointUserModel) => {
      return h(NFlex, { justify: 'center' }, () => [
        h(
          NButton,
          {
            onClick: () => {
              currentUser.value = row
              showModal.value = true
            },
            type: 'info',
            size: 'small',
          },
          { default: () => '详情' },
        ),
      ])
    },
  },
]

async function getUsers() {
  try {
    isLoading.value = true
    const data = await QueryGetAPI<ResponsePointUserModel[]>(POINT_API_URL + 'get-all-users')
    if (data.code == 200) {
      return data.data
    } else {
      message.error('获取订单失败: ' + data.message)
    }
  } catch (err) {
    console.log(err)
    message.error('获取订单失败: ' + err)
  } finally {
    isLoading.value = false
  }
  return []
}

onMounted(async () => {
  users.value = await getUsers()
})
</script>

<template>
  <NSpin :show="isLoading" style="min-height: 200px; min-width: 200px">
    <NCard title="设置">
      <template #header-extra>
        <NPopconfirm @positive-click="settings = JSON.parse(JSON.stringify(defaultSettings))">
          <template #trigger>
            <NButton size="small" type="warning">恢复默认</NButton>
          </template>
          <span>确定要恢复默认设置吗?</span>
        </NPopconfirm>
      </template>
      <NFlex>
        <NCheckbox v-model:checked="settings.onlyAuthed"> 只显示已认证用户 </NCheckbox>
      </NFlex>
    </NCard>
    <template v-if="filteredUsers.length == 0">
      <NDivider />
      <NEmpty description="暂无用户" />
    </template>
    <NDataTable
      v-else
      scroll-x="600"
      :columns="column"
      :data="filteredUsers"
      :pagination="{ defaultPageSize: ps, showSizePicker: true, pageSizes: [10, 25, 50, 100] }"
    />
  </NSpin>
  <NModal
    v-model:show="showModal"
    preset="card"
    style="max-width: 600px; min-width: 400px"
    title="用户详情"
    content-style="padding: 0"
  >
    <NScrollbar style="max-height: 80vh">
      <PointUserDetailCard v-if="currentUser" :user="currentUser" :authInfo="currentUser.info" />
    </NScrollbar>
  </NModal>
</template>
