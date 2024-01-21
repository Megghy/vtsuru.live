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
} from 'naive-ui'
import { computed, ref } from 'vue'

const message = useMessage()
const accountInfo = useAccount()
const dialog = useDialog()

const goods = ref<ResponsePointGoodModel[]>(await getGoods())
const currentGoodsModel = ref<PointGoodsModel>({
  type: GoodsTypes.Virtual,
  status: GoodsStatus.Normal,
} as PointGoodsModel)

const showAddGoodsModal = ref(false)

const isAllowedPrivacyPolicy = ref(false)
const isUpdating = ref(false)

const fileList = ref<UploadFileInfo[]>([])

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
      return currentGoodsModel.value.type != GoodsTypes.Virtual || (value?.length ?? 0) > 0
    },
  },
  privacy: {
    required: true,
    message: '需要阅读并同意本站隐私政策',
    validator: (rule: FormItemRule, value: boolean) => {
      return (currentGoodsModel.value.type != GoodsTypes.Physical && currentGoodsModel.value.collectUrl != undefined) || isAllowedPrivacyPolicy.value
    },
  },
}
const formRef = ref()

const existTags = computed(() => {
  if (goods.value.length == 0) {
    return []
  }
  //获取所有已存在商品的tags并去重
  const tempSet = new Set<TagInfo>()
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
    return { label: item.name, value: item.name }
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

async function getGoods() {
  try {
    var resp = await QueryGetAPI<ResponsePointGoodModel[]>(POINT_API_URL + 'get-goods', {
      id: accountInfo.value?.id,
    })
    if (resp.code == 200) {
      return resp.data
    } else {
      message.error('无法获取数据: ' + resp.message)
    }
  } catch (err) {
    message.error('无法获取数据: ' + err)
  }
  return []
}
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
      if (fileList.value.length > 0) {
        currentGoodsModel.value.cover = await getImageUploadModel(fileList.value)
      }
      await QueryPostAPI<ResponsePointGoodModel>(POINT_API_URL + 'update-goods', currentGoodsModel.value)
        .then((data) => {
          if (data.code == 200) {
            message.success('成功')
            showAddGoodsModal.value = false
            currentGoodsModel.value = {} as PointGoodsModel
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
      fileList.value = []
    }
  }
}
function onUpdateClick(item: ResponsePointGoodModel) {
  currentGoodsModel.value = {
    ...item,
    count: item.count ?? 0,
    cover: undefined,
  }
  fileList.value = [
    {
      id: item.cover ?? 'cover',
      thumbnailUrl: FILE_BASE_URL + item.cover,
      name: '封面',
      status: 'finished',
    },
  ]
  showAddGoodsModal.value = true
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
  <NTabs animated>
    <NTabPane name="goods" tab="礼物">
      <NFlex>
        <NButton type="primary" @click="showAddGoodsModal = true"> 添加礼物 </NButton>
      </NFlex>
      <NDivider />
      <NGrid cols="1 500:2 700:3 1000:4 1200:5" :x-gap="12" :y-gap="8">
        <NGridItem v-for="item in goods" :key="item.id">
          <PointGoodsItem :goods="item">
            <template #header-extra>
              <NDropdown :options="dropDownOptions" trigger="click" @select="(v) => dropDownActions[v].action(item)">
                <NButton text style="font-size: 24px">
                  <template #icon>
                    <NIcon :component="MoreVertical16Filled" />
                  </template>
                </NButton>
              </NDropdown>
            </template>
          </PointGoodsItem>
        </NGridItem>
      </NGrid>
    </NTabPane>
    <NTabPane name="orders" tab="订单">

    </NTabPane>
    <NTabPane name="users" tab="用户">

    </NTabPane>
    <NTabPane name="settings" tab="设置">
      
    </NTabPane>
  </NTabs>

  <NModal v-model:show="showAddGoodsModal" preset="card" style="width: 600px; max-width: 90%" title="添加/修改礼物信息">
    <NScrollbar style="max-height: 80vh">
      <NForm ref="formRef" :model="currentGoodsModel" :rules="rules" style="width: 95%">
        <NFormItem path="name" label="名称" required>
          <NInput v-model:value="currentGoodsModel.name" placeholder="必填, 礼物名称" />
        </NFormItem>
        <NFormItem path="price" label="所需积分" required>
          <NInputNumber v-model:value="currentGoodsModel.price" placeholder="必填, 兑换所需要的积分" min="0" />
        </NFormItem>
        <NFormItem path="count" label="库存">
          <NCheckbox :checked="currentGoodsModel.count && currentGoodsModel.count < 0" @update:checked="(v) => (currentGoodsModel.count = v ? -1 : 100)"> 不限 </NCheckbox>
          <NInputNumber v-if="currentGoodsModel.count > -1" v-model:value="currentGoodsModel.count" placeholder="可选, 礼物库存" style="max-width: 120px;"/>
        </NFormItem>
        <NFormItem path="description" label="描述">
          <NInput v-model:value="currentGoodsModel.description" placeholder="可选, 礼物描述" />
        </NFormItem>
        <NFormItem path="tags" label="标签">
          <NSelect :value="currentGoodsModel.tags?.map((tag) => tag.name)" filterable multiple clearable tag placeholder="可选，输入后按回车添加" :options="existTags" />
        </NFormItem>
        <NFormItem path="cover" label="封面">
          <NFlex v-if="currentGoodsModel.cover">
            <NText>当前封面: </NText>
            <NImage :src="FILE_BASE_URL + currentGoodsModel.cover" height="50" object-fit="cover" />
          </NFlex>
          <NUpload
            :max="1"
            accept=".png,.jpg,.jpeg,.gif,.svg,.webp,.ico,.bmp,.tif,.tiff,.jfif,.jpe,.jp,.psd,."
            list-type="image-card"
            :default-upload="false"
            v-model:file-list="fileList"
            @update:file-list="OnFileListChange"
          >
            + {{ currentGoodsModel.cover ? '更换' : '上传' }}封面
          </NUpload>
        </NFormItem>
        <NFormItem path="type" label="类型">
          <NRadioGroup v-model:value="currentGoodsModel.type">
            <NRadioButton :value="GoodsTypes.Virtual">虚拟礼物</NRadioButton>
            <NRadioButton :value="GoodsTypes.Physical">实体礼物</NRadioButton>
          </NRadioGroup>
        </NFormItem>
        <template v-if="currentGoodsModel.type == GoodsTypes.Physical">
          <NFormItem path="collectUrl" label="收货地址">
            <NFlex vertical>
              <NRadioGroup :value="currentGoodsModel.collectUrl == undefined ? 0 : 1" @update:value="(v) => (currentGoodsModel.collectUrl = v == 1 ? '' : undefined)">
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
          <template v-if="currentGoodsModel.collectUrl != undefined">
            <NFormItem path="url" label="收集链接">
              <NInput v-model:value="currentGoodsModel.collectUrl" placeholder="用于给用户填写自己收货地址的表格的分享链接" />
            </NFormItem>
            <NFormItem label="内嵌收集链接">
              <NCheckbox v-model:checked="currentGoodsModel.embedCollectUrl"> 尝试将收集链接嵌入到网页中 </NCheckbox>
            </NFormItem>
          </template>
          <template v-else>
            <NFormItem path="privacy" label="隐私策略" required>
              <NCheckbox v-model:checked="isAllowedPrivacyPolicy"> 同意本站隐私策略 </NCheckbox>
            </NFormItem>
          </template>
        </template>
        <template v-else>
          <NFormItem path="content" required>
            <template #label>
              礼物内容
              <NTooltip>
                <template #trigger>
                  <NIcon :component="Info24Filled" />
                </template>
                虚拟礼物的具体内容, 网盘链接什么之类的
              </NTooltip>
            </template>
            <NInput v-model:value="currentGoodsModel.content" type="textarea" placeholder="写这里咯" maxlength="10000" show-count clearable />
          </NFormItem>
        </template>
        <NButton @click="updateGoods" type="primary" :loading="isUpdating"> 添加 </NButton>
      </NForm>
    </NScrollbar>
  </NModal>
</template>
