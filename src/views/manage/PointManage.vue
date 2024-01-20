<script setup lang="ts">
import { getBase64 } from '@/Utils'
import { DisableFunction, EnableFunction, useAccount } from '@/api/account'
import { ResponsePointGoodModel, FunctionTypes, PointGoodsModel, GoodsTypes, GoodsStatus, TagInfo } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { POINT_API_URL } from '@/data/constants'
import { Info24Filled } from '@vicons/fluent'
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
} from 'naive-ui'
import { computed, ref } from 'vue'

const message = useMessage()
const accountInfo = useAccount()

const goods = ref<ResponsePointGoodModel[]>(await getGoods())
const addGoodsModel = ref<PointGoodsModel>({
  type: GoodsTypes.Virtual,
  status: GoodsStatus.Normal,
} as PointGoodsModel)

const showAddGoodsModal = ref(false)

const isAllowedPrivacyPolicy = ref(false)

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
      return addGoodsModel.value.type != GoodsTypes.Virtual || (value?.length ?? 0) > 0
    },
  },
  privacy: {
    required: true,
    message: '需要阅读并同意本站隐私政策',
    validator: (rule: FormItemRule, value: boolean) => {
      return (addGoodsModel.value.type != GoodsTypes.Physical && addGoodsModel.value.collectUrl != undefined) || isAllowedPrivacyPolicy.value
    },
  },
}
const formRef = ref()

const existTags = computed(() => {
  //获取所有已存在商品的tags并去重
  const tempSet = new Set<TagInfo>()
  for (let i = 0; i < goods.value.length; i++) {
    for (let j = 0; j < goods.value[i].tags.length; j++) {
      tempSet.add(goods.value[i].tags[j])
    }
  }
  return Array.from(tempSet).map((item) => {
    return { label: item.name, value: item.id }
  })
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
  e.preventDefault()
  if (!formRef.value) return
  await formRef.value
    .validate()
    .then(async () => {
      if (fileList.value.length > 0) {
        addGoodsModel.value.coverImageBase64 = await getBase64(fileList.value[0].file)
      }
      await QueryPostAPI<ResponsePointGoodModel>(POINT_API_URL + 'update-goods', addGoodsModel.value)
        .then((data) => {
          if (data.code == 200) {
            message.success('成功')
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
  <NTabs>
    <NTabPane name="goods" tab="礼物">
      <NFlex>
        <NButton type="primary" @click="showAddGoodsModal = true"> 添加礼物 </NButton>
      </NFlex>
      <NDivider />
    </NTabPane>
  </NTabs>

  <NModal v-model:show="showAddGoodsModal" preset="card" style="width: 600px; max-width: 90%" title="添加礼物">
    <NScrollbar style="max-height: 80vh">
      <NForm ref="formRef" :model="addGoodsModel" :rules="rules">
        <NFormItem path="name" label="名称" required>
          <NInput v-model:value="addGoodsModel.name" placeholder="填写礼物名称" />
        </NFormItem>
        <NFormItem path="price" label="所需积分" required>
          <NInputNumber v-model:value="addGoodsModel.price" placeholder="填写需要的积分" min="0" />
        </NFormItem>
        <NFormItem path="description" label="描述" type="textarea">
          <NInput v-model:value="addGoodsModel.description" placeholder="填写礼物描述" />
        </NFormItem>
        <NFormItem path="tags" label="标签">
          <NSelect v-model:value="addGoodsModel.tags" filterable multiple clearable tag placeholder="可选，按回车确认" :options="existTags" />
        </NFormItem>
        <NFormItem path="cover" label="封面" type="textarea">
          <NUpload
            :max="1"
            accept=".png,.jpg,.jpeg,.gif,.svg,.webp,.ico,.bmp,.tif,.tiff,.jfif,.jpe,.jp,.psd,."
            list-type="image-card"
            :default-upload="false"
            v-model:file-list="fileList"
            @update:file-list="OnFileListChange"
          >
            + 上传图片
          </NUpload>
        </NFormItem>
        <NFormItem path="type" label="类型">
          <NRadioGroup v-model:value="addGoodsModel.type">
            <NRadioButton :value="GoodsTypes.Virtual">虚拟礼物</NRadioButton>
            <NRadioButton :value="GoodsTypes.Physical">实体礼物</NRadioButton>
          </NRadioGroup>
        </NFormItem>
        <template v-if="addGoodsModel.type == GoodsTypes.Physical">
          <NFormItem path="collectUrl" label="收货地址">
            <NFlex vertical>
              <NRadioGroup :value="addGoodsModel.collectUrl == undefined ? 0 : 1" @update:value="(v) => (addGoodsModel.collectUrl = v == 1 ? '' : undefined)">
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
          <template v-if="addGoodsModel.collectUrl != undefined">
            <NFormItem path="url" label="收集链接">
              <NInput v-model:value="addGoodsModel.collectUrl" placeholder="用于给用户填写自己收货地址的表格的分享链接" />
            </NFormItem>
            <NFormItem label="内嵌收集链接">
              <NCheckbox v-model:checked="addGoodsModel.embedCollectUrl"> 尝试将收集链接嵌入到网页中 </NCheckbox>
            </NFormItem>
          </template>
          <template v-else>
            <NFormItem path="privacy" label="隐私策略" required>
              <NCheckbox v-model:checked="isAllowedPrivacyPolicy"> 同意本站隐私策略 </NCheckbox>
            </NFormItem>
          </template>
        </template>
        <template v-else>
          <NFormItem path="content" label="礼物内容" required>
            <NInput
              v-model:value="addGoodsModel.content"
              style="min-height: 100px"
              type="textarea"
              placeholder="虚拟礼物的具体内容, 网盘链接什么之类的"
              maxlength="10000"
              show-count
              autosize
              clearable
            />
          </NFormItem>
        </template>
        <NButton @click="updateGoods" type="primary"> 添加 </NButton>
      </NForm>
    </NScrollbar>
  </NModal>
</template>
