import { useEffect, useMemo, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator
} from 'react-native'
import { router } from 'expo-router'
import { storage } from '@/services/api'
import { TrendingUp, History, ArrowRight, LogOut, Sun, Moon } from 'lucide-react-native'
import api from '@/services/api'
import { BrandBadge } from '@/components/BrandBadge'
import PriceHistoryChart from '@/components/PriceHistoryChart'
import { useTheme, ThemeColors } from '@/contexts/ThemeContext'

interface Vehicle {
  id: string
  brand: string
  model: string
  version: string
  yearModel: number
  spec: {
    potenciaCv: number | null
    torqueNm: number | null
    precoBaseBrl: number | null
    source: string | null
    fetchedAt: string | null
  } | null
}

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

export default function DashboardScreen() {
  const { colors, mode, toggleTheme } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    storage.get('user_email').then(e => setUserEmail(e || ''))
    api.get('/vehicles')
      .then(res => setVehicles(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function handleLogout() {
    await storage.delete('access_token')
    await storage.delete('refresh_token')
    await storage.delete('user_role')
    await storage.delete('user_email')
    router.replace('/(auth)/login')
  }

  const brands = useMemo(() => [...new Set(vehicles.map(v => v.brand))], [vehicles])

  const recent = useMemo(
    () => vehicles
      .filter(v => v.spec?.fetchedAt)
      .sort((a, b) => new Date(b.spec!.fetchedAt!).getTime() - new Date(a.spec!.fetchedAt!).getTime())
      .slice(0, 5),
    [vehicles]
  )

  const stats = [
    { label: 'Veículos monitorados', value: vehicles.length },
    { label: 'Marcas monitoradas', value: brands.length },
  ]

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Fordiq</Text>
          <Text style={styles.headerSub}>{userEmail}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={toggleTheme} style={styles.iconBtn}>
            {mode === 'light'
              ? <Moon color={colors.foreground} size={18} />
              : <Sun color={colors.foreground} size={18} />
            }
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.iconBtn}>
            <LogOut color="#ef4444" size={18} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsGrid}>
        {stats.map(stat => (
          <View key={stat.label} style={styles.statCard}>
            <Text style={styles.statValue}>{loading ? '...' : stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          <TrendingUp color={colors.muted} size={13} /> {' '}Valor FIPE por ano-modelo
        </Text>
        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
        ) : (
          <PriceHistoryChart vehicles={vehicles} />
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>
            <History color={colors.muted} size={13} /> {' '}Atividade recente
          </Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/vehicles')} style={styles.seeAllBtn}>
            <Text style={styles.seeAllText}>Ver todos</Text>
            <ArrowRight color={colors.accent} size={12} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 12 }} />
        ) : recent.length === 0 ? (
          <Text style={styles.empty}>Nenhuma extração registrada ainda.</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {recent.map(v => (
              <View key={v.id} style={styles.activityRow}>
                <BrandBadge brand={v.brand} size={32} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.activityName} numberOfLines={1}>{v.brand} {v.model} {v.version}</Text>
                  <Text style={styles.activityDate}>{formatDate(v.spec!.fetchedAt!)}</Text>
                </View>
                {v.spec?.precoBaseBrl != null && (
                  <Text style={styles.activityPrice}>{formatBRL(v.spec.precoBaseBrl)}</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  )
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
    header: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: 24
    },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: c.foreground },
    headerSub: { fontSize: 12, color: c.muted, marginTop: 2 },
    headerActions: { flexDirection: 'row', gap: 8 },
    iconBtn: {
      width: 40, height: 40, borderRadius: 10,
      backgroundColor: c.card, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: c.cardBorder
    },
    statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    statCard: {
      flex: 1, backgroundColor: c.card,
      borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.cardBorder
    },
    statValue: { fontSize: 22, fontWeight: 'bold', color: c.foreground, marginBottom: 2 },
    statLabel: { fontSize: 11, color: c.muted },
    card: {
      backgroundColor: c.card, borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: c.cardBorder, marginBottom: 16
    },
    cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    cardTitle: {
      fontSize: 11, fontWeight: '700', color: c.muted,
      textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4
    },
    seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    seeAllText: { fontSize: 11, fontWeight: '600', color: c.accent },
    activityRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: c.background, borderRadius: 12, padding: 10
    },
    activityName: { fontSize: 13, fontWeight: '600', color: c.foreground },
    activityDate: { fontSize: 11, color: c.muted, marginTop: 1 },
    activityPrice: { fontSize: 12, fontWeight: '600', color: c.foreground },
    empty: { color: c.muted, fontSize: 13, marginTop: 4 },
  })
}
