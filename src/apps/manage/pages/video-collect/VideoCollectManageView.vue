<script setup lang="ts">
import type {
  FormRules,
} from 'naive-ui'
import type { VideoCollectTable } from '@/api/api-models'
import {
  NButton,
  NDatePicker,
  NEmpty,
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
  NIcon,
  NInput,
  NInputNumber,
  NModal,
  NSpin,
  NText,
  useMessage,
} from 'naive-ui'
import { Add20Regular } from '@vicons/fluent'
import { ref } from 'vue'
import { FunctionTypes } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import VideoCollectInfoCard from '@/components/VideoCollectInfoCard.vue'
import { VIDEO_COLLECT_API_URL } from '@/shared/config'

const message = useMessage()

const isLoading = ref(true)
const createModalVisible = ref(false)
const formRef = ref()
const defaultModel = { maxVideoCount: 50 } as VideoCollectTable
const createVideoModel = ref<VideoCollectTable>(JSON.parse(JSON.stringify(defaultModel)))

const videoTables = ref<VideoCollectTable[]>(await get())

const createRules: FormRules = {
  name: [
    {
      required: true,
      message: '请输入征集表名称',
    },
  ],
  endAt: [
    {
      required: true,
      message: '请输入结束日期',
    },
    {
      required: true,
      message: '结束时间不能低于一小时',
      validator: (rule: unknown, value: string) => {
        const date = new Date(value)
        if (date.getTime() < new Date().getTime() + 1000 * 60 * 60) {
          return false
        }
        return true
      },
    },
  ],
  maxVideoCount: [
    {
      required: true,
      message: '请输入最大视频数量',
    },
    {
      required: true,
      message: '视频不能少于1个',
      trigger: ['input', 'blur'],
      validator: (rule: unknown, value: string) => {
        if (Number(value) < 1) {
          return false
        }
        return true
      },
    },
  ],
}
function dateDisabled(ts: number) {
  return ts < Date.now() + 1000 * 60 * 60
}

const isLoading2 = ref(false)
async function get() {
  try {
    isLoading.value = true
    const data = await QueryGetAPI<VideoCollectTable[]>(`${VIDEO_COLLECT_API_URL}get-all`)
    if (data.code === 200) {
      // videoTables.value = data.data
      return data.data
    } else {
      message.error(`获取失败: ${data.message}`)
      return []
    }
  } catch (err) {
    console.error(err)
    message.error('获取失败')
    return []
  } finally {
    isLoading.value = false
  }
}
function createTable() {
  formRef.value?.validate().then(async () => {
    isLoading2.value = true
    QueryPostAPI<VideoCollectTable>(`${VIDEO_COLLECT_API_URL}create`, createVideoModel.value)
      .then((data) => {
        if (data.code === 200) {
          videoTables.value.push(data.data)
          createModalVisible.value = false
          message.success('创建成功')
          createVideoModel.value = JSON.parse(JSON.stringify(defaultModel))
        } else {
          message.error(`创建失败: ${data.message}`)
        }
      })
      .catch((err) => {
        console.error(err)
        message.error('创建失败')
      })
      .finally(() => {
        isLoading2.value = false
      })
  })
}
</script>

<template>
  <div class="manage-container">
    <ManagePageHeader
      title="视频征集管理"
      subtitle="创建并管理您的视频征集活动"
      :function-type="FunctionTypes.VideoCollect"
    >
      <template #action>
        <NButton
          type="primary"
          size="medium"
          @click="createModalVisible = true"
        >
          <template #icon>
            <NIcon><Add20Regular /></NIcon>
          </template>
          新建征集表
        </NButton>
      </template>
    </ManagePageHeader>

    <NSpin :show="isLoading">
      <div
        v-if="videoTables.length === 0 && !isLoading"
        class="empty-state"
      >
        <NEmpty
          description="暂无征集表"
          size="large"
        >
          <template #extra>
            <NButton
              type="primary"
              @click="createModalVisible = true"
            >
              创建第一个征集表
            </NButton>
          </template>
        </NEmpty>
      </div>
      
      <div
        v-else
        class="grid-container"
      >
        <NGrid
          x-gap="24"
          y-gap="24"
          cols="1 640:2 1024:3 1440:4"
          responsive="self"
        >
          <NGridItem
            v-for="item in videoTables"
            :key="item.id"
          >
            <div class="card-wrapper">
              <VideoCollectInfoCard
                :item="item"
                can-click
                from="owner"
                style="width: 100%"
                class="collect-card"
              />
            </div>
          </NGridItem>
        </NGrid>
      </div>
    </NSpin>

    <NModal
      v-model:show="createModalVisible"
      preset="card"
      title="创建视频征集"
      style="width: 600px; max-width: 90vw"
      class="custom-modal"
    >
      <NForm
        ref="formRef"
        :model="createVideoModel"
        :rules="createRules"
        label-placement="left"
        label-width="80"
        require-mark-placement="right-hanging"
      >
        <NFormItem
          label="标题"
          path="name"
        >
          <NInput
            v-model:value="createVideoModel.name"
            placeholder="给征集活动起个响亮的名字"
            maxlength="30"
            show-count
          />
        </NFormItem>
        <NFormItem
          label="描述"
          path="description"
        >
          <NInput
            v-model:value="createVideoModel.description"
            type="textarea"
            placeholder="简要描述活动规则或备注"
            maxlength="300"
            show-count
            :autosize="{ minRows: 3, maxRows: 5 }"
          />
        </NFormItem>
        <NGrid
          x-gap="24"
          :cols="2"
        >
          <NGridItem>
            <NFormItem
              label="最大数量"
              path="maxVideoCount"
            >
              <NInputNumber
                v-model:value="createVideoModel.maxVideoCount"
                placeholder="限制数量"
                :min="1"
                style="width: 100%"
              />
            </NFormItem>
          </NGridItem>
          <NGridItem>
            <NFormItem
              label="结束时间"
              path="endAt"
            >
              <NDatePicker
                v-model:value="createVideoModel.endAt"
                type="datetime"
                placeholder="选择截止时间"
                :is-date-disabled="dateDisabled"
                style="width: 100%"
              />
            </NFormItem>
          </NGridItem>
        </NGrid>
        
        <div class="modal-footer">
          <NText
            depth="3"
            style="font-size: 12px"
          >
            * 结束时间至少需要在当前时间一小时后
          </NText>
          <NButton
            type="primary"
            :loading="isLoading2"
            @click="createTable"
          >
            立即创建
          </NButton>
        </div>
      </NForm>
    </NModal>
  </div>
</template>

<style scoped>
.manage-container {
  max-width: 1600px;
  margin: 0 auto;
  padding: 16px;
}

.empty-state {
  margin-top: 100px;
  display: flex;
  justify-content: center;
}

.grid-container {
  width: 100%;
}

.card-wrapper {
  height: 100%;
}

/* 深度选择器修改卡片样式 */
:deep(.collect-card) {
  height: 100%;
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

:deep(.collect-card:hover) {
  transform: translateY(-4px);
  border-color: var(--n-color-target);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
}

@media (max-width: 640px) {
  /* 可以在这里添加针对小屏幕的样式调整 */
}
</style>
