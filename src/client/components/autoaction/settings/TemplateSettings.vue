<script setup lang="ts">
import { computed } from 'vue';
import { NDivider } from 'naive-ui';
import TemplateEditor from '../TemplateEditor.vue';
import { AutoActionItem, TriggerType, ActionType } from '@/client/store/useAutoAction';

const props = defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true
  }
});

// 模板变量占位符选项，根据触发类型动态生成
const placeholders = computed(() => {
  const commonPlaceholders = [
    { name: '{{user.name}}', description: '用户名称' },
    { name: '{{user.uid}}', description: '用户ID' },
    { name: '{{date.formatted}}', description: '当前日期时间' },
    { name: '{{timeOfDay()}}', description: '当前时段（早上/下午/晚上）' },
  ];

  let specificPlaceholders: { name: string, description: string }[] = [];

  switch (props.action.triggerType) {
    case TriggerType.GIFT:
      specificPlaceholders = [
        { name: '{{gift.name}}', description: '礼物名称' },
        { name: '{{gift.count}}', description: '礼物数量' },
        { name: '{{gift.price}}', description: '礼物单价' },
        { name: '{{gift.totalPrice}}', description: '礼物总价值' },
        { name: '{{gift.summary}}', description: '礼物摘要（如：5个辣条）' },
      ];
      break;
    case TriggerType.GUARD:
      specificPlaceholders = [
        { name: '{{guard.level}}', description: '舰长等级' },
        { name: '{{guard.levelName}}', description: '舰长等级名称' },
        { name: '{{guard.giftCode}}', description: '礼品码（如已配置）' },
      ];
      break;
    case TriggerType.SUPER_CHAT:
      specificPlaceholders = [
        { name: '{{sc.message}}', description: 'SC消息内容' },
        { name: '{{sc.price}}', description: 'SC价格' },
      ];
      break;
    case TriggerType.FOLLOW:
      specificPlaceholders = [
        { name: '{{follow.time}}', description: '关注时间' },
        { name: '{{follow.isNew}}', description: '是否新关注' },
      ];
      break;
    case TriggerType.ENTER:
      specificPlaceholders = [
        { name: '{{enter.time}}', description: '入场时间' },
        { name: '{{enter.guardLevel}}', description: '舰长等级' },
        { name: '{{enter.medalName}}', description: '勋章名称' },
        { name: '{{enter.medalLevel}}', description: '勋章等级' },
      ];
      break;
  }

  return [...commonPlaceholders, ...specificPlaceholders];
});

// 根据操作类型获取模板标题
const templateTitle = computed(() => {
  switch (props.action.actionType) {
    case ActionType.SEND_DANMAKU:
      return '弹幕模板';
    case ActionType.SEND_PRIVATE_MSG:
      return '私信模板';
    case ActionType.EXECUTE_COMMAND:
      return '命令模板';
    default:
      return '消息模板';
  }
});

// 根据操作类型获取模板描述
const templateDescription = computed(() => {
  switch (props.action.actionType) {
    case ActionType.SEND_DANMAKU:
      return '发送到直播间的弹幕内容';
    case ActionType.SEND_PRIVATE_MSG:
      return '发送给用户的私信内容';
    case ActionType.EXECUTE_COMMAND:
      return '执行的命令模板';
    default:
      return '消息内容模板';
  }
});
</script>

<template>
  <div class="template-settings">
    <transition
      name="fade-scale"
      appear
    >
      <TemplateEditor
        :templates="action.templates"
        :placeholders="placeholders"
        :title="templateTitle"
        :description="templateDescription"
        class="template-editor"
      />
    </transition>
  </div>
</template>

<style scoped>
.template-settings {
  position: relative;
}

.settings-divider {
  transition: all 0.3s ease;
}

.template-editor {
  transition: all 0.3s ease;
}

/* 淡入缩放效果 */
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
