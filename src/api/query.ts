/* eslint-disable indent */
import { APIRoot } from './api-models';

export default async function QueryAPI<T>(url: string, body?: unknown): Promise<APIRoot<T>> {
    const data = await fetch(url,{
          method: 'post',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        }); // 不处理异常, 在页面处理
    return await data.json() as APIRoot<T>;
}
