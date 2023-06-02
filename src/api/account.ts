import QueryAPI from '@/api/query'
import { BASE_API } from '@/data/constants'
import { APIRoot } from './api-models'

const ACCOUNT_URL = `${BASE_API}account/`

export async function Register(name: string, email: string, password: string): Promise<APIRoot<string>> {
  return QueryAPI<string>(`${ACCOUNT_URL}register`, {
    name,
    email,
    password,
  })
}

export async function Login(nameOrEmail: string, password: string): Promise<APIRoot<string>> {
  return QueryAPI<string>(`${ACCOUNT_URL}login`, {
    nameOrEmail,
    password,
  })
}
