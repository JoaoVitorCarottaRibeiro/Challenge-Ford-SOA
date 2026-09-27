import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, KeyboardAvoidingView, ScrollView, Platform
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react-native'
import { router } from 'expo-router'
import { storage } from '@/services/api'
import api from '@/services/api'

export default function LoginScreen() {
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')

  async function handleLogin() {
    setError('')

    if (!email || !password) {
      setError('Preencha email e senha.')
      return
    }

    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      await storage.set('access_token', data.accessToken)
      await storage.set('refresh_token', data.refreshToken)
      await storage.set('user_role', data.role)
      await storage.set('user_email', email)
      router.replace('/(tabs)')
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Email ou senha inválidos.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0b1830', '#16264d', '#1F3A6E']}
        locations={[0, 0.55, 1]}
        style={styles.hero}>
        <Image source={require('../../assets/fordiq-logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.tagline}>
          Especificações técnicas padronizadas de toda a concorrência, em um só lugar.
        </Text>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.sheetWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Bem-vindo(a)</Text>
          <Text style={styles.subtitle}>Inteligência Competitiva Automotiva</Text>

          <View style={styles.fieldBox}>
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              style={styles.fieldInput}
              value={email}
              onChangeText={t => { setEmail(t); setError('') }}
              placeholder="seu@email.com"
              placeholderTextColor="#a3a3a3"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.fieldBox}>
            <Text style={styles.fieldLabel}>Senha</Text>
            <View style={styles.fieldRow}>
              <TextInput
                style={[styles.fieldInput, styles.fieldInputFlex]}
                value={password}
                onChangeText={t => { setPassword(t); setError('') }}
                placeholder="••••••••"
                placeholderTextColor="#a3a3a3"
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={8}>
                {showPassword
                  ? <EyeOff size={16} color="#a3a3a3" />
                  : <Eye size={16} color="#a3a3a3" />
                }
              </TouchableOpacity>
            </View>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}>
            <Text style={styles.buttonText}>{loading ? 'Entrando...' : 'Continuar'}</Text>
          </TouchableOpacity>

          <View style={styles.secureRow}>
            <ShieldCheck size={14} color="#737373" />
            <Text style={styles.secureText}>Ambiente Seguro</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#ffffff' },
  hero: {
    height: 280, alignItems: 'center', justifyContent: 'center', padding: 32
  },
  logo:       { width: 200, height: 78, marginBottom: 20 },
  tagline:    { fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center', maxWidth: 280 },

  sheetWrapper: { flex: 1 },
  sheet: {
    flexGrow: 1, backgroundColor: '#ffffff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    marginTop: -24, padding: 28, paddingTop: 36
  },

  title:      { fontSize: 26, fontWeight: '400', color: '#171717' },
  subtitle:   { fontSize: 14, color: '#737373', marginBottom: 32 },

  fieldBox: {
    backgroundColor: '#f5f5f5', borderRadius: 10,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8,
    marginBottom: 14
  },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: '#1d4ed8', marginBottom: 2 },
  fieldRow:   { flexDirection: 'row', alignItems: 'center' },
  fieldInput: { fontSize: 14, color: '#171717', paddingVertical: 2 },
  fieldInputFlex: { flex: 1 },

  errorBox: {
    backgroundColor: '#fef2f2', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14
  },
  errorText:  { color: '#dc2626', fontSize: 13 },

  button: {
    backgroundColor: '#1F3A6E', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginTop: 4
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  secureRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 28
  },
  secureText: { fontSize: 12, fontWeight: '500', color: '#737373' }
})
