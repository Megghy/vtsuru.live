import { QAInfo, ResponsePointGoodModel, ResponsePointOrder2OwnerModel } from "@/api/api-models";
import { useSettings } from "../store/useSettings";
import { isPermissionGranted, onAction, Options, sendNotification } from "@tauri-apps/plugin-notification";
import { openUrl } from "@tauri-apps/plugin-opener";
import { CN_HOST } from "@/data/constants";
import { NButton, NFlex } from "naive-ui";
import QuestionItem from "@/components/QuestionItem.vue";

export async function trySendNotification(option: Options) {
  let permissionGranted = await isPermissionGranted();
    if (permissionGranted) {
      sendNotification(option);
    }
}

export function onReceivedNotification(type: string, json: string) {
  console.log(`接收到通知: ${type}`, json);
  const data = JSON.parse(json);
  switch (type) {
    case 'question-box':
      onReceivedQuestion(data);
      break;
    case 'goods-buy':
      onGoodsBuy(data);
      break;
    default:
      console.warn(`Unhandled notification type: ${type}`);
  }
}

export async function onReceivedQuestion(question: QAInfo) {
  const setting = useSettings();
  if (setting.settings.notificationSettings.enableTypes.includes("question-box")) {
    window.$notification.info({
      title: "提问箱",
      description: '收到来自 [' + (question.sender.name || '匿名用户') + '] 的提问',
      duration: 0,
      action: () => h(NFlex, {}, () => [
        h(NButton, {
          text: true, type: 'info', onClick: () => {
            window.$modal.create({
              title: '快速查看',
              preset: 'card',
              style: { maxWidth: '80vw' },
              content: () => h(QuestionItem, { item: question }),
            });
          }
        }, () => '快速查看'),
        h(NButton, {
          text: true, type: 'primary', onClick: () => {
            openUrl(`${CN_HOST}manage/question-box`);
          }
        }, () => '查看详情'),
      ])
    });
    trySendNotification({
      title: "提问箱",
      body: '收到来自 [' + (question.sender.name || '匿名用户') + '] 的提问',
      extra: { type: 'question-box' },
    });
  }
}

export function onGoodsBuy(info: {
  data: ResponsePointOrder2OwnerModel,
  goods: ResponsePointGoodModel
}) {
  const setting = useSettings();
  const order = info.data;
  const goods = info.goods;
  if (setting.settings.notificationSettings.enableTypes.includes("goods-buy")) {
    window.$notification.info({
      title: "礼物兑换",
      description: `${order.customer.name} 兑换了你的 [${goods.name}]，数量: ${order.count}，总价: ${order.point} 元`,
      duration: 0,
      action: () => h(NButton, {
        text: true, type: 'primary', onClick: () => {
          openUrl(`${CN_HOST}manage/goods-buy`);
        }
      }, () => '查看详情'),
    });
    trySendNotification({
      title: "礼物兑换",
      body: `${order.customer.name} 兑换了你的 [${goods.name}]，数量: ${order.count}，总价: ${order.point} 元`,
      extra: { type: 'goods-buy' },
    });
  }
}

// 私信发送失败通知
export function onSendPrivateMessageFailed(receiverId: number, message: string, error: any) {
  const setting = useSettings();
  if (setting.settings.notificationSettings.enableTypes.includes("message-failed")) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    window.$notification.error({
      title: "私信发送失败",
      description: `向用户 ${receiverId} 发送私信失败: ${errorMsg}`,
      duration: 8000,
    });
    trySendNotification({
      title: "私信发送失败",
      body: `向用户 ${receiverId} 发送私信失败`,
      extra: { type: 'message-failed' },
    });
  }
}