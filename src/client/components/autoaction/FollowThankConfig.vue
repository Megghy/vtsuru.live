<script setup lang="ts">
import { NSpace, NDivider, NInputNumber } from 'naive-ui';
import CommonConfigItems from './CommonConfigItems.vue';
import TemplateEditor from './TemplateEditor.vue';
import { FollowThankConfig } from '@/client/store/useAutoAction';

const props = defineProps({
  config: {
    type: Object as () => FollowThankConfig,
    required: true
  }
});

const placeholders = [
  { name: '{{user.name}}', description: '被感谢的用户名或用户列表' }
];
</script>

<template>
  <div class="follow-thank-config">
    <CommonConfigItems
      :config="config"
      :show-live-only="true"
      :show-delay="true"
      :show-user-filter="false"
      :show-tian-xuan="true"
    />

    <NDivider title-placement="left">
      关注感谢设置
    </NDivider>

    <NSpace
      vertical
      size="medium"
    >
      <NSpace
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <span>每次感谢最大用户数:</span>
        <NInputNumber
          v-model:value="config.maxUsersPerMsg"
          :min="1"
          :max="20"
          style="width: 120px"
        />
      </NSpace>

      <TemplateEditor
        :templates="config.templates"
        title="感谢模板"
        description="可以使用变量来个性化感谢内容"
        :placeholders="placeholders"
      />
    </NSpace>
  </div>
</template>
