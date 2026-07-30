import type { TranscriptionProfile } from '@/shared/models/transcription'
import type { TranscriptionProviderCallbacks, TranscriptionProviderClient } from '../types'
import { OpenAITranscriptionClient } from './openai'
import { TencentTranscriptionClient } from './tencent'

export function createProvider(
  profile: TranscriptionProfile,
  callbacks: TranscriptionProviderCallbacks,
): TranscriptionProviderClient {
  return profile.provider === 'tencent'
    ? new TencentTranscriptionClient(profile, callbacks)
    : new OpenAITranscriptionClient(profile, callbacks)
}
