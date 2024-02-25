<script setup lang="ts">
import { ResponsePointGoodModel, ResponsePointUserModel } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { POINT_API_URL } from '@/data/constants'
import { useStorage } from '@vueuse/core'
import {
  DataTableColumns,
  NButton,
  NCard,
  NCheckbox,
  NDataTable,
  NDivider,
  NEmpty,
  NFlex,
  NIcon,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NInputNumber,
  NModal,
  NPopconfirm,
  NScrollbar,
  NSpin,
  NTag,
  NText,
  NTime,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, h, onMounted, ref } from 'vue'
import PointUserDetailCard from './PointUserDetailCard.vue'
import { Info24Filled } from '@vicons/fluent'

const props = defineProps<{
  goods: ResponsePointGoodModel[]
}>()

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
const showGivePointModal = ref(false)
const isLoading = ref(true)

const addPointCount = ref(0)
const addPointReason = ref<string>()
const addPointTarget = ref<number>()

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
      return (
        row.info?.name ??
        h(NFlex, null, () => [
          '未知',
          h(NText, { depth: 3 }, { default: () => `(${row.info.userId ?? row.info.openId})` }),
        ])
      )
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
async function refresh() {
  users.value = await getUsers()
}
async function givePoint() {
  if (addPointCount.value <= 0) {
    message.error('积分数量必须大于0')
    return
  }
  if (!addPointTarget.value) {
    message.error('请输入用户')
  }
  isLoading.value = true
  try {
    const data = await QueryGetAPI(POINT_API_URL + 'give-point', {
      uId: addPointTarget.value,
      count: addPointCount.value,
      reason: addPointReason.value,
    })
    if (data.code == 200) {
      message.success('添加成功')
      showGivePointModal.value = false
      await refresh()

      addPointCount.value = 0
      addPointReason.value = undefined
      addPointTarget.value = undefined
    } else {
      message.error('添加失败: ' + data.message)
    }
  } catch (err) {
    message.error('添加失败: ' + err)
  }
}

onMounted(async () => {
  await refresh()
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
      <template #footer>
        <NFlex>
          <NButton type="primary" @click="refresh">刷新</NButton>
          <NButton type="info" @click="showGivePointModal = true">给予积分</NButton>
        </NFlex>
      </template>
      <NFlex>
        <NCheckbox v-model:checked="settings.onlyAuthed"> 只显示已认证用户 </NCheckbox>
      </NFlex>
    </NCard>
    <template v-if="filteredUsers.length == 0">
      <NDivider />
      <NEmpty :description="settings.onlyAuthed ? '没有已认证的用户' : '没有用户'" />
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
    style="max-width: 1000px; min-width: 400px"
    title="用户详情"
    content-style="padding: 0"
  >
    <NScrollbar style="max-height: 80vh">
      <PointUserDetailCard v-if="currentUser" :user="currentUser" :authInfo="currentUser.info" :goods="goods" />
    </NScrollbar>
  </NModal>
  <NModal v-model:show="showGivePointModal" preset="card" style="max-width: 500px" title="给予积分">
    <NFlex vertical>
      <NFlex :wrap="false" align="center">
        <NInputGroup style="max-width: 200px">
          <NInputGroupLabel> 目标用户 </NInputGroupLabel>
          <NInputNumber v-model:value="addPointTarget" type="number" placeholder="请输入目标用户UId" min="0" />
        </NInputGroup>
        <NTooltip>
          <template #trigger>
            <NIcon :component="Info24Filled" />
          </template>
          如果目标用户没在直播间发言过则无法显示用户名, 不过不影响使用
        </NTooltip>
      </NFlex>
      <NInputGroup>
        <NInputGroupLabel> 积分数量 </NInputGroupLabel>
        <NInputNumber
          v-model:value="addPointCount"
          type="number"
          placeholder="请输入积分数量"
          min="0"
          style="max-width: 120px"
        />
      </NInputGroup>
      <NInput placeholder="(选填) 请输入备注" v-model:value="addPointReason" :maxlength="100" show-count clearable />
      <NButton type="primary" @click="givePoint" :loading="isLoading"> 给予 </NButton>
    </NFlex>
  </NModal>
</template>
