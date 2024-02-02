<script setup lang="ts">
import { ResponsePointUserModel } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { POINT_API_URL } from '@/data/constants'
import { NButton, NCard, NDataTable, NList, NListItem, NModal, useMessage } from 'naive-ui'
import { h, ref } from 'vue'
import PointUserDetailCard from './PointUserDetailCard.vue'

const message = useMessage()

const pn = ref(1)
const ps = ref(25)
const showModal = ref(false)

const users = ref<ResponsePointUserModel[]>(await getUsers())
const currentUser = ref<ResponsePointUserModel>()

const column = [
  {
    title: '认证',
    key: 'auth',
    render: (row: ResponsePointUserModel) => {
      return row.isAuthed ? '已认证' : '未认证'
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
    key: 'points',
    render: (row: ResponsePointUserModel) => {
      return row.point
    },
  },
  {
    title: '订单数量',
    key: 'orders',
    render: (row: ResponsePointUserModel) => {
      return row.orderCount
    },
  },
  {
    title: '操作',
    key: 'action',
    render: (row: ResponsePointUserModel) => {
      return h(
        NButton,
        {
          onClick: () => {
            currentUser.value = row
            showModal.value = true
          },
        },
        { default: () => '详情' },
      )
    },
  },
]

async function getUsers() {
  try {
    const data = await QueryGetAPI<ResponsePointUserModel[]>(POINT_API_URL + 'get-all-users')
    if (data.code == 200) {
      return data.data
    } else {
      message.error('获取订单失败: ' + data.message)
    }
  } catch (err) {
    console.log(err)
    message.error('获取订单失败: ' + err)
  }
  return []
}
</script>

<template>
  <NDataTable :columns="column" :data="users" :pagination="{ pageSize: ps, page: pn, showSizePicker: true, pageSizes: [10, 25, 50, 100] }" />
  <NModal v-model:show="showModal" style="max-width: 600px" title="用户详情">
    <PointUserDetailCard v-if="currentUser" :user="currentUser" />
  </NModal>
</template>
