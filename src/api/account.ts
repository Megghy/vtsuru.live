import { QueryGetAPI, QueryPostAPI, QueryPostAPIWithParams } from '@/api/query';
import { ACCOUNT_API_URL, VTSURU_API_URL } from '@/data/constants';
import { isSameDay } from 'date-fns';
import { createDiscreteApi } from 'naive-ui';
import { ref } from 'vue';
import { APIRoot, AccountInfo, FunctionTypes } from './api-models';
import { StorageSerializers } from '@vueuse/core';

export const ACCOUNT = ref<AccountInfo>({} as AccountInfo);
export const isLoadingAccount = ref(true);
export const isLoggedIn = computed<boolean>(() => {
  return ACCOUNT.value.id > 0;
});

const { message } = createDiscreteApi(['message']);
export const cookie = useLocalStorage<{ cookie: string; refreshDate: number }>('Cookie', {cookie: '', refreshDate: 0}, { serializer: StorageSerializers.object });

export async function GetSelfAccount(token?: string) {
  if (cookie.value.cookie || token) {
    const result = await Self(token);
    if (result.code == 200) {
      if (!ACCOUNT.value.id) {
        ACCOUNT.value = result.data;
      } else {
        result.data.settings = ACCOUNT.value.settings;
        ACCOUNT.value = result.data;
      }
      isLoadingAccount.value = false;
      //console.log('[vtsuru] 已获取账户信息')
      if (!cookie.value.cookie || !isSameDay(new Date(), cookie.value!.refreshDate)) {
        refreshCookie(token);
      }
      return result.data;
    } else if (result.code == 401) {
      localStorage.removeItem('JWT_Token');
      if (!token) {
        cookie.value = undefined;
        console.warn('[vtsuru] Cookie 已失效, 需要重新登陆');
        message.error('Cookie 已失效, 需要重新登陆');
        setTimeout(() => {
          location.reload();
        }, 1500);
      }
    } else {
      console.warn('[vtsuru] ' + result.message);
      message.error(result.message);
    }
  }
  isLoadingAccount.value = false;
}

export function UpdateAccountLoop() {
  setInterval(() => {
    if (ACCOUNT.value && window.$route?.name != 'question-display') {
      // 防止在问题详情页刷新
      GetSelfAccount();
    }
  }, 60 * 1000);
}
function refreshCookie(token?: string) {
  QueryPostAPIWithParams<string>(`${ACCOUNT_API_URL}refresh-token`, { token }).then((data) => {
    if (data.code == 200) {
      cookie.value = {
        cookie: data.data,
        refreshDate: new Date().getTime()
      };
      console.log('[vtsuru] 已刷新Cookie');
    }
  });
}
export async function SaveAccountSettings() {
  return await QueryPostAPI(
    ACCOUNT_API_URL + 'update-setting',
    ACCOUNT.value?.settings
  );
}
export async function SaveEnableFunctions(functions: FunctionTypes[]) {
  return await QueryPostAPI(
    ACCOUNT_API_URL + 'update-enable-functions',
    functions
  );
}
export async function SaveSetting(
  name:
    | 'Queue'
    | 'Point'
    | 'Index'
    | 'General'
    | 'QuestionDisplay'
    | 'SongRequest'
    | 'QuestionBox'
    | 'SendEmail',
  setting: unknown
) {
  const result = await QueryPostAPIWithParams(
    ACCOUNT_API_URL + 'update-single-setting',
    {
      name
    },
    setting
  );
  return result.message;
}
export async function UpdateFunctionEnable(func: FunctionTypes) {
  if (ACCOUNT.value) {
    const oldValue = JSON.parse(
      JSON.stringify(ACCOUNT.value.settings.enableFunctions)
    );
    if (ACCOUNT.value?.settings.enableFunctions.includes(func)) {
      ACCOUNT.value.settings.enableFunctions =
        ACCOUNT.value.settings.enableFunctions.filter((f) => f != func);
    } else {
      ACCOUNT.value.settings.enableFunctions.push(func);
    }
    await SaveEnableFunctions(ACCOUNT.value?.settings.enableFunctions)
      .then((data) => {
        if (data.code == 200) {
          message.success(
            `已${ACCOUNT.value?.settings.enableFunctions.includes(func) ? '启用' : '禁用'}`
          );
        } else {
          if (ACCOUNT.value) {
            ACCOUNT.value.settings.enableFunctions = oldValue;
          }
          message.error(
            `${ACCOUNT.value?.settings.enableFunctions.includes(func) ? '启用' : '禁用'}失败: ${data.message}`
          );
        }
      })
      .catch((err) => {
        message.error(
          `${ACCOUNT.value?.settings.enableFunctions.includes(func) ? '启用' : '禁用'}失败: ${err}`
        );
      });
  }
}
export function useAccount() {
  return ACCOUNT;
}

export async function Register(
  name: string,
  email: string,
  password: string,
  token: string
): Promise<APIRoot<string>> {
  return QueryPostAPI<string>(`${ACCOUNT_API_URL}register`, {
    name,
    email,
    password,
    token
  });
}

export async function Login(
  nameOrEmail: string,
  password: string
): Promise<APIRoot<string>> {
  return QueryPostAPI<string>(`${ACCOUNT_API_URL}login`, {
    nameOrEmail,
    password
  });
}
export async function Self(token?: string): Promise<APIRoot<AccountInfo>> {
  return QueryPostAPIWithParams<AccountInfo>(`${ACCOUNT_API_URL}self`, token ? { token } : undefined);
}
export async function AddBiliBlackList(
  id: number,
  name: string
): Promise<APIRoot<unknown>> {
  return QueryGetAPI<AccountInfo>(`${ACCOUNT_API_URL}black-list/add-bili`, {
    id: id,
    name: name
  });
}
export async function DelBiliBlackList(id: number): Promise<APIRoot<unknown>> {
  return QueryGetAPI<AccountInfo>(`${ACCOUNT_API_URL}black-list/del-bili`, {
    id: id
  });
}
export async function DelBlackList(id: number): Promise<APIRoot<unknown>> {
  return QueryGetAPI<AccountInfo>(`${ACCOUNT_API_URL}black-list/del`, {
    id: id
  });
}
export function downloadConfigDirect(name: string) {
  return QueryGetAPI<string>(VTSURU_API_URL + 'get-config', {
    name: name
  });
}
export type ConfigStatus = 'success' | 'error' | 'notfound';
export async function DownloadConfig<T>(name: string, id?: number): Promise<
  | {
    msg: undefined;
    status: ConfigStatus;
    data: T;
  }
  | {
    msg: string;
    status: ConfigStatus;
    data: undefined;
  }
> {
  try {
    const resp = await QueryGetAPI<string>(VTSURU_API_URL + (id ? 'get-user-config' : 'get-config'), {
      name: name,
      id: id
    });
    if (resp.code == 200) {
      console.log('已获取配置文件: ' + name);
      return {
        msg: undefined,
        status: 'success',
        data: JSON.parse(resp.data) as T
      };
    } else if (resp.code == 404) {
      console.error(`未找到名为 ${name} 的配置文件`);
      return {
        msg: `未找到名为 ${name} 的配置文件, 需要先上传`,
        status: 'notfound',
        data: undefined
      };
    } else {
      console.error(`无法获取配置文件 [${name}]: ` + resp.message);
      return {
        msg: `无法获取配置文件 [${name}]: ` + resp.message,
        status: 'error',
        data: undefined
      };
    }
  } catch (err) {
    console.error(`无法获取配置文件 [${name}]: ` + err);
    return {
      msg: `无法获取配置文件 [${name}]: ` + err,
      status: 'error',
      data: undefined
    };
  }
}
export async function UploadConfig(name: string, data: unknown) {
  try {
    const resp = await QueryPostAPI(VTSURU_API_URL + 'set-config', {
      name: name,
      json: JSON.stringify(data)
    });
    if (resp.code == 200) {
      console.log('已保存配置文件至服务器:' + name);
      return true;
    } else {
      console.error('保存失败: ' + resp.message);
    }
  } catch (err) {
    console.error(`保存配置文件失败: ` + err);
  }
  return false;
}
export async function GetConfigHash(name: string) {
  try {
    const resp = await QueryGetAPI<string>(VTSURU_API_URL + 'get-config-hash', {
      name: name
    });
    if (resp.code == 200) {
      return resp.data;
    } else {
      console.error(`获取配置文件hash失败: ` + resp.message);
      return null;
    }
  } catch (err) {
    console.error(`获取配置文件hash失败: ` + err);
    return null;
  }
}
export async function EnableFunction(func: FunctionTypes) {
  if (ACCOUNT.value) {
    if (ACCOUNT.value.settings.enableFunctions.includes(func)) {
      return true;
    } else {
      ACCOUNT.value.settings.enableFunctions.push(func);
      if (await updateFunctionEnable()) {
        return true;
      } else {
        ACCOUNT.value.settings.enableFunctions.splice(
          ACCOUNT.value.settings.enableFunctions.indexOf(func),
          1
        );
        return false;
      }
    }
  }
  return false;
}
export async function DisableFunction(func: FunctionTypes) {
  if (ACCOUNT.value) {
    if (!ACCOUNT.value.settings.enableFunctions.includes(func)) {
      return true;
    } else {
      ACCOUNT.value.settings.enableFunctions.splice(
        ACCOUNT.value.settings.enableFunctions.indexOf(func),
        1
      );
      if (await updateFunctionEnable()) {
        return true;
      } else {
        ACCOUNT.value.settings.enableFunctions.push(func);
        return false;
      }
    }
  }
  return false;
}
async function updateFunctionEnable() {
  if (ACCOUNT.value) {
    try {
      const data = await SaveEnableFunctions(
        ACCOUNT.value.settings.enableFunctions
      );
      if (data.code == 200) {
        return true;
      } else {
        return false;
      }
    } catch (err) {
      console.log(err);
      return false;
    }
  }
}
