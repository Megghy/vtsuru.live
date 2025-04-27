<script setup lang="ts">
import { copyToClipboard, getImageUploadModel } from '@/Utils'
import { DisableFunction, EnableFunction, useAccount } from '@/api/account'
import { FunctionTypes, GoodsStatus, GoodsTypes, PointGoodsModel, ResponsePointGoodModel } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import EventFetcherStatusCard from '@/components/EventFetcherStatusCard.vue'
import PointGoodsItem from '@/components/manage/PointGoodsItem.vue'
import { CN_HOST, CURRENT_HOST, FILE_BASE_URL, POINT_API_URL } from '@/data/constants'
import { useAuthStore } from '@/store/useAuthStore'
import { Info24Filled } from '@vicons/fluent'
import { useRouteHash } from '@vueuse/router'
import { useStorage } from '@vueuse/core'
import {
  FormItemRule,
  NAlert,
  NButton,
  NCheckbox,
  NDivider,
  NEmpty,
  NFlex,
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
  NIcon,
  NImage,
  NInput,
  NInputNumber,
  NInputGroup,
  NModal,
  NPopconfirm,
  NRadioButton,
  NRadioGroup,
  NScrollbar,
  NSelect,
  NSwitch,
  NTabPane,
  NTabs,
  NText,
  NTooltip,
  NUpload,
  UploadFileInfo,
  useDialog,
  useMessage,
} from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import PointOrderManage from './PointOrderManage.vue'
import PointSettings from './PointSettings.vue'
import PointUserManage from './PointUserManage.vue'

const message = useMessage()
const accountInfo = useAccount()
const dialog = useDialog()
const useBiliAuth = useAuthStore()
const formRef = ref()
const isUpdating = ref(false)
const isAllowedPrivacyPolicy = ref(false)
const useCNUrl = useStorage('Settings.UseCNUrl', false)
const showAddGoodsModal = ref(false)

// 路由哈希处理
const realHash = useRouteHash('goods', { mode: 'replace' })
const hash = computed({
  get() {
    return realHash.value?.startsWith('#') ? realHash.value.slice(1) : realHash.value || 'goods'
  },
  set(val) {
    realHash.value = '#' + val
  },
})

// 商品数据及模型
const goods = ref<ResponsePointGoodModel[]>(await useBiliAuth.GetGoods(accountInfo.value?.id, message))
const defaultGoodsModel = {
  goods: {
    type: GoodsTypes.Virtual,
    status: GoodsStatus.Normal,
    maxBuyCount: 1,
    isAllowRebuy: false,
    setting: {
      allowGuardLevel: 0
    },
  } as PointGoodsModel,
  fileList: [],
} as { goods: PointGoodsModel; fileList: UploadFileInfo[] }
const currentGoodsModel = ref<{ goods: PointGoodsModel; fileList: UploadFileInfo[] }>(
  JSON.parse(JSON.stringify(defaultGoodsModel))
)

// 计算属性
const allowedYearOptions = computed(() => {
  return Array.from({ length: new Date().getFullYear() - 2024 + 1 }, (_, i) => 2024 + i).map((item) => ({
    label: item.toString() + '年',
    value: item,
  }))
})

const allowedMonthOptions = computed(() => {
  return Array.from({ length: 12 }, (_, i) => i + 1).map((item) => ({
    label: item.toString() + '月',
    value: item,
  }))
})

const existTags = computed(() => {
  if (goods.value.length === 0) return []

  const tempSet = new Set<string>()
  for (const good of goods.value) {
    if (!good.tags || good.tags.length === 0) continue
    good.tags.forEach(tag => tempSet.add(tag))
  }

  return Array.from(tempSet).map(tag => ({ label: tag, value: tag }))
})

// 下拉菜单选项
const dropDownActions = {
  update: {
    label: '修改',
    key: 'update',
    action: (item: ResponsePointGoodModel) => onUpdateClick(item),
  },
  delete: {
    label: '删除',
    key: 'delete',
    action: (item: ResponsePointGoodModel) => onDeleteClick(item),
  },
} as { [key: string]: { label: string; key: string; action: (item: ResponsePointGoodModel) => void } }

const dropDownOptions = computed(() => Object.values(dropDownActions))

// 表单验证规则
const rules = {
  name: {
    required: true,
    message: '请输入礼物名称',
  },
  price: {
    required: true,
    message: '请输入礼物价格',
  },
  'goods.type': {
    required: true,
    message: '请选择是虚拟礼物或实物',
  },
  content: {
    required: true,
    message: '请输入虚拟礼物的具体内容',
    validator: (rule: FormItemRule, value: string) =>
      currentGoodsModel.value.goods.type != GoodsTypes.Virtual || (value?.length ?? 0) > 0
  },
  privacy: {
    required: true,
    message: '需要阅读并同意本站隐私协议',
    validator: (rule: FormItemRule, value: boolean) =>
      (currentGoodsModel.value.goods.type != GoodsTypes.Physical &&
      currentGoodsModel.value.goods.collectUrl != undefined) ||
      isAllowedPrivacyPolicy.value
  },
  maxBuyCount: {
    required: true,
    message: '需要输入最大购买数量',
    validator: (rule: FormItemRule, value: number) =>
      currentGoodsModel.value.goods.type != GoodsTypes.Physical ||
      (currentGoodsModel.value.goods.maxBuyCount ?? 0) > 0
  },
  'goods.url': {
    required: true,
    message: '请输入收集收货地址的链接',
    validator: (rule: FormItemRule, value: string) => {
      try {
        new URL(value)
        return true
      } catch (err) {
        return false
      }
    },
  },
}

// 方法
async function setFunctionEnable(enable: boolean) {
  const success = enable ? await EnableFunction(FunctionTypes.Point) : await DisableFunction(FunctionTypes.Point)

  if (success) {
    message.success('已' + (enable ? '启用' : '禁用') + '积分系统')
  } else {
    message.error('无法' + (enable ? '启用' : '禁用') + '积分系统')
  }
}

async function updateGoods(e: MouseEvent) {
  if (isUpdating.value || !formRef.value) return
  e.preventDefault()
  isUpdating.value = true

  try {
    await formRef.value.validate()

    if (currentGoodsModel.value.fileList.length > 0) {
      currentGoodsModel.value.goods.cover = await getImageUploadModel(currentGoodsModel.value.fileList)
    }

    const { code, data, message: errMsg } = await QueryPostAPI<ResponsePointGoodModel>(
      POINT_API_URL + 'update-goods',
      currentGoodsModel.value.goods
    )

    if (code === 200) {
      message.success('成功')
      showAddGoodsModal.value = false
      currentGoodsModel.value = JSON.parse(JSON.stringify(defaultGoodsModel))

      const index = goods.value.findIndex(g => g.id === data.id)
      if (index >= 0) {
        goods.value[index] = data
      } else {
        goods.value.push(data)
      }
    } else {
      message.error('失败: ' + errMsg)
    }
  } catch (err) {
    console.error(err)
    message.error(typeof err === 'string' ? `失败: ${err}` : '表单验证失败')
  } finally {
    isUpdating.value = false
  }
}

function OnFileListChange(files: UploadFileInfo[]) {
  if (files.length === 1 && (files[0].file?.size ?? 0) > 10 * 1024 * 1024) {
    message.error('文件大小不能超过10MB')
    currentGoodsModel.value.fileList = []
  }
}

function onUpdateClick(item: ResponsePointGoodModel) {
  currentGoodsModel.value = {
    goods: {
      ...item,
      count: item.count,
      cover: undefined,
    },
    fileList: item.cover
      ? [
        {
          id: item.cover ?? 'cover',
          thumbnailUrl: FILE_BASE_URL + item.cover,
          name: '封面',
          status: 'finished',
        },
      ]
      : [],
  }
  isAllowedPrivacyPolicy.value = true
  showAddGoodsModal.value = true
}

async function onSetShelfClick(item: ResponsePointGoodModel, status: GoodsStatus) {
  const d = dialog.warning({
    title: '警告',
    content: `你确定要${status == GoodsStatus.Normal ? '重新上架' : '下架'}这个礼物吗？`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      d.loading = true
      const originStatus = item.status

      try {
        const { code, message: errMsg } = await QueryPostAPI(POINT_API_URL + 'update-goods-status', {
          ids: [item.id],
          status: status,
        })

        if (code === 200) {
          message.success('成功')
          const index = goods.value.findIndex(g => g.id === item.id)
          if (index > -1) {
            goods.value[index].status = status
          }
        } else {
          message.error('失败: ' + errMsg)
          item.status = originStatus
          console.error(errMsg)
        }
      } catch (err) {
        message.error('失败: ' + err)
        item.status = originStatus
        console.error(err)
      } finally {
        d.loading = false
      }
    },
  })
}

function onDeleteClick(item: ResponsePointGoodModel) {
  const d = dialog.warning({
    title: '警告',
    content: '你确定要删除这个礼物吗？',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      d.loading = true

      try {
        const { code, message: errMsg } = await QueryGetAPI(POINT_API_URL + 'delete-goods', {
          id: item.id,
        })

        if (code === 200) {
          message.success('成功')
          goods.value = goods.value.filter(g => g.id !== item.id)
        } else {
          message.error('失败: ' + errMsg)
          console.error(errMsg)
        }
      } catch (err) {
        message.error('失败: ' + err)
        console.error(err)
      } finally {
        d.loading = false
      }
    },
  })
}

function onModalOpen() {
  if (currentGoodsModel.value.goods.id) {
    resetGoods()
  }
  showAddGoodsModal.value = true
}

function resetGoods() {
  currentGoodsModel.value = JSON.parse(JSON.stringify(defaultGoodsModel))
}

onMounted(() => { })
</script>

<template>
  <!-- 头部状态卡片 -->
  <NFlex
    vertical
    :size="16"
  >
    <NFlex
      justify="space-between"
      align="center"
      :gap="16"
    >
      <NAlert
        :type="accountInfo.settings.enableFunctions.includes(FunctionTypes.Point) && accountInfo.eventFetcherState.online
          ? 'success'
          : 'warning'
        "
        style="flex: 1; min-width: 300px"
      >
        <NFlex
          align="center"
          :gap="8"
        >
          <span>启用</span>
          <NButton
            text
            type="primary"
            tag="a"
            href="https://www.wolai.com/ueENtfAm9gPEqHrAVSB2Co"
            target="_blank"
          >
            积分系统
          </NButton>
          <NDivider vertical />
          <NSwitch
            :value="accountInfo?.settings.enableFunctions.includes(FunctionTypes.Point)"
            @update:value="setFunctionEnable"
          />
        </NFlex>
        <NText
          depth="3"
          style="margin-top: 8px; display: block"
        >
          此功能需要部署
          <NButton
            text
            type="primary"
            tag="a"
            href="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs"
            target="_blank"
          >
            VtsuruEventFetcher
          </NButton>
          , 否则将无法记录各种事件
        </NText>
      </NAlert>
      <EventFetcherStatusCard />
    </NFlex>

    <!-- 礼物展示页链接 -->
    <NDivider
      style="margin: 16px 0"
      title-placement="left"
    >
      礼物展示页链接
    </NDivider>

    <NFlex
      align="center"
      :gap="12"
    >
      <NInputGroup style="max-width: 400px;">
        <NInput
          :value="`${useCNUrl ? CN_HOST : CURRENT_HOST}@${accountInfo.name}/goods`"
          readonly
        />
        <NButton
          secondary
          @click="copyToClipboard(`${useCNUrl ? CN_HOST : CURRENT_HOST}@${accountInfo.name}/goods`)"
        >
          复制
        </NButton>
      </NInputGroup>
      <NCheckbox v-model:checked="useCNUrl">
        使用国内镜像(访问更快)
      </NCheckbox>
    </NFlex>
  </NFlex>

  <NDivider style="margin: 16px 0" />

  <!-- 主要内容标签页 -->
  <NTabs
    v-model:value="hash"
    animated
    style="margin-top: 8px"
  >
    <!-- 礼物管理标签页 -->
    <NTabPane
      name="goods"
      tab="礼物"
    >
      <NFlex
        justify="start"
        :gap="12"
        style="margin-bottom: 16px"
      >
        <NButton
          type="primary"
          @click="onModalOpen"
        >
          添加礼物
        </NButton>
        <NButton
          secondary
          @click="$router.push({ name: 'user-goods', params: { id: accountInfo?.name } })"
        >
          前往展示页
        </NButton>
      </NFlex>

      <!-- 上架礼物列表 -->
      <NEmpty
        v-if="goods.filter((g) => g.status != GoodsStatus.Discontinued).length == 0"
        description="暂无礼物"
      />
      <NGrid
        v-else
        cols="1 500:2 700:3 1000:4 1200:5"
        :x-gap="16"
        :y-gap="16"
      >
        <NGridItem
          v-for="item in goods.filter((g) => g.status != GoodsStatus.Discontinued)"
          :key="item.id"
        >
          <PointGoodsItem
            :goods="item"
            class="point-goods-card"
          >
            <template #footer>
              <NFlex
                vertical
                :gap="8"
                style="width: 100%"
              >
                <span>价格: {{ item.price }}</span>
                <NFlex
                  justify="space-between"
                  :gap="8"
                >
                  <NButton
                    type="info"
                    size="small"
                    @click="onUpdateClick(item)"
                  >
                    修改
                  </NButton>
                  <NButton
                    type="warning"
                    size="small"
                    @click="onSetShelfClick(item, GoodsStatus.Discontinued)"
                  >
                    下架
                  </NButton>
                  <NButton
                    type="error"
                    size="small"
                    @click="onDeleteClick(item)"
                  >
                    删除
                  </NButton>
                </NFlex>
              </NFlex>
            </template>
          </PointGoodsItem>
        </NGridItem>
      </NGrid>

      <!-- 下架礼物列表 -->
      <NDivider style="margin: 24px 0 16px">
        已下架
      </NDivider>
      <NEmpty
        v-if="goods.filter((g) => g.status == GoodsStatus.Discontinued).length == 0"
        description="暂无已下架的礼物"
      />
      <NGrid
        v-else
        cols="1 500:2 700:3 1000:4 1200:5"
        :x-gap="16"
        :y-gap="16"
      >
        <NGridItem
          v-for="item in goods.filter((g) => g.status == GoodsStatus.Discontinued)"
          :key="item.id"
        >
          <PointGoodsItem
            :goods="item"
            class="point-goods-card"
          >
            <template #footer>
              <NFlex
                vertical
                :gap="8"
                style="width: 100%"
              >
                <span>价格: {{ item.price }}</span>
                <NFlex
                  justify="space-between"
                  :gap="8"
                >
                  <NButton
                    type="info"
                    size="small"
                    @click="onUpdateClick(item)"
                  >
                    修改
                  </NButton>
                  <NButton
                    type="success"
                    size="small"
                    @click="onSetShelfClick(item, GoodsStatus.Normal)"
                  >
                    上架
                  </NButton>
                  <NButton
                    type="error"
                    size="small"
                    @click="onDeleteClick(item)"
                  >
                    删除
                  </NButton>
                </NFlex>
              </NFlex>
            </template>
          </PointGoodsItem>
        </NGridItem>
      </NGrid>
    </NTabPane>

    <!-- 订单管理标签页 -->
    <NTabPane
      name="orders"
      tab="订单"
      display-directive="show:lazy"
    >
      <PointOrderManage :goods="goods" />
    </NTabPane>

    <!-- 用户管理标签页 -->
    <NTabPane
      name="users"
      tab="用户"
      display-directive="show:lazy"
    >
      <PointUserManage :goods="goods" />
    </NTabPane>

    <!-- 设置标签页 -->
    <NTabPane
      name="settings"
      tab="设置"
      display-directive="show:lazy"
    >
      <PointSettings />
    </NTabPane>
  </NTabs>

  <!-- 添加/修改礼物模态框 -->
  <NModal
    v-model:show="showAddGoodsModal"
    preset="card"
    style="width: 600px; max-width: 90%"
    title="添加/修改礼物信息"
    class="goods-modal"
  >
    <template #header-extra>
      <NPopconfirm
        v-if="!currentGoodsModel.goods.id"
        @positive-click="resetGoods"
      >
        <template #trigger>
          <NButton
            type="warning"
            size="small"
          >
            重置
          </NButton>
        </template>
        确定要重置此页面内容?
      </NPopconfirm>
    </template>
    <NScrollbar style="max-height: 80vh">
      <NForm
        ref="formRef"
        :model="currentGoodsModel"
        :rules="rules"
        style="width: 100%"
      >
        <!-- 基本信息分组 -->
        <NDivider
          title-placement="left"
          style="margin: 8px 0 16px"
        >
          基本信息
        </NDivider>
        <NFlex
          vertical
          :gap="12"
          style="margin-bottom: 16px"
        >
          <NFormItem
            path="goods.name"
            label="名称"
            required
          >
            <NInput
              v-model:value="currentGoodsModel.goods.name"
              placeholder="必填, 礼物名称"
            />
          </NFormItem>

          <NFormItem
            path="goods.price"
            label="所需积分"
            required
          >
            <NInputNumber
              v-model:value="currentGoodsModel.goods.price"
              placeholder="必填, 兑换所需要的积分"
              min="0"
            />
          </NFormItem>

          <NFormItem
            path="goods.count"
            label="库存"
          >
            <NFlex
              :gap="12"
              align="center"
            >
              <NCheckbox
                :checked="!currentGoodsModel.goods.count"
                @update:checked="(v) => (currentGoodsModel.goods.count = v ? undefined : 100)"
              >
                不限
              </NCheckbox>
              <NInputNumber
                v-if="currentGoodsModel.goods.count"
                v-model:value="currentGoodsModel.goods.count"
                placeholder="礼物库存"
                style="max-width: 120px"
              />
            </NFlex>
          </NFormItem>
        </NFlex>

        <!-- 详细描述分组 -->
        <NDivider
          title-placement="left"
          style="margin: 16px 0"
        >
          详细描述
        </NDivider>
        <NFlex
          vertical
          :gap="12"
          style="margin-bottom: 16px"
        >
          <NFormItem
            path="goods.description"
            label="描述"
          >
            <NInput
              v-model:value="currentGoodsModel.goods.description"
              placeholder="可选, 礼物描述"
              maxlength="500"
              type="textarea"
            />
          </NFormItem>

          <NFormItem
            path="goods.tags"
            label="标签"
          >
            <NSelect
              v-model:value="currentGoodsModel.goods.tags"
              filterable
              multiple
              clearable
              tag
              placeholder="可选，输入后按回车添加"
              :options="existTags"
            />
          </NFormItem>

          <NFormItem
            path="goods.cover"
            label="封面"
          >
            <NFlex
              vertical
              :gap="8"
            >
              <NFlex
                v-if="currentGoodsModel.goods.cover"
                :gap="8"
                align="center"
              >
                <NText>当前封面: </NText>
                <NImage
                  :src="FILE_BASE_URL + currentGoodsModel.goods.cover"
                  height="50"
                  object-fit="cover"
                />
              </NFlex>
              <NUpload
                v-model:file-list="currentGoodsModel.fileList"
                :max="1"
                accept=".png,.jpg,.jpeg,.gif,.svg,.webp,.ico,.bmp,.tif,.tiff,.jfif,.jpe,.jp,.psd,."
                list-type="image-card"
                :default-upload="false"
                @update:file-list="OnFileListChange"
              >
                + {{ currentGoodsModel.goods.cover ? '更换' : '上传' }}封面
              </NUpload>
            </NFlex>
          </NFormItem>
        </NFlex>

        <!-- 兑换规则分组 -->
        <NDivider
          title-placement="left"
          style="margin: 16px 0"
        >
          兑换规则
        </NDivider>
        <NFlex
          vertical
          :gap="12"
          style="margin-bottom: 16px"
        >
          <NFormItem
            path="goods.type"
            label="礼物类型"
          >
            <NRadioGroup v-model:value="currentGoodsModel.goods.type">
              <NRadioButton :value="GoodsTypes.Virtual">
                虚拟礼物
              </NRadioButton>
              <NRadioButton :value="GoodsTypes.Physical">
                实体礼物
              </NRadioButton>
            </NRadioGroup>
          </NFormItem>

          <NFormItem
            path="settings"
            label="选项"
          >
            <NCheckbox v-model:checked="currentGoodsModel.goods.isAllowRebuy">
              允许重复兑换
            </NCheckbox>
          </NFormItem>

          <NFormItem
            path="goods.guardFree"
            label="特殊权限"
          >
            <NFlex
              vertical
              :gap="8"
            >
              <NCheckbox
                :checked="currentGoodsModel.goods.setting?.guardFree != undefined"
                @update:checked="
                  (v) => {
                    // @ts-ignore
                    currentGoodsModel.goods.setting.guardFree = v ? { year: undefined, month: undefined } : undefined
                  }
                "
              >
                允许舰长免费兑换
                <NTooltip>
                  <template #trigger>
                    <NIcon :component="Info24Filled" />
                  </template>
                  仅当
                  <NButton
                    type="info"
                    text
                    tag="a"
                    href="/manage/event"
                    target="_blank"
                  >
                    舰长和SC
                  </NButton>
                  中存在对应记录时才能生效
                </NTooltip>
              </NCheckbox>

              <NFlex
                v-if="currentGoodsModel.goods.setting?.guardFree"
                :gap="8"
              >
                <NSelect
                  v-model:value="currentGoodsModel.goods.setting.guardFree.year"
                  :options="allowedYearOptions"
                  placeholder="请选择年份"
                />
                <NSelect
                  v-model:value="currentGoodsModel.goods.setting.guardFree.month"
                  :options="allowedMonthOptions"
                  placeholder="请选择月份"
                />
              </NFlex>

              <NText>
                最低兑换等级
                <NTooltip>
                  <template #trigger>
                    <NIcon :component="Info24Filled" />
                  </template>
                  仅当
                  <NButton
                    type="info"
                    text
                    tag="a"
                    href="/manage/event"
                    target="_blank"
                  >
                    舰长和SC
                  </NButton>
                  中存在对应记录时才能生效
                </NTooltip>
              </NText>

              <NRadioGroup v-model:value="currentGoodsModel.goods.setting.allowGuardLevel">
                <NRadioButton :value="0">
                  不限
                </NRadioButton>
                <NRadioButton :value="1">
                  总督
                </NRadioButton>
                <NRadioButton :value="2">
                  提督
                </NRadioButton>
                <NRadioButton :value="3">
                  舰长
                </NRadioButton>
              </NRadioGroup>
            </NFlex>
          </NFormItem>
        </NFlex>

        <!-- 礼物类型特定配置 -->
        <template v-if="currentGoodsModel.goods.type == GoodsTypes.Physical">
          <NDivider
            title-placement="left"
            style="margin: 16px 0"
          >
            实物礼物配置
          </NDivider>
          <NFlex
            vertical
            :gap="12"
            style="margin-bottom: 16px"
          >
            <NFormItem
              path="goods.maxBuyCount"
              label="最大兑换数量"
            >
              <NInputNumber
                v-model:value="currentGoodsModel.goods.maxBuyCount"
                placeholder="必填, 最大兑换数量"
                min="1"
              />
            </NFormItem>

            <NFormItem
              path="address"
              label="收货地址"
            >
              <NFlex
                vertical
                :gap="8"
              >
                <NRadioGroup
                  :value="currentGoodsModel.goods.collectUrl == undefined ? 0 : 1"
                  @update:value="(v) => (currentGoodsModel.goods.collectUrl = v == 1 ? '' : undefined)"
                >
                  <NRadioButton :value="0">
                    通过本站收集收货地址
                  </NRadioButton>
                  <NRadioButton :value="1">
                    使用站外链接收集地址
                    <NTooltip>
                      <template #trigger>
                        <NIcon :component="Info24Filled" />
                      </template>
                      用腾讯文档等工具收集收货地址
                    </NTooltip>
                  </NRadioButton>
                </NRadioGroup>
              </NFlex>
            </NFormItem>

            <template v-if="currentGoodsModel.goods.collectUrl != undefined">
              <NFormItem
                path="goods.collectUrl"
                label="收集链接"
              >
                <NFlex
                  vertical
                  :gap="8"
                  style="width: 100%"
                >
                  <NInput
                    v-model:value="currentGoodsModel.goods.collectUrl"
                    placeholder="用于给用户填写自己收货地址的表格的分享链接"
                    maxlength="300"
                  />
                  <NCheckbox v-model:checked="currentGoodsModel.goods.embedCollectUrl">
                    尝试将收集链接嵌入到网页中
                  </NCheckbox>
                </NFlex>
              </NFormItem>
            </template>
            <template v-else>
              <NFormItem
                path="privacy"
                label="隐私协议"
                required
              >
                <NCheckbox v-model:checked="isAllowedPrivacyPolicy">
                  同意本站隐私协议
                </NCheckbox>
              </NFormItem>
            </template>
          </NFlex>
        </template>
        <template v-else>
          <NDivider
            title-placement="left"
            style="margin: 16px 0"
          >
            虚拟礼物配置
          </NDivider>
          <NFlex
            vertical
            :gap="12"
            style="margin-bottom: 16px"
          >
            <NFormItem
              path="goods.content"
              required
            >
              <template #label>
                礼物内容
                <NTooltip>
                  <template #trigger>
                    <NIcon :component="Info24Filled" />
                  </template>
                  虚拟礼物的具体内容, 网盘链接什么之类的
                </NTooltip>
              </template>
              <NInput
                v-model:value="currentGoodsModel.goods.content"
                type="textarea"
                placeholder="写这里咯"
                maxlength="10000"
                show-count
                clearable
              />
            </NFormItem>
          </NFlex>
        </template>

        <NFlex
          justify="center"
          style="margin-top: 24px"
        >
          <NButton
            type="primary"
            size="large"
            :loading="isUpdating"
            @click="updateGoods"
          >
            {{ currentGoodsModel.goods.id ? '修改' : '创建' }}
          </NButton>
        </NFlex>
      </NForm>
    </NScrollbar>
  </NModal>
</template>

<style scoped>
.point-goods-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.point-goods-card :deep(.n-card-header) {
  padding: 16px;
}

.point-goods-card :deep(.n-card-content) {
  padding: 16px;
  flex-grow: 1;
}

.point-goods-card :deep(.n-card-footer) {
  padding: 16px;
}

.goods-modal :deep(.n-card-header) {
  padding: 16px 20px;
}

.goods-modal :deep(.n-card-content) {
  padding: 0 20px 20px;
}
</style>
