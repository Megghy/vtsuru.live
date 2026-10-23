import { describe, expect, it } from 'vitest'

import { isQuestionSubmitAllowed } from '../useQuestionComposer'

describe('isQuestionSubmitAllowed', () => {
  it('allows guests when unregistered is on, even if identity hiding is off', () => {
    expect(
      isQuestionSubmitAllowed({
        allowUnregistedUser: true,
        allowAnonymous: false,
        isIdentified: false,
        isAnonymous: true,
      }),
    ).toBe(true)
  })

  it('blocks guests only by the unregistered switch', () => {
    expect(
      isQuestionSubmitAllowed({
        allowUnregistedUser: false,
        allowAnonymous: true,
        isIdentified: false,
        isAnonymous: true,
      }),
    ).toBe(false)
  })

  it('blocks identified senders from hiding identity when anonymous is off', () => {
    expect(
      isQuestionSubmitAllowed({
        allowUnregistedUser: true,
        allowAnonymous: false,
        isIdentified: true,
        isAnonymous: true,
      }),
    ).toBe(false)
  })

  it('allows identified real-name submit when anonymous is off', () => {
    expect(
      isQuestionSubmitAllowed({
        allowUnregistedUser: false,
        allowAnonymous: false,
        isIdentified: true,
        isAnonymous: false,
      }),
    ).toBe(true)
  })
})
