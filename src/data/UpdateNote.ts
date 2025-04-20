import UpdateNoteContainer from "@/components/UpdateNoteContainer.vue";
import { NButton, NImage, NTag } from "naive-ui";
import { VNode } from "vue";
import { FETCH_API } from "./constants";

export const updateNotes: updateNoteType[] = [
  {
    ver: 3,
    date: '2025.4.15',
    items: [
      {
        type: 'new',
        title: 'Tauri 客户端新增弹幕机功能',
        content: [
          [
            'Tauri 客户端新增弹幕机功能, 可以在自己电脑上显示弹幕礼物等. ',
            '客户端需更新至0.1.2版本, 重启客户端后会自动更新',
            () => h(NImage, { src: 'https://pan.suki.club/d/vtsuru/imgur/81d76a89-96b8-44e9-be79-6caaa5741f64.png', width: 200 }),
          ]
        ],
      },
    ]
  },
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
            '安装方式: ',
            () => h(NButton, {
              text: true, tag: 'a', href: 'https://www.wolai.com/carN6qvUm3FErze9Xo53ii', target: '_blank', type: 'info'
            }, () => '查看介绍'),
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
      },
      onClose: () => {
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