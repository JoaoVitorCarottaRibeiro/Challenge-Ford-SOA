import { useEffect, useState } from 'react'
import { Stack, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { storage } from '@/services/api'
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext'

function RootNavigator() {
  const router = useRouter()
  const { mode } = useTheme()

  useEffect(() => {
    async function checkAuth() {
      const token = await storage.get('access_token')
      if (!token) {
        router.replace('/(auth)/login')
      }
    }

    const timer = setTimeout(checkAuth, 50)
    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      <StatusBar style={mode === 'light' ? 'dark' : 'light'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  )
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  )
}