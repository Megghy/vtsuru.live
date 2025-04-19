import { useAccount } from "@/api/account";
import { useBiliCookie } from "./useBiliCookie";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http"; // 引入 Body
import { defineStore, acceptHMRUpdate } from 'pinia';
import { computed, ref } from 'vue';
import md5 from 'md5';
import { QueryBiliAPI } from "../data/utils";
import { onSendPrivateMessageFailed } from "../data/notification";

// WBI 混合密钥编码表
const mixinKeyEncTab = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
  61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
  36, 20, 34, 44, 52
];

// 对 imgKey 和 subKey 进行字符顺序打乱编码
const getMixinKey = (orig: string): string =>
  mixinKeyEncTab.map(n => orig[n]).join('').slice(0, 32);

// 为请求参数进行 wbi 签名
function encWbi(
  params: { [key: string]: string | number },
  img_key: string,
  sub_key: string
): string {
  const mixin_key = getMixinKey(img_key + sub_key);
  const curr_time = Math.round(Date.now() / 1000);
  const chr_filter = /[!'()*]/g;

  Object.assign(params, { wts: curr_time.toString() }); // 添加 wts 字段

  // 按照 key 重排参数
  const query = Object.keys(params)
    .sort()
    .map(key => {
      // 过滤 value 中的 "!'()*" 字符
      const value = params[key].toString().replace(chr_filter, '');
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    })
    .join('&');

  const wbi_sign = md5(query + mixin_key); // 计算 w_rid
  return query + '&w_rid=' + wbi_sign;
}

// 获取最新的 img_key 和 sub_key
async function getWbiKeys(cookie: string): Promise<{ img_key: string, sub_key: string }> {
  try {
    const response = await QueryBiliAPI('https://api.bilibili.com/x/web-interface/nav');

    if (!response.ok) {
      console.error("获取WBI密钥失败:", response.status);
      throw new Error("获取WBI密钥失败");
    }

    const result = await response.json();
    const { wbi_img } = result.data;

    console.log(`获取WBI秘钥: img_key: ${wbi_img.img_url}, sub_key: ${wbi_img.sub_url}`);

    return {
      img_key: wbi_img.img_url.slice(
        wbi_img.img_url.lastIndexOf('/') + 1,
        wbi_img.img_url.lastIndexOf('.')
      ),
      sub_key: wbi_img.sub_url.slice(
        wbi_img.sub_url.lastIndexOf('/') + 1,
        wbi_img.sub_url.lastIndexOf('.')
      )
    };
  } catch (error) {
    console.error("获取WBI密钥时发生错误:", error);
    throw error;
  }
}

export const useBiliFunction = defineStore('biliFunction', () => {
  const biliCookieStore = useBiliCookie();
  const account = useAccount();
  const cookie = computed(() => biliCookieStore.cookie);
  const uid = computed(() => account.value.biliId);
  // 存储WBI密钥
  const wbiKeys = ref<{ img_key: string, sub_key: string } | null>(null);

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
    roomId = 1294406; // 测试用房间号
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
    const params = new URLSearchParams(data)
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
        body: params, // 发送 JSON 数据
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
      const params = new URLSearchParams(data)
      const response = await tauriFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Cookie": cookie.value, // 使用计算属性的值
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36",
          "Referer": `https://live.bilibili.com/p/html/live-room-setting/#/room-manager/black-list?room_id=${roomId}` // 模拟来源
        },
        body: params, // 发送 URLSearchParams 数据
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
      const error = "发送私信失败：缺少 cookie, csrf token 或 uid";
      console.error(error);
      onSendPrivateMessageFailed(receiverId, message, error);
      return false;
    }
    if (!message || message.trim().length === 0) {
        const error = "尝试发送空私信，已阻止。";
        console.warn(error);
        return false;
    }

    try {
      // 获取WBI密钥（如果还没有）
      if (!wbiKeys.value) {
        wbiKeys.value = await getWbiKeys(cookie.value);
      }
      if (!wbiKeys.value) {
        const error = "获取WBI密钥失败，无法发送私信";
        console.error(error);
        onSendPrivateMessageFailed(receiverId, message, error);
        return false;
      }

      const dev_id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16).toUpperCase();
      });

      const timestamp = Math.floor(Date.now() / 1000);
      const content = JSON.stringify({ content: message });

      // 准备URL参数(需要WBI签名的参数)
      const urlParams = {
        w_sender_uid: uid.value.toString(),
        w_receiver_id: receiverId.toString(),
        w_dev_id: dev_id,
      };

      // 生成带WBI签名的URL查询字符串
      const signedQuery = encWbi(
        urlParams,
        wbiKeys.value.img_key,
        wbiKeys.value.sub_key
      );

      // 构建最终URL
      const url = `https://api.vc.bilibili.com/web_im/v1/web_im/send_msg?${signedQuery}`;

      // 准备表单数据
      const formData = {
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

      const params = new URLSearchParams(formData);
      const response = await tauriFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Cookie": cookie.value,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36",
          "Origin": '',
        },
        body: params,
      });

      if (!response.ok) {
        const error = `发送私信网络失败: ${response.status}`;
        console.error(error, await response.text());
        onSendPrivateMessageFailed(receiverId, message, error);
        return false;
      }

      const json = await response.json();
      if (json.code !== 0) {
          const error = `发送私信API失败: ${json.code} - ${json.message}`;
          console.error(error);
          onSendPrivateMessageFailed(receiverId, message, error);
          return false;
      }

      console.log(`发送私信给 ${receiverId} 成功`);
      return true;
    } catch (error) {
      console.error("发送私信时发生错误:", error);
      // 如果是WBI密钥问题，清空密钥以便下次重新获取
      if (String(error).includes('WBI')) {
        wbiKeys.value = null;
      }
      onSendPrivateMessageFailed(receiverId, message, error);
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