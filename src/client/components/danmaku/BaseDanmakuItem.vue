<script setup lang="ts">
import { EventDataTypes, EventModel } from '@/api/api-models';
import { DanmakuWindowSettings, useDanmakuWindow } from '../../store/useDanmakuWindow';
import { computed } from 'vue';
import { AVATAR_URL } from '@/data/constants';
import { GetGuardColor } from '@/Utils';

export interface BaseDanmakuItemProps {
  item: EventModel & { randomId: string; isNew?: boolean; disappearAt?: number; };
  setting: DanmakuWindowSettings;
}

const props = defineProps<BaseDanmakuItemProps>();

const emojiData = useDanmakuWindow().emojiData;

// 检查弹幕是否将要消失
const isDisappearing = computed(() => {
  return props.item.disappearAt && Date.now() > props.item.disappearAt - 300; // 提前300ms进入消失动画
});

// 计算SC弹幕的颜色类
const scColorClass = computed(() => {
  if (props.item.type === EventDataTypes.SC) {
    const price = props.item?.price || 0;
    if (price === 0) return 'sc-0';
    if (price > 0 && price < 50) return 'sc-50';
    if (price >= 50 && price < 100) return 'sc-100';
    if (price >= 100 && price < 500) return 'sc-500';
    if (price >= 500 && price < 1000) return 'sc-1000';
    if (price >= 1000 && price < 2000) return 'sc-2000';
    if (price >= 2000) return 'sc-max';
  }
  return '';
});

// 根据类型计算样式
const typeClass = computed(() => {
  switch (props.item.type) {
    case EventDataTypes.Message: return 'message-item';
    case EventDataTypes.Gift: return 'gift-item';
    case EventDataTypes.SC: return `sc-item ${scColorClass.value}`;
    case EventDataTypes.Guard: return 'guard-item';
    case EventDataTypes.Enter: return 'enter-item';
    default: return '';
  }
});

// 获取舰长颜色
const guardColor = computed(() => GetGuardColor(props.item.guard_level));

// 舰长样式类
const guardLevelClass = computed(() => {
  if (props.item.type === EventDataTypes.Guard) {
    return `guard-level-${props.item.guard_level || 0}`;
  }
  return '';
});

// 检查是否需要显示头像
const showAvatar = computed(() => props.setting.showAvatar);

// 解析包含内联表情的消息
const parsedMessage = computed<{ type: 'text' | 'emoji'; content?: string; url?: string; name?: string; }[]>(() => {
  // 仅处理非纯表情的普通消息
  if (props.item.type !== EventDataTypes.Message || props.item.emoji || !props.item.msg) {
    return [];
  }

  const segments: { type: 'text' | 'emoji'; content?: string; url?: string; name?: string; }[] = [];
  let lastIndex = 0;
  const regex = /\[([^\]]+)\]/g; // 匹配 [表情名]
  let match;

  try {
    const availableEmojis = emojiData.data || {}; // 确保 emojiData 已加载

    while ((match = regex.exec(props.item.msg)) !== null) {
      // 添加表情前的文本部分
      if (match.index > lastIndex) {
        segments.push({ type: 'text', content: props.item.msg.substring(lastIndex, match.index) });
      }

      const emojiFullName = match[0]; // 完整匹配，例如 "[哈哈]"
      const emojiInfo = availableEmojis.inline[emojiFullName] || availableEmojis.plain[emojiFullName];

      if (emojiInfo) {
        // 找到了表情
        segments.push({ type: 'emoji', url: emojiInfo, name: emojiFullName });
      } else {
        // 未找到表情，当作普通文本处理
        segments.push({ type: 'text', content: emojiFullName });
      }

      lastIndex = regex.lastIndex;
    }

    // 添加最后一个表情后的文本部分
    if (lastIndex < props.item.msg.length) {
      segments.push({ type: 'text', content: props.item.msg.substring(lastIndex) });
    }
  } catch (error) {
    console.error("Error parsing message for emojis:", error);
    // 解析出错时，返回原始文本
    return [{ type: 'text', content: props.item.msg }];
  }

  // 如果解析后为空（例如，消息只包含无法识别的[]），则返回原始文本
  if (segments.length === 0 && props.item.msg) {
    return [{ type: 'text', content: props.item.msg }];
  }

  return segments;
});

// 获取不同类型消息的显示标签
const typeLabel = computed(() => {
  switch (props.item.type) {
    case EventDataTypes.Message: return '';  // 普通消息不需要标签
    case EventDataTypes.Gift: return '【礼物】';
    case EventDataTypes.SC: return '【SC】';
    case EventDataTypes.Guard: return '【舰长】';
    case EventDataTypes.Enter: return '【进场】';
    default: return '';
  }
});

// 获取礼物或SC的价格文本
const priceText = computed(() => {
  if (props.item.type === EventDataTypes.SC ||
      (props.item.type === EventDataTypes.Gift && props.item.price > 0)) {
    return `￥${props.item.price || 0}`;
  }
  return '';
});

// 获取用户名显示
const displayName = computed(() => {
  return props.item.uname || '匿名用户';
});

// 获取消息显示内容
const displayContent = computed(() => {
  switch (props.item.type) {
    case EventDataTypes.Message:
      return props.item.msg || '';
    case EventDataTypes.Gift:
      return `${props.item.num || 1} × ${props.item.msg}`;
    case EventDataTypes.SC:
      return props.item.msg || '';
    case EventDataTypes.Guard:
      return props.item.msg || '开通了舰长';
    case EventDataTypes.Enter:
      return '进入了直播间';
    default:
      return '';
  }
});

// 根据风格及类型获取文本颜色
const textModeColor = computed(() => {
  if (props.item.type === EventDataTypes.SC) {
    return '#FFD700'; // SC消息金色
  } else if (props.item.type === EventDataTypes.Gift) {
    return '#FF69B4'; // 礼物消息粉色
  } else if (props.item.type === EventDataTypes.Guard) {
    return guardColor.value; // 舰长消息使用舰长颜色
  } else if (props.item.type === EventDataTypes.Enter) {
    return '#67C23A'; // 入场消息绿色
  }
  return undefined; // 普通消息使用默认颜色
});

// 向外导出所有计算属性
defineExpose({
  isDisappearing,
  scColorClass,
  typeClass,
  guardColor,
  guardLevelClass,
  showAvatar,
  parsedMessage,
  typeLabel,
  priceText,
  displayName,
  displayContent,
  textModeColor
});
</script>

<template>
  <slot />
</template>