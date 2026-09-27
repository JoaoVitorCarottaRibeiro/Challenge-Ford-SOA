import { useEffect, useMemo, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, TextInput, Alert
} from 'react-native'
import { Search, ChevronRight, Trash2 } from 'lucide-react-native'
import api from '@/services/api'
import SpecReport from '@/components/SpecReport'
import { BrandBadge } from '@/components/BrandBadge'
import { HERO_FIELDS, formatSpecValue } from '@/constants/specCategories'
import { useTheme, ThemeColors } from '@/contexts/ThemeContext'

interface Vehicle {
  id: string
  brand: string
  model: string
  version: string
  yearModel: number
  spec: (Record<string, unknown> & {
    potenciaCv: number | null
    source?: string
    pdfSourceFile?: string | null
  }) | null
}

export default function VehiclesScreen() {
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [search, setSearch]     = useState('')
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<Vehicle | null>(null)

  function loadVehicles() {
    setLoading(true)
    api.get('/vehicles')
      .then(res => setVehicles(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadVehicles() }, [])

  const brands = useMemo(() => [...new Set(vehicles.map(v => v.brand))].sort(), [vehicles])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return vehicles.filter(v =>
      (!selectedBrand || v.brand === selectedBrand) &&
      `${v.brand} ${v.model} ${v.version} ${v.yearModel}`.toLowerCase().includes(q)
    )
  }, [vehicles, search, selectedBrand])

  function confirmDelete(v: Vehicle) {
    Alert.alert(
      'Remover veículo',
      `Deseja remover ${v.brand} ${v.model} ${v.version} ${v.yearModel}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover', style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/vehicles/${v.id}`)
              if (selected?.id === v.id) setSelected(null)
              loadVehicles()
            } catch {
              Alert.alert('Erro', 'Não foi possível remover o veículo.')
            }
          }
        }
      ]
    )
  }

  if (selected) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.detailTopBar}>
          <TouchableOpacity onPress={() => setSelected(null)} style={styles.backBtn}>
            <Text style={styles.backText}>← Voltar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => confirmDelete(selected)} style={styles.deleteBtn}>
            <Trash2 color="#ef4444" size={18} />
          </TouchableOpacity>
        </View>

        <View style={styles.detailHeader}>
          <BrandBadge brand={selected.brand} size={44} />
          <View style={{ marginTop: 12 }}>
            <Text style={styles.detailBrand}>{selected.brand}</Text>
            <Text style={styles.detailModel}>{selected.model} {selected.version}</Text>
            <Text style={styles.detailYear}>{selected.yearModel}</Text>
          </View>
        </View>

        {selected.spec ? (
          <>
            <View style={styles.heroGrid}>
              {HERO_FIELDS.map(field => {
                const val = selected.spec?.[field.key]
                if (val == null) return null
                return (
                  <View key={field.key} style={styles.heroCard}>
                    <Text style={styles.heroValue}>{formatSpecValue(val, field)}</Text>
                    <Text style={styles.heroLabel}>{field.label}</Text>
                  </View>
                )
              })}
            </View>

            <SpecReport spec={selected.spec} />
          </>
        ) : (
          <Text style={styles.empty}>Sem especificações disponíveis.</Text>
        )}
      </ScrollView>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.pageTitle}>Veículos</Text>

        <View style={styles.searchBox}>
          <Search color={colors.muted} size={16} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar veículo..."
            placeholderTextColor={colors.muted}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.brandRow} contentContainerStyle={{ gap: 8 }}>
          <TouchableOpacity
            onPress={() => setSelectedBrand(null)}
            style={[styles.brandChip, selectedBrand === null && styles.brandChipActive]}>
            <Text style={[styles.brandChipText, selectedBrand === null && styles.brandChipTextActive]}>Todas as marcas</Text>
          </TouchableOpacity>
          {brands.map(b => {
            const active = selectedBrand === b
            return (
              <TouchableOpacity
                key={b}
                onPress={() => setSelectedBrand(active ? null : b)}
                style={[styles.brandChip, styles.brandChipWithLogo, active && styles.brandChipActive]}>
                <BrandBadge brand={b} size={20} />
                <Text style={[styles.brandChipText, active && styles.brandChipTextActive]}>{b}</Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {filtered.map(v => (
              <View key={v.id} style={styles.vehicleCard}>
                <TouchableOpacity style={styles.vehicleCardMain} onPress={() => setSelected(v)}>
                  <BrandBadge brand={v.brand} size={40} />
                  <View style={styles.vehicleInfo}>
                    <Text style={styles.vehicleName}>{v.brand} {v.model}</Text>
                    <Text style={styles.vehicleSub}>{v.version} · {v.yearModel}</Text>
                  </View>
                  {v.spec?.potenciaCv && (
                    <Text style={styles.powerBadge}>{v.spec.potenciaCv} cv</Text>
                  )}
                  <ChevronRight color={colors.muted} size={16} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmDelete(v)} style={styles.rowDeleteBtn} hitSlop={8}>
                  <Trash2 color="#ef4444" size={16} />
                </TouchableOpacity>
              </View>
            ))}
            {filtered.length === 0 && (
              <Text style={styles.empty}>Nenhum veículo encontrado.</Text>
            )}
          </ScrollView>
        )}
      </View>
    </View>
  )
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container:      { flex: 1, backgroundColor: c.background },
    content:        { flex: 1, padding: 20, paddingTop: 60 },
    pageTitle:      { fontSize: 22, fontWeight: 'bold', color: c.foreground, marginBottom: 16 },
    searchBox: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: c.card, borderRadius: 12, paddingHorizontal: 14,
      paddingVertical: 10, borderWidth: 1, borderColor: c.cardBorder, marginBottom: 12
    },
    searchInput:    { flex: 1, color: c.foreground, fontSize: 14 },
    brandRow:       { marginBottom: 16, maxHeight: 40 },
    brandChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
      borderWidth: 1, borderColor: c.cardBorder, backgroundColor: c.card
    },
    brandChipWithLogo: { paddingLeft: 6 },
    brandChipActive:   { backgroundColor: c.primary, borderColor: c.primary },
    brandChipText:     { fontSize: 12, fontWeight: '700', color: c.foreground },
    brandChipTextActive: { color: c.primaryForeground },
    vehicleCard: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.card, borderRadius: 14,
      borderWidth: 1, borderColor: c.cardBorder, marginBottom: 10
    },
    vehicleCardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
    vehicleInfo:    { flex: 1 },
    vehicleName:    { fontSize: 14, fontWeight: '600', color: c.foreground },
    vehicleSub:     { fontSize: 12, color: c.muted, marginTop: 2 },
    powerBadge: {
      fontSize: 12, fontWeight: '700', color: c.accent,
      backgroundColor: c.background, paddingHorizontal: 8,
      paddingVertical: 3, borderRadius: 6
    },
    rowDeleteBtn: { paddingHorizontal: 14, paddingVertical: 14 },
    detailTopBar: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: 20, marginTop: 60
    },
    backBtn:        {},
    backText:       { color: c.accent, fontSize: 16, fontWeight: '600' },
    deleteBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: c.card, alignItems: 'center', justifyContent: 'center'
    },
    detailHeader:   { borderRadius: 16, padding: 24, marginBottom: 20, backgroundColor: c.heroBg },
    detailBrand:    { fontSize: 13, color: c.heroFgMuted, fontWeight: '600' },
    detailModel:    { fontSize: 24, fontWeight: 'bold', color: c.heroFg, marginTop: 4 },
    detailYear:     { fontSize: 14, color: c.heroFgMuted, marginTop: 4 },
    heroGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16, marginTop: 4 },
    heroCard: {
      flex: 1, minWidth: '45%', backgroundColor: c.card,
      borderRadius: 12, paddingVertical: 18, paddingHorizontal: 16,
      borderWidth: 1, borderColor: c.cardBorder, alignItems: 'center'
    },
    heroValue:      { fontSize: 18, fontWeight: 'bold', color: c.foreground, marginBottom: 4 },
    heroLabel:      { fontSize: 11, color: c.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
    empty:          { color: c.muted, textAlign: 'center', marginTop: 20 }
  })
}
