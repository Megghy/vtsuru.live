import { usePersistedStorage } from '@/shared/storage/persist'

export interface LocalQuestion {
  id: string
  targetUserId: number
  targetUserName: string
  message: string
  tag: string | null
  anonymousName: string
  anonymousEmail: string
  hasImage: boolean
  sendAt: number
}

export function useQuestionBoxHistory() {
  const questions = usePersistedStorage<LocalQuestion[]>('vtsuru-local-questions', [], {
    serializer: {
      read: (value) => (value ? JSON.parse(value) : []),
      write: (value) => JSON.stringify(value),
    },
  })

  function add(question: LocalQuestion) {
    questions.value = [question, ...questions.value]
  }

  function remove(id: string) {
    questions.value = questions.value.filter((question) => question.id !== id)
  }

  function clear() {
    questions.value = []
  }

  return { questions, add, remove, clear }
}
