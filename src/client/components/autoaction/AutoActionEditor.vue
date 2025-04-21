<script setup lang="ts">
import { NCard, NSpace, NCollapse, NDivider } from 'naive-ui';
import { AutoActionItem, TriggerType } from '@/client/store/useAutoAction';

// 引入拆分的子组件
import BasicSettings from './settings/BasicSettings.vue';
import AdvancedSettings from './settings/AdvancedSettings.vue';
import DanmakuSettings from './settings/DanmakuSettings.vue';
import GiftSettings from './settings/GiftSettings.vue';
import GuardSettings from './settings/GuardSettings.vue';
import ScheduledSettings from './settings/ScheduledSettings.vue';
import TemplateSettings from './settings/TemplateSettings.vue';
import FollowSettings from './settings/FollowSettings.vue';
import EnterSettings from './settings/EnterSettings.vue';
import SuperChatSettings from './settings/SuperChatSettings.vue';

const props = defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true
  }
});

// 根据触发类型获取对应的设置组件
const getTriggerSettings = () => {
  switch (props.action.triggerType) {
    case TriggerType.DANMAKU:
      return DanmakuSettings;
    case TriggerType.GIFT:
      return GiftSettings;
    case TriggerType.GUARD:
      return GuardSettings;
    case TriggerType.FOLLOW:
      return FollowSettings;
    case TriggerType.ENTER:
      return EnterSettings;
    case TriggerType.SCHEDULED:
      return ScheduledSettings;
    case TriggerType.SUPER_CHAT:
      return SuperChatSettings;
    default:
      return null;
  }
};

const TriggerSettings = getTriggerSettings();
</script>

<template>
  <div class="auto-action-editor">
    <NSpace vertical>
      <!-- 模板设置 - 移到最上面 -->
      <TemplateSettings :action="action" />

      <!-- 基本设置 -->
      <BasicSettings :action="action" />
      <!-- 高级选项 - 所有高级设置放在一个折叠面板中 -->
      <NCollapse class="settings-collapse">
        <template #default>
          <br>
          <!-- 触发类型特定设置 -->
          <component
            :is="TriggerSettings"
            v-if="TriggerSettings"
            :action="action"
            class="trigger-settings"
          />

          <NDivider style="margin: 10px 0;">
            高级选项
          </NDivider>
          <!-- 通用高级设置 -->
          <AdvancedSettings
            :action="action"
            class="advanced-settings"
          />
        </template>
        <template #header>
          高级选项
        </template>
      </NCollapse>
    </NSpace>
  </div>
</template>

<style scoped>
.auto-action-editor {
  margin-bottom
  : 20px;
}
.trigger-settings {
  color: var(--n-color-info);
  font-size: bold;
}
</style>
