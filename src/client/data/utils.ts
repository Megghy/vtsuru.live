import { fetch } from '@tauri-apps/plugin-http';
import { useBiliCookie } from '../store/useBiliCookie';
import { QueryPostAPI } from '@/api/query';
import { OPEN_LIVE_API_URL } from '@/data/constants';
import { error } from '@tauri-apps/plugin-log';

export async function QueryBiliAPI(url: string, method: string = 'GET', cookie: string = '', useCookie: boolean = true) {
  const u = new URL(url);
  return fetch(url, {
    method: method,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36',
      Origin: '',
      Cookie:  useCookie ? (cookie || (await useBiliCookie().getBiliCookie()) || '') : ''
    },
  });
}

export async function getRoomKey(roomId: number, cookie: string) {
  try {
    const result = await QueryBiliAPI(
      'https://api.live.bilibili.com/xlive/web-room/v1/index/getDanmuInfo?id=' + roomId
    );
    const json = await result.json();
    if (json.code === 0) return json.data.token;
    else {
      error(`无法获取直播间key: ${json.message}`);
    }
  } catch (err) {
    error(`无法获取直播间key: ${err}`);
  }
}
export async function getBuvid() {
  try {
    const result = await QueryBiliAPI('https://api.bilibili.com/x/web-frontend/getbuvid');
    if (result.ok) {
      const json = await result.json();
      if (json.code === 0) return json.data.buvid;
      else {
        error(`无法获取buvid: ${json.message}`);
      }
    } else {
      error(`无法获取buvid: ${result.statusText}`);
    }
  } catch (err) {
    error(`无法获取buvid: ${err}`);
  }
}

export async function getAuthInfo(): Promise<{
  data: any;
  message: string;
}> {
  try {
    const data = await QueryPostAPI<any>(OPEN_LIVE_API_URL + 'start');
    if (data.code == 200) {
      console.log(`[open-live] 已获取认证信息`);
      return {
        data: data.data,
        message: '',
      };
    } else {
      return {
        data: null,
        message: data.message,
      };
    }
  } catch (err) {
    return {
      data: null,
      message: err?.toString() || '未知错误',
    };
  }
}

