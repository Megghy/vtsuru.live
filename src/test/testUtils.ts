import type { QAInfo, Setting_QuestionDisplay, UploadFileResponse } from '@/api/api-models'
import {
  QuestionDisplayAlign,
  QuestionDisplayImageLayout,
  QuestionDisplayShadow,
  QuestionDisplayTransition,
  QuestionDisplayVerticalAlign,
} from '@/api/api-models'
import { createDefaultQuestionDisplaySetting } from '@/shared/questionDisplayPresets'

export function createMockUploadFile(overrides?: Partial<UploadFileResponse>): UploadFileResponse {
  return {
    id: 1,
    name: 'test-image.png',
    hash: 'hash-mock',
    path: 'https://example.com/test-image.png',
    ...overrides,
  }
}

export function createMockQuestion(overrides?: Partial<QAInfo>): QAInfo {
  return {
    id: 101,
    sender: {
      id: 2001,
      name: '提问观众A',
      isBiliAuthed: false,
    },
    target: {
      id: 1001,
      name: '主播B',
      isBiliAuthed: true,
    },
    question: {
      message: '测试提问正文内容',
    },
    isAnonymous: false,
    anonymousName: '匿名观众',
    isSenderRegisted: true,
    isSenderBiliAuthed: false,
    isReaded: false,
    isFavorite: false,
    isPublic: true,
    tag: '杂谈',
    sendAt: 1700000000,
    questionImages: [],
    answerImages: [],
    ...overrides,
  }
}

export function createMockQuestionDisplaySetting(
  overrides?: Partial<Setting_QuestionDisplay>,
): Setting_QuestionDisplay {
  return {
    ...createDefaultQuestionDisplaySetting(),
    align: QuestionDisplayAlign.Left,
    verticalAlign: QuestionDisplayVerticalAlign.Top,
    transition: QuestionDisplayTransition.Fade,
    imageLayout: QuestionDisplayImageLayout.Contain,
    shadow: QuestionDisplayShadow.Soft,
    textShadow: QuestionDisplayShadow.None,
    ...overrides,
  }
}
