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
import { objectsToCSV } from '@/Utils'
import { format } from 'date-fns'

const props = defineProps<{
  goods: ResponsePointGoodModel[]
}>()

type PointUserSettings = {
  onlyAuthed: boolean
  searchKeyword?: string
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
      if (settings.value.searchKeyword) {
        return (
          user.info.name?.toLowerCase().includes(settings.value.searchKeyword.toLowerCase()) == true ||
          user.info.userId?.toString() == settings.value.searchKeyword
        )
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
        h(
          NPopconfirm,
          { onPositiveClick: () => deleteUser(row) },
          {
            default: () => '确定要删除这个用户吗？记录将无法恢复',
            trigger: () =>
              h(
                NButton,
                {
                  type: 'error',
                  size: 'small',
                },
                { default: () => '删除' },
              ),
          },
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
  if (addPointCount.value == 0) {
    message.error('积分数量不能为 0')
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
      setTimeout(() => {
        refresh()
      }, 1500)

      addPointCount.value = 0
      addPointReason.value = undefined
      addPointTarget.value = undefined
    } else {
      message.error('添加失败: ' + data.message)
    }
  } catch (err) {
    message.error('添加失败: ' + err)
  } finally {
    isLoading.value = false
  }
}
async function deleteUser(user: ResponsePointUserModel) {
  isLoading.value = true
  try {
    const data = await QueryGetAPI(
      POINT_API_URL + 'delete-user',
      user.isAuthed
        ? {
            authId: user.info.id,
          }
        : user.info.userId
          ? {
              uId: user.info.userId,
            }
          : {
              uId: user.info.openId,
            },
    )
    if (data.code == 200) {
      message.success('已删除')
      users.value = users.value.filter((u) => u != user)
    } else {
      message.error('删除失败: ' + data.message)
    }
  } catch (err) {
    message.error('删除失败: ' + err)
  } finally {
    isLoading.value = false
  }
}
function exportData() {
/*  const text = objectsToCSV(
    users.value.map((s) => {
      const gift = props.goods.find((g) => g.id == s.goodsId)
      return {
      }
    }),
  )
  const BOM = new Uint8Array([0xef, 0xbb, 0xbf])
  const utf8encoder = new TextEncoder()
  const utf8array = utf8encoder.encode(text)
  saveAs(
    new Blob([BOM, utf8array], { type: 'text/csv;charset=utf-8;' }),
    `用户积分_${format(Date.now(), 'yyyy-MM-dd HH:mm:ss')}_${accountInfo.value?.name}_.csv`,
  )*/
}

onMounted(async () => {
  await refresh()
})
</script>

<template>
  <NSpin
    :show="isLoading"
    style="min-height: 200px; min-width: 200px"
  >
    <NCard title="设置">
      <template #header-extra>
        <NPopconfirm @positive-click="settings = JSON.parse(JSON.stringify(defaultSettings))">
          <template #trigger>
            <NButton
              size="small"
              type="warning"
            >
              恢复默认
            </NButton>
          </template>
          <span>确定要恢复默认设置吗?</span>
        </NPopconfirm>
      </template>
      <template #footer>
        <NFlex>
          <NButton
            type="primary"
            @click="refresh"
          >
            刷新
          </NButton>
          <NButton
            type="info"
            @click="showGivePointModal = true"
          >
            给予/扣除积分
          </NButton>
          <NButton
            type="info"
            @click="exportData"
          >
            导出积分数据 (暂未实现)
          </NButton>
        </NFlex>
      </template>
      <NFlex align="center">
        <NFlex
          :wrap="false"
          align="center"
          :size="5"
        >
          <NInput
            v-model:value="settings.searchKeyword"
            placeholder="搜索用户 (用户名或uid)"
            style="max-width: 200px"
            clearable
          />
          <NTooltip>
            <template #trigger>
              <NIcon :component="Info24Filled" />
            </template>
            1. 如果 EventFetcher 使用的是开放平台连接则无法通过UId搜索除了已认证和手动添加之外的用户
            (因为开放平台提供的是OpenId, 不通用)
            <br>
            2. 用户名只会保持在首条记录出现时的用户名, 即用户更换用户名之后这里也只会保持不变
          </NTooltip>
        </NFlex>
        <NCheckbox v-model:checked="settings.onlyAuthed">
          只显示已认证用户
        </NCheckbox>
      </NFlex>
    </NCard>
    <NDivider />
    <template v-if="filteredUsers.length == 0">
      <NDivider />
      <NEmpty :description="settings.onlyAuthed ? '没有已认证的用户' : '没有用户'" />
    </template>
    <NDataTable
      v-else
      v-model:page="pn"
      scroll-x="600"
      :columns="column"
      :data="filteredUsers"
      :pagination="{ defaultPageSize: ps, showSizePicker: true, pageSizes: [10, 25, 50, 100] }"
    />
  </NSpin>
  <NModal
    v-model:show="showModal"
    preset="card"
    style="max-width: 90vw; min-width: 400px; width: 1600px;"
    title="用户详情"
    content-style="padding: 0"
  >
    <NScrollbar style="max-height: 80vh">
      <PointUserDetailCard
        v-if="currentUser"
        :user="currentUser"
        :auth-info="currentUser.info"
        :goods="goods"
      />
    </NScrollbar>
  </NModal>
  <NModal
    v-model:show="showGivePointModal"
    preset="card"
    style="max-width: 500px"
    title="给予/扣除积分"
  >
    <NFlex vertical>
      <NFlex
        :wrap="false"
        align="center"
        :size="0"
      >
        <NInputGroup style="max-width: 300px">
          <NInputGroupLabel> 目标用户 </NInputGroupLabel>
          <NInputNumber
            v-model:value="addPointTarget"
            type="number"
            placeholder="请输入目标用户UId"
            min="0"
          />
        </NInputGroup>
        <NTooltip>
          <template #trigger>
            <NIcon :component="Info24Filled" />
          </template>
          如果目标用户没在直播间发言过则无法显示用户名, 不过不影响使用
          <br>
          因为uid和b站提供的openid不兼容, 未认证用户可能会出现两个记录, 不过在认证完成后会合并成一个
        </NTooltip>
      </NFlex>
      <NFlex
        :wrap="false"
        align="center"
        :size="5"
      >
        <NInputGroup style="max-width: 220px">
          <NInputGroupLabel> 积分数量 </NInputGroupLabel>
          <NInputNumber
            v-model:value="addPointCount"
            type="number"
            placeholder="输入要给予的积分"
          />
        </NInputGroup>
        <NTooltip>
          <template #trigger>
            <NIcon :component="Info24Filled" />
          </template>
          负数为扣除
        </NTooltip>
      </NFlex>
      <NInput
        v-model:value="addPointReason"
        placeholder="(选填) 请输入备注"
        :maxlength="100"
        show-count
        clearable
      />
      <NButton
        type="primary"
        :loading="isLoading"
        @click="givePoint"
      >
        {{ addPointCount > 0 ? '给予' : '扣除' }}
      </NButton>
    </NFlex>
  </NModal>
</template>
