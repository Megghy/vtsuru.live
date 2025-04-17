import { useAccount } from "@/api/account";
import { useBiliCookie } from "./useBiliCookie";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http"; // 引入 Body
import { defineStore, acceptHMRUpdate } from 'pinia';
import { computed } from 'vue';

export const useBiliFunction = defineStore('biliFunction', () => {
  const biliCookieStore = useBiliCookie();
  const account = useAccount();
  const cookie = computed(() => biliCookieStore.cookie);
  const uid = computed(() => account.value.biliId);

  const csrf = computed(() => {
    if (!cookie.value) return null;
    const match = cookie.value.match(/bili_jct=([^;]+)/);
    return match ? match[1] : null;
  });

  /**
   * 发送直播弹幕
   * @param roomId 直播间 ID
   * @param message 弹幕内容
   * @param color 弹幕颜色 (十六进制, 如 FFFFFF)
   * @param fontsize 字体大小 (默认 25)
   * @param mode 弹幕模式 (1: 滚动, 4: 底部, 5: 顶部)
   * @returns Promise<boolean> 是否发送成功 (基于API响应码)
   */
  async function sendLiveDanmaku(roomId: number, message: string, color: string = 'ffffff', fontsize: number = 25, mode: number = 1): Promise<boolean> {
    if (!csrf.value || !cookie.value) {
      console.error("发送弹幕失败：缺少 cookie 或 csrf token");
      return false;
    }
    if (!message || message.trim().length === 0) {
        console.warn("尝试发送空弹幕，已阻止。");
        return false;
    }
    const url = "https://api.live.bilibili.com/msg/send";
    const rnd = Math.floor(Date.now() / 1000);
    const data = {
      bubble: '0',
      msg: message,
      color: parseInt(color, 16).toString(),
      fontsize: fontsize.toString(),
      mode: mode.toString(),
      roomid: roomId.toString(),
      rnd: rnd.toString(),
      csrf: csrf.value,
      csrf_token: csrf.value,
    };

    try {
      // 注意: B站网页版发送弹幕是用 application/x-www-form-urlencoded
      const response = await tauriFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Cookie": cookie.value,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36",
          "Referer": `https://live.bilibili.com/${roomId}`
        },
        body: JSON.stringify(data), // 发送 JSON 数据
      });

      if (!response.ok) {
        console.error("发送弹幕网络失败:", response.status, await response.text());
        return false;
      }
      const json = await response.json();
      // B站成功码通常是 0
      if (json.code !== 0) {
          console.error("发送弹幕API失败:", json.code, json.message || json.msg);
          return false;
      }

      console.log("发送弹幕成功:", message);
      return true;
    } catch (error) {
      console.error("发送弹幕时发生错误:", error);
      return false;
    }
  }

  /**
   * 封禁直播间用户 (需要主播或房管权限)
   * @param roomId 直播间 ID
   * @param userId 要封禁的用户 UID
   * @param hours 封禁时长 (小时, 1-720)
   */
  async function banLiveUser(roomId: number, userId: number, hours: number = 1) {
    // 使用 csrf.value
    if (!csrf.value || !cookie.value) {
      console.error("封禁用户失败：缺少 cookie 或 csrf token");
      return;
    }
    // 确保 hours 在 1 到 720 之间
    const validHours = Math.max(1, Math.min(hours, 720));
    const url = "https://api.live.bilibili.com/banned_service/v2/Silent/add_user";
    const data = {
      room_id: roomId.toString(),
      block_uid: userId.toString(),
      hour: validHours.toString(),
      csrf: csrf.value, // 使用计算属性的值
      csrf_token: csrf.value, // 使用计算属性的值
      visit_id: "", // 通常可以为空
    };

    try {
      const response = await tauriFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Cookie": cookie.value, // 使用计算属性的值
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36",
          "Referer": `https://live.bilibili.com/p/html/live-room-setting/#/room-manager/black-list?room_id=${roomId}` // 模拟来源
        },
        body: JSON.stringify(data), // 发送 JSON 数据
      });
      if (!response.ok) {
        console.error("封禁用户失败:", response.status, await response.text());
        return response.statusText;
      }
      const json = await response.json();
      if (json.code !== 0) {
        console.error("封禁用户API失败:", json.code, json.message || json.msg);
        return json.data;
      }
      console.log("封禁用户成功:", json.data);
      return json.data;
    } catch (error) {
      console.error("封禁用户时发生错误:", error);
    }
  }

  /**
   * 发送私信
   * @param receiverId 接收者 UID
   * @param message 私信内容
   * @returns Promise<boolean> 是否发送成功 (基于API响应码)
   */
  async function sendPrivateMessage(receiverId: number, message: string): Promise<boolean> {
    if (!csrf.value || !cookie.value || !uid.value) {
      console.error("发送私信失败：缺少 cookie, csrf token 或 uid");
      return false;
    }
    if (!message || message.trim().length === 0) {
        console.warn("尝试发送空私信，已阻止。");
        return false;
    }
    const url = "https://api.vc.bilibili.com/web_im/v1/web_im/send_msg";
    const timestamp = Math.floor(Date.now() / 1000);
    const content = JSON.stringify({ content: message });
    const dev_id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16).toUpperCase();
    });
    const data = {
      'msg[sender_uid]': uid.value.toString(),
      'msg[receiver_id]': receiverId.toString(),
      'msg[receiver_type]': '1',
      'msg[msg_type]': '1',
      'msg[msg_status]': '0',
      'msg[content]': content,
      'msg[timestamp]': timestamp.toString(),
      'msg[new_face_version]': '0',
      'msg[dev_id]': dev_id,
      'build': '0',
      'mobi_app': 'web',
      'csrf': csrf.value,
      'csrf_token': csrf.value,
    };

    try {
      const response = await tauriFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Cookie": cookie.value,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36",
          "Referer": `https://message.bilibili.com/`,
        },
        body: JSON.stringify(data), // 发送 JSON 数据
      });

      if (!response.ok) {
        console.error("发送私信网络失败:", response.status, await response.text());
        return false;
      }
      // 私信成功码也是 0
       if (response.data.code !== 0) {
          console.error("发送私信API失败:", response.data.code, response.data.message);
          return false;
      }
      console.log(`发送私信给 ${receiverId} 成功`);
      return true;
    } catch (error) {
      console.error("发送私信时发生错误:", error);
      return false;
    }
  }

  return {
    sendLiveDanmaku,
    banLiveUser,
    sendPrivateMessage,
    csrf,
    uid,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useBiliFunction, import.meta.hot));
}