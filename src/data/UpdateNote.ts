import UpdateNoteContainer from "@/components/UpdateNoteContainer.vue";
import { NButton, NImage, NTag } from "naive-ui";
import { VNode } from "vue";
import { FETCH_API } from "./constants";

export const updateNotes: updateNoteType[] = [
  {
    ver: 2,
    date: '2025.4.8',
    items: [
      {
        type: 'new',
        title: 'EventFetcher Tauri 客户端开始测试',
        content: [
          ['比当前所有 EventFetcher 部署方法都更要简单且支持扫码登录的客户端开始测试力, 支持Windows, Linux, MacOS (后两个没测试过'],
          [
            '如果对此感兴趣的话可以使用 ',
            () => h(NButton, {
              text: true, tag: 'a', href: FETCH_API + 'https://github.com/Megghy/vtsuru-fetcher-client/releases/download/app-v0.1.0/vtsuru-fetcher-client_0.1.0_x64-setup.exe', target: '_blank', type: 'info'
            }, () => '这个链接'),
            ' 下载Windows客户端, 其他平台请在下面的客户端 Repo 中的 Release 下载',
          ],
          [
            '当前可能存在一些问题, 可以加入秋秋群 873260337 进行反馈, 有功能需求也可以提出'
          ],
          [],
          [
            '源码: ',
            () => h(NButton, {
              text: true, tag: 'a', href: 'https://github.com/Megghy/vtsuru-fetvher-client', target: '_blank', type: 'info'
            }, () => ' 客户端 Repo '),
            ' | ',
            () => h(NButton, {
              text: true, tag: 'a', href: 'https://github.com/Megghy/vtsuru.live/tree/master/src/client', target: '_blank', type: 'info'
            }, () => ' UI/逻辑 '),
          ],
          [
            () => h(NImage, { src: 'https://pan.suki.club/d/vtsuru/imgur/01295402D7FBBF192FE5608179A4A7A6.png', width: 200 }),
          ]
        ]
      }
    ],
  },
  {
    ver: 1,
    date: '2025.3.18',
    items: [
      {
        title: '歌单',
        type: 'optimize',
        content: [
          [
            '新增一个歌单样式: 列表',
            () => h(NImage, { src: 'https://pan.suki.club/d/vtsuru/imgur/QQ20250408-134631.png', width: 300, height: 200 }),
          ]
        ],
      },
    ],
  },
];

export const currentUpdateNoteVer = updateNotes.sort((a, b) => b.ver - a.ver)[0].ver;
export const currentUpdateNote = updateNotes.sort((a, b) => b.ver - a.ver)[0].items;
export const savedUpdateNoteVer = useStorage('UpdateNoteVer', 0);

export function checkUpdateNote() {
  if (savedUpdateNoteVer.value < currentUpdateNoteVer) {
    window.$dialog.create({
      title: '更新日志',
      content: () => h(UpdateNoteContainer),
      negativeText: '确定',
      positiveText: '下次更新前不再提示',
      onPositiveClick: () => {
        savedUpdateNoteVer.value = currentUpdateNoteVer;
      }
    });
  }
}

export type updateType = 'fix' | 'new' | 'optimize' | 'other';
export type updateNoteType = {
  ver: number;
  date: string;
  items: updateNoteItemType[];
};
export type updateNoteItemType = {
  title?: string | (() => VNode);
  type: updateType;
  content: updateNoteItemContentType[];
};
export type updateNoteItemContentType = (() => VNode) | string | updateNoteItemContentType[];