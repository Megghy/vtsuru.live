<script setup lang="ts">
import { QAInfo } from '@/api/api-models'
import { NCard, NDivider, NFlex, NImage, NTag, NText, NTime, NTooltip } from 'naive-ui'

const props = defineProps<{
  item: QAInfo
}>()
</script>

<template>
  <NCard v-if="item" :embedded="!item.isReaded" hoverable size="small" :bordered="false">
    <template #header>
      <NFlex :size="0" align="center">
        <template v-if="!item.isReaded">
          <NTag type="warning" size="tiny"> 未读 </NTag>
          <NDivider vertical />
        </template>
        <NText :depth="item.isAnonymous ? 3 : 1" style="margin-top: 3px">
          {{ item.isAnonymous ? '匿名用户' : item.sender?.name }}
        </NText>
        <NTag v-if="item.isSenderRegisted" size="small" type="info" :bordered="false" style="margin-left: 5px">
          已注册
        </NTag>
        <NTag v-if="item.isPublic" size="small" type="success" :bordered="false" style="margin-left: 5px"> 公开 </NTag>
        <NTooltip v-if="item.tag">
          <template #trigger>
            <NTag size="small" type="success" style="margin-left: 5px">
              {{ item.tag }}
            </NTag>
          </template>
          标签/话题
        </NTooltip>
        <NDivider vertical />
        <NText depth="3" style="font-size: small">
          <NTooltip>
            <template #trigger>
              <NTime :time="item.sendAt" :to="Date.now()" type="relative" />
            </template>
            <NTime :time="item.sendAt" />
          </NTooltip>
        </NText>
      </NFlex>
    </template>
    <template #footer>
      <slot name="footer" :item="item"></slot>
    </template>
    <template #header-extra>
      <slot name="header-extra" :item="item"></slot>
    </template>
    <template v-if="item.question?.image">
      <NImage v-if="item.question?.image" :src="item.question.image" height="100" lazy />
      <br />
    </template>

    <NText style="">
      {{ item.question?.message }}
    </NText>

    <template v-if="item.answer">
      <NDivider style="margin: 10px 0 10px 0" />
      <NText depth="3"> {{ item.answer.message }} </NText>
    </template>
  </NCard>
</template>
