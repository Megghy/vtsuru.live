<script setup lang="ts">
import { FeedbackStatus, FeedbackType, ResponseFeedbackModel } from '@/api/api-models'
import { NCard, NTag, NEllipsis, NDivider, NSpin, NText, NSpace, NTooltip, NTime, NFlex } from 'naive-ui'
import { computed } from 'vue'

defineProps<{
  item: ResponseFeedbackModel
}>()
</script>

<template>
  <NCard v-bind:key="item.createAt" size="small" embedded style="width: 400px; height: 150px">
    <template #header>
      <NTag v-if="item.status == FeedbackStatus.Padding" :bordered="false"> 等待 </NTag>
      <NTag v-else-if="item.status == FeedbackStatus.Progressing" type="success">
        <template #icon>
          <NSpin :size="12" />
        </template>
        处理中
      </NTag>
      <NTag v-else-if="item.status == FeedbackStatus.Finish" :bordered="false" type="primary"> 已完成 </NTag>
      <NTag v-else-if="item.status == FeedbackStatus.Todo" :bordered="false" type="info"> 计划中 </NTag>
      <NTag v-else-if="item.status == FeedbackStatus.Reject" :bordered="false" type="error"> 搁置 </NTag>
      <NTag v-else-if="item.status == FeedbackStatus.Developing" type="warning"> 开发中 </NTag>
      <NDivider vertical />
      <NTag v-if="!item.userName"> 匿名 </NTag>
      <template v-else>
        <NEllipsis>
          {{ item.userName }}
        </NEllipsis>
      </template>
      <NDivider vertical />
      <NTooltip>
        <template #trigger>
          <NText depth="3" style="font-size: small">
            <NTime :time="item.createAt" type="relative" />
          </NText>
        </template>
        <NTime :time="item.createAt" />
      </NTooltip>
    </template>
    <template #header-extra>
      <NTag
        v-if="item.type == FeedbackType.Opinion"
        :bordered="false"
        size="small"
        type="info"
        :color="{ color: '#5f877d', textColor: 'white' }"
      >
        建议
      </NTag>
      <NTag
        v-else-if="item.type == FeedbackType.Bug"
        :bordered="false"
        size="small"
        type="info"
        :color="{ color: '#875f5f', textColor: 'white' }"
      >
        Bug
      </NTag>
      <NTag
        v-else-if="item.type == FeedbackType.FunctionRequest"
        :bordered="false"
        size="small"
        type="info"
        :color="{ color: '#5f6887', textColor: 'white' }"
      >
        功能
      </NTag>
      <NTag
        v-else-if="item.type == FeedbackType.Other"
        :bordered="false"
        size="small"
        type="info"
        :color="{ color: '#595557', textColor: 'white' }"
      >
        其他
      </NTag>
    </template>
    <NFlex justify="space-between" align="center" style="height: 100%;">
      <NEllipsis :line-clamp="item.replyMessage ? 1 : 3">
        {{ item.message }}
      </NEllipsis>
    </NFlex>
    <template v-if="item.replyMessage" #footer>
      <NDivider style="margin: 0px 0 10px 0" />
      <NSpace align="center" :wrap="false">
        <div :style="`border-radius: 4px; background-color: #75c37f; width: 10px; height: 15px`"></div>
        <NEllipsis :line-clamp="1">
          <NText>
            {{ item.replyMessage }}
          </NText>
        </NEllipsis>
      </NSpace>
    </template>
  </NCard>
</template>
