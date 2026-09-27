import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { storage } from '@/services/api'

export type ThemeMode = 'light' | 'dark'

export interface ThemeColors {
  background: string
  foreground: string
  card: string
  cardBorder: string
  primary: string
  primaryForeground: string
  muted: string
  accent: string
  heroBg: string
  heroFg: string
  heroFgMuted: string
}

// Mesmos tokens de apps/web/app/globals.css — claro e escuro.
const LIGHT: ThemeColors = {
  background: '#ffffff', foreground: '#0a0a0a', card: '#f5f5f5', cardBorder: '#e5e5e5',
  primary: '#1F3A6E', primaryForeground: '#ffffff', muted: '#737373', accent: '#3b82f6',
  heroBg: '#1F3A6E', heroFg: '#ffffff', heroFgMuted: 'rgba(255,255,255,0.7)',
}
const DARK: ThemeColors = {
  background: '#0a0f1e', foreground: '#f5f5f5', card: '#111827', cardBorder: '#1f2937',
  primary: '#3b82f6', primaryForeground: '#ffffff', muted: '#9ca3af', accent: '#60a5fa',
  heroBg: '#ffffff', heroFg: '#0a0a0a', heroFgMuted: 'rgba(10,10,10,0.6)',
}

interface ThemeContextValue {
  mode: ThemeMode
  colors: ThemeColors
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('dark')

  useEffect(() => {
    storage.get('theme_mode').then(saved => {
      if (saved === 'light' || saved === 'dark') setMode(saved)
    })
  }, [])

  function toggleTheme() {
    setMode(prev => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark'
      storage.set('theme_mode', next)
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ mode, colors: mode === 'light' ? LIGHT : DARK, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
