import { QAInfo } from "@/api/api-models";
import { useSettings } from "../store/useSettings";
import { isPermissionGranted, onAction, sendNotification } from "@tauri-apps/plugin-notification";
import { openUrl } from "@tauri-apps/plugin-opener";
import { CN_HOST } from "@/data/constants";

export async function onReceivedQuestion(question: QAInfo) {
  const setting = useSettings();
  if (setting.settings.notificationSettings.enableTypes.includes("question-box")) {
    window.$notification.info({
      title: "收到提问",
      description: '收到来自 [' + question.sender.name || '匿名用户' + '] 的提问',
      duration: 5,
    });
    let permissionGranted = await isPermissionGranted();
    if (permissionGranted) {
      sendNotification({
        title: "收到提问",
        body: '来自 [' + question.sender.name || '匿名用户' + '] 的提问',
        silent: false,
        extra: { type: 'question-box' },
      });
      
    }
  }

}