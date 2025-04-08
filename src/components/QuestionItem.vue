<script setup lang="ts">
import { QAInfo } from '@/api/api-models'
import { useQuestionBox } from '@/store/useQuestionBox';
import { NButton, NCard, NDivider, NFlex, NImage, NTag, NText, NTime, NTooltip } from 'naive-ui'
import { ref } from 'vue';

const props = defineProps<{
  item: QAInfo
}>()
const useQA = useQuestionBox()

const isViolation = props.item.reviewResult?.isApproved == false
const showContent = ref(!isViolation)
</script>

<template>
  <NCard
    v-if="item"
    :embedded="!item.isReaded"
    hoverable
    size="small"
    :bordered="false"
  >
    <template #header>
      <NFlex
        :size="0"
        align="center"
      >
        <template v-if="!item.isReaded">
          <NTag
            type="warning"
            size="tiny"
          >
            未读
          </NTag>
          <NDivider vertical />
        </template>
        <NText
          :depth="item.isAnonymous ? 3 : 1"
          style=""
        >
          {{ item.isAnonymous ? '匿名用户' : item.sender?.name }}
        </NText>
        <NTag
          v-if="item.isSenderRegisted"
          size="small"
          type="info"
          :bordered="false"
          style="margin-left: 5px"
        >
          已注册
        </NTag>
        <NTag
          v-if="item.isPublic"
          size="small"
          type="success"
          :bordered="false"
          style="margin-left: 5px"
        >
          公开
        </NTag>
        <NTooltip v-if="item.tag">
          <template #trigger>
            <NTag
              size="small"
              type="success"
              style="margin-left: 5px"
            >
              {{ item.tag }}
            </NTag>
          </template>
          标签/话题
        </NTooltip>
        <NDivider vertical />
        <NText
          depth="3"
          style="font-size: small"
        >
          <NTooltip>
            <template #trigger>
              <NTime
                :time="item.sendAt"
                :to="Date.now()"
                type="relative"
              />
            </template>
            <NTime :time="item.sendAt" />
          </NTooltip>
        </NText>
        <template v-if="item.reviewResult && item.reviewResult.violationType?.length > 0">
          <NDivider vertical />
          <NFlex size="small">
            <NTag
              v-for="v in item.reviewResult.violationType"
              :key="v"
              size="small"
              type="error"
              :bordered="false"
            >
              {{ useQA.getViolationString(v) }}
            </NTag>
          </NFlex>
        </template>
        <template v-if="item.reviewResult && item.reviewResult.saftyScore">
          <NDivider vertical />
          <NTooltip>
            <template #trigger>
              <NTag
                size="small"
                :color="{ color: '#af2525', textColor: 'white', borderColor: 'white' }"
              >
                得分: {{ item.reviewResult.saftyScore }}
              </NTag>
            </template>
            审查得分, 满分100, 越低代表消息越8行
          </NTooltip>
        </template>
      </NFlex>
    </template>
    <template #footer>
      <slot
        name="footer"
        :item="item"
      />
    </template>
    <template #header-extra>
      <slot
        name="header-extra"
        :item="item"
      />
    </template>
    <template v-if="item.question?.image">
      <NImage
        v-if="item.question?.image"
        :src="item.question.image"
        height="100"
        lazy
      />
      <br>
    </template>

    <NText :style="{ filter: showContent ? '' : 'blur(3.7px)', cursor: showContent ? '' : 'pointer', whiteSpace: 'pre-wrap' }">
      <NButton
        v-if="isViolation"
        size="small"
        text
        @click="showContent = !showContent"
      >
        {{ item.question?.message }}
      </NButton>
      <template v-else>
        {{ item.question?.message }}
      </template>
    </NText>

    <template v-if="item.answer">
      <NDivider style="margin: 10px 0 10px 0" />
      <NText depth="3">
        {{ item.answer.message }}
      </NText>
    </template>
  </NCard>
</template>
