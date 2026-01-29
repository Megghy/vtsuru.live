<script setup lang="ts">
import type {
  DataTableColumns,
} from 'naive-ui'

import type { ResponsePointGoodModel, ResponsePointUserModel } from '@/api/api-models'
import { Info24Filled, Search24Regular, ArrowSync24Regular, AddSquare24Regular, ArrowDownload24Regular, Delete24Regular, Warning24Regular } from '@vicons/fluent'
import { useDebounceFn, useStorage } from '@vueuse/core'
import { format } from 'date-fns'
import { saveAs } from 'file-saver'
import {
  NButton, NCheckbox, NDataTable, NDivider, NEmpty, NFlex, NGrid, NIcon, NInput, NInputGroup, NInputGroupLabel, NInputNumber, NModal, NPopconfirm, NScrollbar, NSpin, NTag, NText, NTime, NTooltip, useMessage } from 'naive-ui';
import { computed, h, onMounted, ref, watch } from 'vue'
import { useAccount } from '@/api/account'
import { QueryGetAPI } from '@/api/query'
import { POINT_API_URL } from '@/shared/config'
import { objectsToCSV } from '@/shared/utils'
import PointUserDetailCard from './PointUserDetailCard.vue'
import BiliUserSelector from '@/components/common/BiliUserSelector.vue'

// 用户积分设置类型定义
interface PointUserSettings {
  onlyAuthed: boolean // 只显示已认证用户
  searchKeyword?: string // 搜索关键词
}

defineProps<{
  goods: ResponsePointGoodModel[]
}>()

const message = useMessage()
const accountInfo = useAccount()

// 默认筛选设置
const defaultSettings: PointUserSettings = {
  onlyAuthed: false,
}

// 使用持久化存储保存筛选设置
const settings = useStorage<PointUserSettings>('Settings.Point.Users', JSON.parse(JSON.stringify(defaultSettings)))

// 分页参数
const pn = ref(1)
const ps = ref(25)

// 弹窗控制
const showModal = ref(false)
const showGivePointModal = ref(false)
const showResetAllPointsModal = ref(false)
const isLoading = ref(true)

// 积分调整表单
const addPointCount = ref(0)
const addPointReason = ref<string>('')
const addPointTarget = ref<number>()
const selectedTargetUserName = ref<string>()

// 重置所有积分确认
const resetConfirmText = ref('')
const RESET_CONFIRM_TEXT = '我确认删除'

// 用户数据
const users = ref<ResponsePointUserModel[]>([])

// 搜索关键词
const searchKeyword = ref('')
const debouncedSearchKeyword = ref('')

// 防抖搜索
const updateSearch = useDebounceFn((value: string) => {
  debouncedSearchKeyword.value = value
}, 300)

watch(searchKeyword, (newVal) => {
  updateSearch(newVal)
})

// 根据筛选条件过滤后的用户
const filteredUsers = computed(() => {
  return users.value
    .filter((user) => {
      // 筛选已认证用户
      if (settings.value.onlyAuthed) {
        return user.isAuthed
      }

      // 根据关键词搜索
      if (debouncedSearchKeyword.value) {
        const keyword = debouncedSearchKeyword.value.toLowerCase()
        return (
          user.info.name?.toLowerCase().includes(keyword) === true
          || user.info.userId?.toString() === keyword
        )
      }

      return true
    })
    .sort((a, b) => b.updateAt - a.updateAt) // 按更新时间降序排序
})

// 用户统计
const userStats = computed(() => {
  const totalPoints = users.value.reduce((sum, u) => sum + u.point, 0)
  const avgPoints = users.value.length > 0 ? users.value.reduce((sum, u) => sum + u.point, 0) / users.value.length : 0
  return {
    total: users.value.length,
    authed: users.value.filter(u => u.isAuthed).length,
    totalPoints: Number(totalPoints.toFixed(1)),
    totalOrders: users.value.reduce((sum, u) => sum + ((u.orderCount || 0) > 0 ? (u.orderCount || 0) : 0), 0),
    avgPoints: Number(avgPoints.toFixed(1)),
    filtered: filteredUsers.value.length,
  }
})

// 当前查看的用户详情
const currentUser = ref<ResponsePointUserModel>()

// 渲染用户名或用户ID
function renderUsername(user: ResponsePointUserModel) {
  if (user.info?.name) {
    return user.info.name
  }

  return h(NFlex, null, () => [
    '未知',
    h(NText, { depth: 3 }, { default: () => `(${user.info.userId ?? user.info.openId})` }),
  ])
}

// 渲染订单数量，更友好的显示方式
function renderOrderCount(user: ResponsePointUserModel) {
  if (!user.isAuthed) return h(NText, { depth: 3 }, { default: () => '未认证' })
  return user.orderCount > 0 ? h(NText, {}, { default: () => formatNumber(user.orderCount) }) : h(NText, { depth: 3 }, { default: () => '无订单' })
}

// 渲染时间戳为相对时间和绝对时间
function renderTime(timestamp: number) {
  return h(NTooltip, null, {
    trigger: () => h(NTime, { time: timestamp, type: 'relative' }),
    default: () => h(NTime, { time: timestamp }),
  })
}

// 渲染操作按钮
function renderActions(user: ResponsePointUserModel) {
  return h(NFlex, { justify: 'center', gap: 8 }, () => [
    h(
      NButton,
      {
        onClick: () => {
          currentUser.value = user
          showModal.value = true
        },
        type: 'info',
        size: 'small',
      },
      { default: () => '详情' },
    ),
    h(
      NPopconfirm,
      { onPositiveClick: () => deleteUser(user) },
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
}

// 格式化数字，添加千位符
function formatNumber(num: number) {
  return num.toLocaleString('zh-CN')
}

// 渲染积分，添加千位符并加粗，保留一位小数
function renderPoint(num: number) {
  const formattedNum = Number(num.toFixed(1))
  return h(NText, { strong: true }, { default: () => formatNumber(formattedNum) })
}

// 数据表格列定义
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
    render: (row: ResponsePointUserModel) => renderUsername(row),
  },
  {
    title: '积分',
    key: 'point',
    sorter: (row1: ResponsePointUserModel, row2: ResponsePointUserModel) => row1.point - row2.point,
    render: (row: ResponsePointUserModel) => renderPoint(row.point),
  },
  {
    title: '订单数量',
    key: 'orderCount',
    render: (row: ResponsePointUserModel) => renderOrderCount(row),
  },
  {
    title: '最后更新于',
    key: 'updateAt',
    sorter: (row1: ResponsePointUserModel, row2: ResponsePointUserModel) => row1.updateAt - row2.updateAt,
    render: (row: ResponsePointUserModel) => renderTime(row.updateAt),
  },
  {
    title: '操作',
    key: 'action',
    render: (row: ResponsePointUserModel) => renderActions(row),
  },
]

// 获取所有用户
async function getUsers() {
  try {
    isLoading.value = true
    const data = await QueryGetAPI<ResponsePointUserModel[]>(`${POINT_API_URL}get-all-users`)
    if (data.code == 200) {
      return data.data
    } else {
      message.error(`获取用户失败: ${data.message}`)
    }
  } catch (err) {
    console.log(err)
    message.error(`获取用户失败: ${err}`)
  } finally {
    isLoading.value = false
  }
  return []
}

// 刷新用户数据
async function refresh() {
  users.value = await getUsers()
}

// 给指定用户添加积分
async function givePoint() {
  // 表单验证
  if (addPointCount.value == 0) {
    message.error('积分数量不能为 0')
    return
  }

  if (!addPointTarget.value) {
    message.error('请输入用户ID')
    return
  }

  isLoading.value = true
  try {
    const data = await QueryGetAPI<{ totalPoint: number, userName?: string, uId?: number }>(`${POINT_API_URL}give-point`, {
      uId: addPointTarget.value,
      count: addPointCount.value,
      reason: addPointReason.value || '',
    })

    if (data.code == 200) {
      const userName = data.data?.userName || selectedTargetUserName.value || `UID: ${addPointTarget.value}`
      const action = addPointCount.value > 0 ? '添加' : '扣除'
      message.success(`成功为 ${userName} ${action}了 ${Math.abs(addPointCount.value)} 积分`)
      showGivePointModal.value = false

      // 重新加载用户数据
      setTimeout(() => {
        refresh()
      }, 1500)

      // 重置表单
      addPointCount.value = 0
      addPointReason.value = ''
      addPointTarget.value = undefined
      selectedTargetUserName.value = undefined
    } else {
      message.error(`添加失败: ${data.message}`)
    }
  } catch (err) {
    message.error(`添加失败: ${err}`)
  } finally {
    isLoading.value = false
  }
}

// 删除用户
async function deleteUser(user: ResponsePointUserModel) {
  isLoading.value = true
  try {
    // 根据用户认证状态构建请求参数
    const params = user.isAuthed
      ? { authId: user.info.id }
      : user.info.userId
        ? { uId: user.info.userId }
        : { uId: user.info.openId }

    const data = await QueryGetAPI(`${POINT_API_URL}delete-user`, params)

    if (data.code == 200) {
      message.success('已删除')
      users.value = users.value.filter(u => u != user)
    } else {
      message.error(`删除失败: ${data.message}`)
    }
  } catch (err) {
    message.error(`删除失败: ${err}`)
  } finally {
    isLoading.value = false
  }
}

// 重置所有用户积分
async function resetAllPoints() {
  // 验证确认文本
  if (resetConfirmText.value !== RESET_CONFIRM_TEXT) {
    message.error(`请输入"${RESET_CONFIRM_TEXT}"以确认操作`)
    return
  }

  isLoading.value = true
  try {
    const data = await QueryGetAPI(`${POINT_API_URL}reset`)

    if (data.code == 200) {
      message.success('已重置所有用户积分')
      resetConfirmText.value = ''
      showResetAllPointsModal.value = false

      // 重新加载用户数据
      setTimeout(() => {
        refresh()
      }, 1500)
    } else {
      message.error(`重置失败: ${data.message}`)
    }
  } catch (err) {
    message.error(`重置失败: ${err}`)
  } finally {
    isLoading.value = false
  }
}

// 导出用户积分数据
function exportData() {
  try {
    const text = objectsToCSV(
      users.value.map((user) => {
        return {
          用户ID: user.info.userId || user.info.openId,
          用户名: user.info.name || '未知',
          认证状态: user.isAuthed ? '已认证' : '未认证',
          积分: Number(user.point.toFixed(1)),
          订单数量: user.orderCount || 0,
          最后更新时间: format(user.updateAt, 'yyyy-MM-dd HH:mm:ss'),
        }
      }),
    )

    // 添加BOM标记，确保Excel正确识别UTF-8编码
    const BOM = new Uint8Array([0xEF, 0xBB, 0xBF])
    const utf8encoder = new TextEncoder()
    const utf8array = utf8encoder.encode(text)

    saveAs(
      new Blob([BOM, utf8array], { type: 'text/csv;charset=utf-8;' }),
      `用户积分_${format(Date.now(), 'yyyy-MM-dd HH:mm:ss')}_${accountInfo.value?.name}_.csv`,
    )

    message.success('导出成功')
  } catch (error) {
    message.error(`导出失败: ${error}`)
    console.error('导出失败:', error)
  }
}

// 组件挂载时加载数据
onMounted(async () => {
  await refresh()
})
</script>

<template>
  <NSpin
    :show="isLoading"
    class="user-manage-container"
  >
    <!-- 统计卡片 -->
    <NGrid
      cols="2 600:4 800:5"
      :x-gap="12"
      :y-gap="12"
      style="margin-bottom: 16px"
    >
      <div class="stat-card">
        <div class="stat-label">
          总用户
        </div>
        <div class="stat-value">
          {{ userStats.total }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">
          已认证
        </div>
        <div class="stat-value success">
          {{ userStats.authed }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">
          总积分
        </div>
        <div class="stat-value primary">
          {{ userStats.totalPoints }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">
          总订单
        </div>
        <div class="stat-value info">
          {{ userStats.totalOrders }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">
          平均积分
        </div>
        <div class="stat-value">
          {{ userStats.avgPoints }}
        </div>
      </div>
    </NGrid>

    <!-- 工具栏 -->
    <div class="toolbar-section">
      <NFlex justify="space-between" align="center" wrap :gap="12">
        <!-- 左侧：筛选与搜索 -->
        <NFlex align="center" :gap="12" wrap>
          <NInput
            v-model:value="searchKeyword"
            placeholder="搜索用户 (用户名或UID)"
            style="width: 240px"
            clearable
            size="medium"
          >
            <template #prefix>
              <NIcon :component="Search24Regular" />
            </template>
          </NInput>
          
          <NCheckbox v-model:checked="settings.onlyAuthed">
            只显示已认证用户
          </NCheckbox>

          <NTooltip>
            <template #trigger>
              <NIcon :component="Info24Filled" class="info-icon" />
            </template>
            <div class="tooltip-content">
              <p>1. 如果 EventFetcher 使用的是开放平台连接则无法通过UId搜索除了已认证和手动添加之外的用户 (OpenID不通用)</p>
              <p>2. 用户名只会保持在首条记录出现时的用户名</p>
            </div>
          </NTooltip>
        </NFlex>

        <!-- 右侧：操作按钮 -->
        <NFlex align="center" :gap="8" wrap>
          <NButton secondary size="medium" @click="refresh">
            <template #icon>
              <NIcon :component="ArrowSync24Regular" />
            </template>
            刷新
          </NButton>
          
          <NButton secondary type="info" size="medium" @click="showGivePointModal = true">
            <template #icon>
              <NIcon :component="AddSquare24Regular" />
            </template>
            积分调整
          </NButton>

          <NButton secondary type="info" size="medium" @click="exportData">
            <template #icon>
              <NIcon :component="ArrowDownload24Regular" />
            </template>
            导出
          </NButton>
          
          <NPopconfirm @positive-click="showResetAllPointsModal = true">
            <template #trigger>
              <NButton secondary type="error" size="medium">
                <template #icon>
                  <NIcon :component="Delete24Regular" />
                </template>
                重置
              </NButton>
            </template>
            确定要重置所有用户的积分吗？慎点！
          </NPopconfirm>
        </NFlex>
      </NFlex>
    </div>

    <NDivider style="margin: 16px 0;" />

    <!-- 无数据提示 -->
    <NEmpty
      v-if="filteredUsers.length === 0"
      :description="isLoading ? '加载中...' : (settings.onlyAuthed ? '没有已认证的用户' : '没有用户')"
    />

    <!-- 用户数据表格 -->
    <NDataTable
      v-else
      v-model:page="pn"
      scroll-x="600"
      :columns="column"
      :data="filteredUsers"
      :pagination="{
        page: pn,
        pageSize: ps,
        showSizePicker: true,
        pageSizes: [10, 25, 50, 100],
        onUpdatePage: (page) => (pn = page),
        onUpdatePageSize: (pageSize) => (ps = pageSize),
      }"
      :loading="isLoading"
    />
  </NSpin>

  <!-- 用户详情弹窗 -->
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
        :goods="goods"
      />
    </NScrollbar>
  </NModal>

  <!-- 积分调整弹窗 -->
  <NModal
    v-model:show="showGivePointModal"
    preset="card"
    style="max-width: 500px"
    title="给予/扣除积分"
  >
    <NFlex
      vertical
      :gap="16"
    >
      <NFlex
        :wrap="false"
        align="center"
        :gap="8"
      >
        <NFlex
          vertical
          :gap="4"
          style="flex: 1"
        >
          <NText depth="3">
            目标用户
          </NText>
          <BiliUserSelector
            v-model:value="addPointTarget"
            placeholder="请输入B站用户UID"
            @user-info-loaded="(userInfo) => selectedTargetUserName = userInfo?.name"
          />
        </NFlex>
        <NTooltip>
          <template #trigger>
            <NIcon :component="Info24Filled" />
          </template>
          <div class="tooltip-content">
            <p>输入UID后会自动从B站获取用户信息</p>
            <p>因为UID和B站提供的OpenID不兼容, 未认证用户可能会出现两个记录, 不过在认证完成后会合并成一个</p>
          </div>
        </NTooltip>
      </NFlex>

      <NFlex
        :wrap="false"
        align="center"
        :gap="5"
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
          负数为扣除积分
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
        :disabled="!addPointCount || addPointCount === 0"
        @click="givePoint"
      >
        {{ !addPointCount || addPointCount === 0 ? '确定' : (addPointCount > 0 ? '给予' : '扣除') }}
      </NButton>
    </NFlex>
  </NModal>

  <!-- 重置所有用户积分弹窗 -->
  <NModal
    v-model:show="showResetAllPointsModal"
    preset="card"
    style="max-width: 500px"
    title="重置所有用户积分"
  >
    <NFlex
      vertical
      :gap="16"
    >
      <NFlex
        align="center"
        :gap="8"
      >
        <NIcon
          :component="Warning24Regular"
          color="red"
        />
        <NText type="error">
          警告：此操作将删除所有用户积分记录，不可恢复！
        </NText>
      </NFlex>
      <NText>请输入 <b>"{{ RESET_CONFIRM_TEXT }}"</b> 以确认操作</NText>
      <NInput
        v-model:value="resetConfirmText"
        placeholder="请输入确认文本"
      />

      <NButton
        type="error"
        :loading="isLoading"
        :disabled="resetConfirmText !== RESET_CONFIRM_TEXT"
        @click="resetAllPoints"
      >
        确认重置所有用户积分
      </NButton>
    </NFlex>
  </NModal>
</template>


<style scoped>
.user-manage-container {
  min-height: 200px;
  min-width: 200px;
}

.tooltip-content {
  max-width: 300px;
}

.stat-card {
  background-color: var(--n-card-color);
  border: 1px solid var(--n-border-color);
  border-radius: var(--n-border-radius);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: all 0.3s var(--n-bezier);
}

.stat-card:hover {
  border-color: var(--n-primary-color);
  box-shadow: 0 0 0 1px var(--n-primary-color) inset;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--n-text-color);
}

.stat-label {
  font-size: 13px;
  color: var(--n-text-color-3);
}

.stat-value.primary { color: var(--n-primary-color); }
.stat-value.success { color: var(--n-success-color); }
.stat-value.info { color: var(--n-info-color); }

.toolbar-section {
  background-color: var(--n-card-color);
  border: 1px solid var(--n-border-color);
  border-radius: var(--n-border-radius);
  padding: 12px 16px;
}

.info-icon {
  color: var(--n-text-color-3);
  cursor: help;
}

@media (max-width: 768px) {
  .stat-value {
    font-size: 20px;
  }
}
</style>
