<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { NInput, NInputNumber, NButton, NSpace, NCard, NDivider, NList, NListItem, NPopconfirm, NTooltip } from 'naive-ui';

const props = defineProps({
  templates: {
    type: Array as () => string[],
    required: true
  },
  title: {
    type: String,
    default: '模板编辑'
  },
  description: {
    type: String,
    default: ''
  },
  placeholders: {
    type: Array as () => { name: string, description: string }[],
    default: () => []
  }
});

// 添加默认的弹幕相关占位符
const mergedPlaceholders = computed(() => {
  const defaultPlaceholders = [
    { name: '{{danmaku.type}}', description: '事件类型' },
    { name: '{{danmaku.uname}}', description: '用户名称' },
    { name: '{{danmaku.uface}}', description: '用户头像URL' },
    { name: '{{danmaku.uid}}', description: '用户ID（直接连接）' },
    { name: '{{danmaku.open_id}}', description: '用户开放平台ID' },
    { name: '{{danmaku.msg}}', description: '消息内容' },
    { name: '{{danmaku.time}}', description: '时间戳' },
    { name: '{{danmaku.num}}', description: '数量' },
    { name: '{{danmaku.price}}', description: '价格' },
    { name: '{{danmaku.guard_level}}', description: '大航海等级' },
    { name: '{{danmaku.fans_medal_level}}', description: '粉丝牌等级' },
    { name: '{{danmaku.fans_medal_name}}', description: '粉丝牌名称' },
    { name: '{{danmaku.fans_medal_wearing_status}}', description: '是否佩戴粉丝牌' },
    { name: '{{danmaku.emoji}}', description: '表情符号' }
  ];

  // 返回自定义占位符和默认占位符，但不合并它们
  return { custom: props.placeholders, default: defaultPlaceholders };
});

const newTemplate = ref('');

function addTemplate() {
  if (newTemplate.value.trim()) {
    props.templates.push(newTemplate.value.trim());
    newTemplate.value = '';
  }
}

function removeTemplate(index: number) {
  props.templates.splice(index, 1);
  }

  onMounted(() => {

})
</script>

<template>
  <NCard
    :title="title"
    size="small"
  >
    <template
      v-if="mergedPlaceholders.custom.length > 0 || mergedPlaceholders.default.length > 0"
      #header-extra
    >
      <NTooltip
        trigger="hover"
        placement="top"
      >
        <template #trigger>
          <NButton
            quaternary
            size="small"
          >
            变量说明
          </NButton>
        </template>
        <div style="max-width: 300px">
          <div
            v-for="(ph, idx) in mergedPlaceholders.custom"
            :key="'custom-' + idx"
          >
            <strong>{{ ph.name }}</strong>: {{ ph.description }}
          </div>
          <NDivider
            v-if="mergedPlaceholders.custom.length > 0 && mergedPlaceholders.default.length > 0"
            style="margin: 10px 0;">
            默认变量
          </NDivider>
          <div
            v-for="(ph, idx) in mergedPlaceholders.default"
            :key="'default-' + idx"
          >
            <strong>{{ ph.name }}</strong>: {{ ph.description }}
          </div>
        </div>
      </NTooltip>
    </template>

    <p
      v-if="description"
      class="template-description"
    >
      {{ description }}
    </p>

    <NList bordered>
      <NListItem
        v-for="(template, index) in templates"
        :key="index"
      >
        <NSpace
          justify="space-between"
          align="center"
          style="width: 100%"
        >
          <span>{{ template }}</span>
          <NPopconfirm @positive-click="removeTemplate(index)">
            <template #trigger>
              <NButton
                size="small"
                quaternary
                type="error"
              >
                删除
              </NButton>
            </template>
            确定要删除此模板吗？
          </NPopconfirm>
        </NSpace>
      </NListItem>
    </NList>

    <NDivider />

    <NSpace vertical>
      <NInput
        v-model:value="newTemplate"
        placeholder="输入新模板内容"
        clearable
      />
      <NButton
        type="primary"
        block
        @click="addTemplate"
      >
        添加模板
      </NButton>
    </NSpace>
  </NCard>
</template>

<style scoped>
.template-description {
  margin-bottom: 16px;
  font-size: 14px;
  color: #666;
}
</style>
