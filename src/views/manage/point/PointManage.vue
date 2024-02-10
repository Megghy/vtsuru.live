<script setup lang="ts">
import { getBase64, getImageUploadModel } from '@/Utils'
import { DisableFunction, EnableFunction, useAccount } from '@/api/account'
import { ResponsePointGoodModel, FunctionTypes, PointGoodsModel, GoodsTypes, GoodsStatus, TagInfo } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import PointGoodsItem from '@/components/manage/PointGoodsItem.vue'
import { FILE_BASE_URL, POINT_API_URL } from '@/data/constants'
import { Info24Filled, MoreVertical16Filled } from '@vicons/fluent'
import { List } from 'linqts'
import {
  NAlert,
  NButton,
  NDivider,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSwitch,
  NTabPane,
  NTabs,
  NText,
  useMessage,
  NFlex,
  NInputNumber,
  NRadioGroup,
  NRadio,
  NTooltip,
  NIcon,
  NCheckbox,
  NRadioButton,
  NUpload,
  UploadFileInfo,
  FormItemRule,
  NScrollbar,
  FormValidationError,
  NSelect,
  NGrid,
  NGridItem,
  NDropdown,
  NImage,
  useDialog,
  NPopconfirm,
  NEmpty,
} from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import PointOrderManage from './PointOrderManage.vue'
import PointUserManage from './PointUserManage.vue'
import { cloneFnJSON } from '@vueuse/core'
import { useAuthStore } from '@/store/useAuthStore'
import PointSettings from './PointSettings.vue'
import { useRouteHash } from '@vueuse/router'

const message = useMessage()
const accountInfo = useAccount()
const dialog = useDialog()
const useBiliAuth = useAuthStore()

const realHash = useRouteHash('goods', {
  mode: 'replace',
})
const hash = computed({
  get() {
    return realHash.value?.slice(1) ?? ''
  },
  set(val) {
    realHash.value = '#' + val
  },
})

const goods = ref<ResponsePointGoodModel[]>(await useBiliAuth.GetGoods(accountInfo.value?.id, message))
const defaultGoodsModel = {
  goods: {
    type: GoodsTypes.Virtual,
    status: GoodsStatus.Normal,
    maxBuyCount: 1,
    isAllowRebuy: false,
  } as PointGoodsModel,
  fileList: [],
} as { goods: PointGoodsModel; fileList: UploadFileInfo[] }
const currentGoodsModel = ref<{ goods: PointGoodsModel; fileList: UploadFileInfo[] }>(JSON.parse(JSON.stringify(defaultGoodsModel)))

const showAddGoodsModal = ref(false)

const isAllowedPrivacyPolicy = ref(false)
const isUpdating = ref(false)

const rules = {
  name: {
    required: true,
    message: '请输入礼物名称',
  },
  price: {
    required: true,
    message: '请输入礼物价格',
  },
  content: {
    required: true,
    message: '请输入虚拟礼物的具体内容',
    validator: (rule: FormItemRule, value: string) => {
      return currentGoodsModel.value.goods.type != GoodsTypes.Virtual || (value?.length ?? 0) > 0
    },
  },
  privacy: {
    required: true,
    message: '需要阅读并同意本站隐私政策',
    validator: (rule: FormItemRule, value: boolean) => {
      return (
        (currentGoodsModel.value.goods.type != GoodsTypes.Physical && currentGoodsModel.value.goods.collectUrl != undefined) ||
        isAllowedPrivacyPolicy.value
      )
    },
  },
  maxBuyCount: {
    required: true,
    message: '需要输入最大购买数量',
    validator: (rule: FormItemRule, value: number) => {
      return currentGoodsModel.value.goods.type != GoodsTypes.Physical || (currentGoodsModel.value.goods.maxBuyCount ?? 0) > 0
    },
  },
}
const formRef = ref()

const existTags = computed(() => {
  if (goods.value.length == 0) {
    return []
  }
  //获取所有已存在商品的tags并去重
  const tempSet = new Set<string>()
  for (let i = 0; i < goods.value.length; i++) {
    const goodsTags = goods.value[i].tags
    if (!goodsTags || goodsTags.length == 0) {
      continue
    }
    for (let j = 0; j < goods.value[i].tags.length; j++) {
      tempSet.add(goods.value[i].tags[j])
    }
  }
  return Array.from(tempSet).map((item) => {
    return { label: item, value: item }
  })
})

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
const dropDownOptions = computed(() => {
  return Object.values(dropDownActions)
})

async function setFunctionEnable(enable: boolean) {
  let success = false
  if (enable) {
    success = await EnableFunction(FunctionTypes.Point)
  } else {
    success = await DisableFunction(FunctionTypes.Point)
  }
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
  await formRef.value
    .validate()
    .then(async () => {
      if (currentGoodsModel.value.fileList.length > 0) {
        currentGoodsModel.value.goods.cover = await getImageUploadModel(currentGoodsModel.value.fileList)
      }
      await QueryPostAPI<ResponsePointGoodModel>(POINT_API_URL + 'update-goods', currentGoodsModel.value.goods)
        .then((data) => {
          if (data.code == 200) {
            message.success('成功')
            showAddGoodsModal.value = false
            currentGoodsModel.value.goods = {} as PointGoodsModel
            if (goods.value.find((g) => g.id == data.data.id)) {
              goods.value[goods.value.findIndex((g) => g.id == data.data.id)] = data.data
            } else {
              goods.value.push(data.data)
            }
          } else {
            message.error('失败: ' + data.message)
          }
        })
        .catch((err) => {
          message.error('失败: ' + err)
          console.error(err)
        })
    })
    .catch((err: unknown) => {
      console.log(err)
      message.error('表单验证失败')
    })
    .finally(() => {
      isUpdating.value = false
    })
}
function OnFileListChange(files: UploadFileInfo[]) {
  if (files.length == 1) {
    var file = files[0]
    if ((file.file?.size ?? 0) > 10 * 1024 * 1024) {
      message.error('文件大小不能超过10MB')
      currentGoodsModel.value.fileList = []
    }
  }
}
function onUpdateClick(item: ResponsePointGoodModel) {
  currentGoodsModel.value = {
    goods: {
      ...item,
      count: item.count ?? 0,
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
//下架
function onSetShelfClick(item: ResponsePointGoodModel, status: GoodsStatus) {
  const d = dialog.warning({
    title: '警告',
    content: `你确定要${status == GoodsStatus.Normal ? '重新上架' : '下架'}这个礼物吗？`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      d.loading = true
      const originStatus = item.status
      //item.status = status
      try {
        const data = await QueryPostAPI(POINT_API_URL + 'update-goods-status', {
          ids: [item.id],
          status: status,
        })
        if (data.code == 200) {
          message.success('成功')
          const index = goods.value.findIndex((g) => g.id == item.id)
          if (index > -1) {
            goods.value[index].status = status
          }
        } else {
          message.error('失败: ' + data.message)
          item.status = originStatus
          console.error(data.message)
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
        const data = await QueryGetAPI(POINT_API_URL + 'delete-goods', {
          id: item.id,
        })
        if (data.code == 200) {
          message.success('成功')
          goods.value = goods.value.filter((g) => g.id != item.id)
        } else {
          message.error('失败: ' + data.message)
          console.error(data.message)
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
function responseGoodsToModel(goods: ResponsePointGoodModel) {}

onMounted(() => {
  if (!hash.value) {
    hash.value = 'goods'
  }
})
</script>

<template>
  <NAlert type="info">
    启用积分系统
    <NSwitch :value="accountInfo?.settings.enableFunctions.includes(FunctionTypes.Point)" @update:value="setFunctionEnable" />
    <br />
    <NText depth="3">
      此功能需要部署
      <NButton text type="primary" tag="a" href="https://www.yuque.com/megghy/dez70g/vfvcyv3024xvaa1p" target="_blank"> VtsuruEventFetcher </NButton>
    </NText>
  </NAlert>
  <NDivider />
  <NTabs animated v-model:value="hash">
    <NTabPane name="goods" tab="礼物">
      <NFlex>
        <NButton type="primary" @click="onModalOpen"> 添加礼物 </NButton>
      </NFlex>
      <NDivider />
      <NGrid cols="1 500:2 700:3 1000:4 1200:5" :x-gap="12" :y-gap="8">
        <NGridItem v-for="item in goods.filter((g) => g.status != GoodsStatus.Discontinued)" :key="item.id">
          <PointGoodsItem :goods="item">
            <template #footer>
              <NFlex>
                <NButton type="info" size="small" @click="onUpdateClick(item)"> 修改 </NButton>
                <NButton type="warning" size="small" @click="onSetShelfClick(item, GoodsStatus.Discontinued)"> 下架 </NButton>
                <NButton type="error" size="small" @click="onDeleteClick(item)"> 删除 </NButton>
              </NFlex>
            </template>
          </PointGoodsItem>
        </NGridItem>
      </NGrid>
      <NDivider>已下架</NDivider>
      <NEmpty v-if="goods.filter((g) => g.status == GoodsStatus.Discontinued).length == 0" description="暂无已下架的物品" />
      <NGrid v-else cols="1 500:2 700:3 1000:4 1200:5" :x-gap="12" :y-gap="8">
        <NGridItem v-for="item in goods.filter((g) => g.status == GoodsStatus.Discontinued)" :key="item.id">
          <PointGoodsItem :goods="item">
            <template #footer>
              <NFlex>
                <NButton type="info" size="small" @click="onUpdateClick(item)"> 修改 </NButton>
                <NButton type="success" size="small" @click="onSetShelfClick(item, GoodsStatus.Normal)"> 上架 </NButton>
                <NButton type="error" size="small" @click="onDeleteClick(item)"> 删除 </NButton>
              </NFlex>
            </template>
          </PointGoodsItem>
        </NGridItem>
      </NGrid>
    </NTabPane>
    <NTabPane name="orders" tab="订单" display-directive="show:lazy">
      <PointOrderManage :goods="goods" />
    </NTabPane>
    <NTabPane name="users" tab="用户" display-directive="show:lazy">
      <PointUserManage />
    </NTabPane>
    <NTabPane name="settings" tab="设置" display-directive="show:lazy">
      <PointSettings />
    </NTabPane>
  </NTabs>
  <NDivider />
  <NModal v-model:show="showAddGoodsModal" preset="card" style="width: 600px; max-width: 90%" title="添加/修改礼物信息">
    <template #header-extra>
      <NPopconfirm v-if="!currentGoodsModel.goods.id" @positive-click="resetGoods">
        <template #trigger>
          <NButton type="warning" size="small"> 重置 </NButton>
        </template>
        确定要重置此页面内容?
      </NPopconfirm>
    </template>
    <NScrollbar style="max-height: 80vh">
      <NForm ref="formRef" :model="currentGoodsModel" :rules="rules" style="width: 95%">
        <NFormItem path="goods.name" label="名称" required>
          <NInput v-model:value="currentGoodsModel.goods.name" placeholder="必填, 礼物名称" />
        </NFormItem>
        <NFormItem path="goods.price" label="所需积分" required>
          <NInputNumber v-model:value="currentGoodsModel.goods.price" placeholder="必填, 兑换所需要的积分" min="0" />
        </NFormItem>
        <NFormItem path="goods.count" label="库存">
          <NCheckbox
            :checked="currentGoodsModel.goods.count && currentGoodsModel.goods.count < 0"
            @update:checked="(v) => (currentGoodsModel.goods.count = v ? -1 : 100)"
          >
            不限
          </NCheckbox>
          <NInputNumber
            v-if="currentGoodsModel.goods.count > -1"
            v-model:value="currentGoodsModel.goods.count"
            placeholder="可选, 礼物库存"
            style="max-width: 120px"
          />
        </NFormItem>
        <NFormItem path="goods.description" label="描述">
          <NInput v-model:value="currentGoodsModel.goods.description" placeholder="可选, 礼物描述" maxlength="500" type="textarea" />
        </NFormItem>
        <NFormItem path="goods.tags" label="标签">
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
        <NFormItem path="goods.cover" label="封面">
          <NFlex v-if="currentGoodsModel.goods.cover">
            <NText>当前封面: </NText>
            <NImage :src="FILE_BASE_URL + currentGoodsModel.goods.cover" height="50" object-fit="cover" />
          </NFlex>
          <NUpload
            :max="1"
            accept=".png,.jpg,.jpeg,.gif,.svg,.webp,.ico,.bmp,.tif,.tiff,.jfif,.jpe,.jp,.psd,."
            list-type="image-card"
            :default-upload="false"
            v-model:file-list="currentGoodsModel.fileList"
            @update:file-list="OnFileListChange"
          >
            + {{ currentGoodsModel.goods.cover ? '更换' : '上传' }}封面
          </NUpload>
        </NFormItem>
        <NFormItem path="goods.type" label="类型">
          <NRadioGroup v-model:value="currentGoodsModel.goods.type">
            <NRadioButton :value="GoodsTypes.Virtual">虚拟礼物</NRadioButton>
            <NRadioButton :value="GoodsTypes.Physical">实体礼物</NRadioButton>
          </NRadioGroup>
        </NFormItem>
        <template v-if="currentGoodsModel.goods.type == GoodsTypes.Physical">
          <NFormItem path="settings" label="选项">
            <NCheckbox v-model:checked="currentGoodsModel.goods.isAllowRebuy">允许重复购买</NCheckbox>
          </NFormItem>
          <NFormItem path="goods.maxBuyCount" label="最大购买数量">
            <NInputNumber v-model:value="currentGoodsModel.goods.maxBuyCount" placeholder="必填, 最大购买数量" min="1" />
          </NFormItem>
          <NFormItem path="goods.collectUrl" label="收货地址">
            <NFlex vertical>
              <NRadioGroup
                :value="currentGoodsModel.goods.collectUrl == undefined ? 0 : 1"
                @update:value="(v) => (currentGoodsModel.goods.collectUrl = v == 1 ? '' : undefined)"
              >
                <NRadioButton :value="0">通过本站收集收货地址</NRadioButton>
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
            <NFormItem path="goods.url" label="收集链接">
              <NFlex vertical style="width: 100%">
                <NInput v-model:value="currentGoodsModel.goods.collectUrl" placeholder="用于给用户填写自己收货地址的表格的分享链接" maxlength="300" />
                <NCheckbox v-model:checked="currentGoodsModel.goods.embedCollectUrl"> 尝试将收集链接嵌入到网页中 </NCheckbox>
              </NFlex>
            </NFormItem>
          </template>
          <template v-else>
            <NFormItem path="privacy" label="隐私策略" required>
              <NCheckbox v-model:checked="isAllowedPrivacyPolicy"> 同意本站隐私协议 </NCheckbox>
            </NFormItem>
          </template>
        </template>
        <template v-else>
          <NFormItem path="goods.content" required>
            <template #label>
              礼物内容
              <NTooltip>
                <template #trigger>
                  <NIcon :component="Info24Filled" />
                </template>
                虚拟礼物的具体内容, 网盘链接什么之类的
              </NTooltip>
            </template>
            <NInput v-model:value="currentGoodsModel.goods.content" type="textarea" placeholder="写这里咯" maxlength="10000" show-count clearable />
          </NFormItem>
        </template>
        <NButton @click="updateGoods" type="primary" :loading="isUpdating"> {{ currentGoodsModel.goods.id ? '修改' : '创建' }} </NButton>
      </NForm>
    </NScrollbar>
  </NModal>
</template>
