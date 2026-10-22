import { Field, Root, Type } from 'protobufjs'
import { describe, expect, it } from 'vitest'

import { decodeInteractWord } from '../interactWord'

const userBaseType = new Type('UserBase').add(new Field('name', 1, 'string')).add(new Field('face', 2, 'string'))
const userInfoType = new Type('UserInfo').add(new Field('base', 2, 'UserBase'))
const interactWordType = new Type('InteractWord')
  .add(new Field('uid', 1, 'int64'))
  .add(new Field('uname', 2, 'string'))
  .add(new Field('msgType', 5, 'int64'))
  .add(new Field('timestamp', 7, 'int64'))
  .add(new Field('uinfo', 22, 'UserInfo'))
new Root().add(userBaseType).add(userInfoType).add(interactWordType).resolveAll()

function encode(payload: Record<string, unknown>) {
  return Buffer.from(interactWordType.encode(payload).finish()).toString('base64')
}

describe('decodeInteractWord', () => {
  it('keeps the top-level uname when present', () => {
    expect(
      decodeInteractWord(encode({ uid: 1, uname: '顶层用户', msgType: 1, timestamp: 1 })),
    ).toEqual(expect.objectContaining({ uid: 1, uname: '顶层用户' }))
  })

  it('falls back to uinfo.base.name when the top-level uname is empty', () => {
    expect(
      decodeInteractWord(
        encode({
          uid: 2,
          uname: '',
          msgType: 1,
          timestamp: 1,
          uinfo: { base: { name: '资料用户', face: 'http://example.com/a.jpg' } },
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        uid: 2,
        uname: '资料用户',
        avatar: 'http://example.com/a.jpg',
      }),
    )
  })
})
