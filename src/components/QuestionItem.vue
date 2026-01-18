<script setup lang="ts">
import type { QAInfo } from '@/api/api-models'
import { NCard, NDivider, NFlex, NImage, NTag, NText, NTime, NTooltip } from 'naive-ui';
import { ref } from 'vue'
import { useQuestionBox } from '@/store/useQuestionBox'

const props = defineProps<{
  item: QAInfo
}>()
const useQA = useQuestionBox()

const isViolation = props.item.reviewResult?.isApproved == false
const showContent = ref(!isViolation)

// 计算得分颜色的函数
function getScoreColor(score: number | undefined): string {
  if (score === undefined) {
    return 'grey' // 如果没有分数，返回灰色
  }
  // 将分数限制在 0 到 100 之间
  const clampedScore = Math.max(0, Math.min(100, score))
  // 插值计算色相: 0 (红色) for score 0, 120 (绿色) for score 100
  const hue = 120 * (clampedScore / 100) // 反转插值逻辑
  // 固定饱和度和亮度 (可根据需要调整)
  const saturation = 50
  const lightness = 45 // 稍暗以提高与白色文本的对比度
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}
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
        <template v-if="item.reviewResult && item.reviewResult.saftyScore !== undefined">
          <NDivider vertical />
          <NTooltip>
            <template #trigger>
              <NTag
                size="small"
                :style="{ backgroundColor: getScoreColor(item.reviewResult.saftyScore), color: 'white', borderColor: 'transparent' }"
              >
                得分: {{ item.reviewResult.saftyScore }}
              </NTag>
            </template>
            审查得分, 满分100, 越低代表消息越安全, 越高越危险
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
    <template v-if="item.questionImages && item.questionImages.length > 0">
      <NFlex
        size="small"
      >
        <NImage
          v-for="(img, index) in item.questionImages"
          :key="index"
          :src="img.path"
          height="100"
          lazy
        />
      </NFlex>
    </template>

    <NText
      :style="{
        filter: isViolation && !showContent ? 'blur(3.7px)' : '',
        cursor: isViolation && !showContent ? 'pointer' : '',
        whiteSpace: 'pre-wrap',
      }"
      @click="isViolation ? (showContent = !showContent) : null"
    >
      {{ item.question?.message }}
    </NText>

    <template v-if="item.answer">
      <NDivider style="margin: 10px 0 10px 0" />
      <NText depth="3">
        {{ item.answer.message }}
      </NText>
    </template>
  </NCard>
</template>
