'use client'

// AuthContext — provides user identity and JWT to the entire app.
//
// Why localStorage (not httpOnly cookie):
//   The y-websocket params option appends the token to the WS URL. The JS on
//   the page must be able to read it. httpOnly cookies are invisible to JS, so
//   they'd force a separate "issue WS ticket" endpoint. localStorage keeps
//   things simple and consistent — both fetch() and the WS provider read the
//   same token.
//
// Why a `mounted` flag:
//   localStorage is only readable in the browser, so the first server/SSR pass
//   has token=null. Without `mounted`, protected pages would flash a redirect
//   before the real token loads. Pages gate on `mounted` first.

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface User {
  id: string
  email: string
}

interface AuthContextValue {
  user: User | null
  token: string | null
  mounted: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const storedToken = localStorage.getItem('livedocs_token')
    const storedUser = localStorage.getItem('livedocs_user')
    if (storedToken && storedUser) {
      setToken(storedToken)
      setUser(JSON.parse(storedUser))
    }
    setMounted(true)
  }, [])

  function persist(newToken: string, newUser: User) {
    localStorage.setItem('livedocs_token', newToken)
    localStorage.setItem('livedocs_user', JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }

  async function login(email: string, password: string) {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.detail || 'Login failed')
    }
    const data = await res.json()
    persist(data.access_token, data.user)
    router.push('/')
  }

  async function signup(email: string, password: string) {
    const res = await fetch(`${API}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.detail || 'Signup failed')
    }
    const data = await res.json()
    persist(data.access_token, data.user)
    router.push('/')
  }

  function logout() {
    localStorage.removeItem('livedocs_token')
    localStorage.removeItem('livedocs_user')
    setToken(null)
    setUser(null)
    router.push('/login')
  }

  return (
    <AuthContext.Provider value={{ user, token, mounted, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

// Typed wrapper around fetch that injects the Bearer token and throws on non-2xx.
export async function apiFetch(
  path: string,
  token: string | null,
  options: RequestInit = {},
): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API}${path}`, { ...options, headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).detail || `HTTP ${res.status}`)
  }
  return res.json()
}
