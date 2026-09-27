import { useEffect, useMemo, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator
} from 'react-native'
import { ChevronDown, X } from 'lucide-react-native'
import api from '@/services/api'
import SpecReport from '@/components/SpecReport'
import { HERO_FIELDS, formatSpecValue } from '@/constants/specCategories'
import { useTheme, ThemeColors } from '@/contexts/ThemeContext'

interface Vehicle {
  id: string
  brand: string
  model: string
  version: string
  yearModel: number
  spec: Record<string, any> | null
}

function vehicleLabel(v: Vehicle) {
  return `${v.brand} ${v.model} ${v.version} - ${v.yearModel}`
}

export default function CompareScreen() {
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading,  setLoading]  = useState(true)
  const [vehicleA, setVehicleA] = useState<Vehicle | null>(null)
  const [vehicleB, setVehicleB] = useState<Vehicle | null>(null)
  const [picking,  setPicking]  = useState<'A' | 'B' | null>(null)

  useEffect(() => {
    api.get('/vehicles')
      .then(res => setVehicles(res.data.filter((v: Vehicle) => v.spec !== null)))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  function selectVehicle(v: Vehicle) {
    if (picking === 'A') setVehicleA(v)
    else if (picking === 'B') setVehicleB(v)
    setPicking(null)
  }

  if (picking) {
    return (
      <View style={styles.container}>
        <View style={[styles.content, { flex: 1 }]}>
          <TouchableOpacity onPress={() => setPicking(null)} style={styles.backBtn}>
            <Text style={styles.backText}>← Cancelar</Text>
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Escolha o Veículo {picking}</Text>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {vehicles.map(v => (
              <TouchableOpacity
                key={v.id}
                style={[
                  styles.pickCard,
                  (picking === 'A' ? vehicleA : vehicleB)?.id === v.id && styles.pickCardSelected
                ]}
                onPress={() => selectVehicle(v)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickName}>{v.brand} {v.model} {v.version}</Text>
                  <Text style={styles.pickSub}>{v.yearModel}</Text>
                </View>
                {v.spec?.potenciaCv && (
                  <Text style={styles.pickBadge}>{v.spec.potenciaCv} cv</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        <Text style={styles.pageTitle}>Comparativo</Text>
        {(vehicleA || vehicleB) && (
          <TouchableOpacity onPress={() => { setVehicleA(null); setVehicleB(null) }} style={styles.clearSelectionBtn}>
            <X color={colors.muted} size={12} />
            <Text style={styles.clearSelectionText}>Limpar seleção</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.selectors}>
        <TouchableOpacity
          style={[styles.selectorBtn, { borderColor: colors.accent }]}
          onPress={() => setPicking('A')}>
          <Text style={styles.selectorLabel}>Veículo A</Text>
          <Text style={styles.selectorValue} numberOfLines={2}>
            {vehicleA ? vehicleLabel(vehicleA) : 'Selecionar'}
          </Text>
          <ChevronDown color={colors.muted} size={14} />
        </TouchableOpacity>

        <View style={styles.vsContainer}>
          <Text style={styles.vs}>VS</Text>
        </View>

        <TouchableOpacity
          style={[styles.selectorBtn, { borderColor: colors.accent }]}
          onPress={() => setPicking('B')}>
          <Text style={styles.selectorLabel}>Veículo B</Text>
          <Text style={styles.selectorValue} numberOfLines={2}>
            {vehicleB ? vehicleLabel(vehicleB) : 'Selecionar'}
          </Text>
          <ChevronDown color={colors.muted} size={14} />
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />}

      {vehicleA && vehicleB && (
        <>
          <Text style={styles.sectionTitle}>Destaques</Text>
          <View style={styles.table}>
            {HERO_FIELDS.map(field => {
              const aVal = vehicleA.spec?.[field.key]
              const bVal = vehicleB.spec?.[field.key]
              if (aVal == null && bVal == null) return null
              return (
                <View key={field.key} style={styles.tableRow}>
                  <Text style={[styles.cellText, styles.cellLeft, styles.normalText]}>
                    {formatSpecValue(aVal, field)}
                  </Text>
                  <Text style={styles.tableLabel}>{field.label}</Text>
                  <Text style={[styles.cellText, styles.cellRight, styles.normalText]}>
                    {formatSpecValue(bVal, field)}
                  </Text>
                </View>
              )
            })}
          </View>

          <Text style={styles.sectionTitle}>Relatório completo</Text>
          <SpecReport spec={vehicleA.spec} specB={vehicleB.spec} defaultOpenFirst={false} />
        </>
      )}

      {!vehicleA && !vehicleB && !loading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Compare dois veículos</Text>
          <Text style={styles.emptySub}>
            Selecione dois veículos acima para ver o comparativo lado a lado
          </Text>
        </View>
      )}
    </ScrollView>
  )
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container:       { flex: 1, backgroundColor: c.background },
    content:         { padding: 20, paddingTop: 60, paddingBottom: 40 },
    titleRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    pageTitle:       { fontSize: 22, fontWeight: 'bold', color: c.foreground },
    clearSelectionBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
      borderWidth: 1, borderColor: c.cardBorder, backgroundColor: c.card
    },
    clearSelectionText: { fontSize: 11, fontWeight: '600', color: c.muted },
    selectors:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 28 },
    selectorBtn: {
      flex: 1, backgroundColor: c.card, borderRadius: 12,
      padding: 12, borderWidth: 1.5, minHeight: 80
    },
    selectorLabel:   { fontSize: 11, color: c.muted, fontWeight: '600', marginBottom: 4 },
    selectorValue:   { fontSize: 12, color: c.foreground, fontWeight: '600', marginBottom: 6, lineHeight: 18 },
    vsContainer:     { alignItems: 'center', justifyContent: 'center', paddingTop: 28 },
    vs:              { fontSize: 14, fontWeight: 'bold', color: c.muted },
    sectionTitle: {
      fontSize: 12, fontWeight: '700', color: c.muted,
      textTransform: 'uppercase', letterSpacing: 1,
      marginBottom: 10, marginTop: 20
    },
    table: {
      backgroundColor: c.card, borderRadius: 14,
      borderWidth: 1, borderColor: c.cardBorder, overflow: 'hidden'
    },
    tableRow: {
      flexDirection: 'row', alignItems: 'center',
      borderBottomWidth: 1, borderBottomColor: c.cardBorder,
      paddingVertical: 12, paddingHorizontal: 16
    },
    cellText:        { flex: 1 },
    cellLeft:        { alignItems: 'flex-end', paddingRight: 10 },
    cellRight:       { alignItems: 'flex-start', paddingLeft: 10 },
    normalText:      { color: c.foreground, fontSize: 14, fontWeight: '500' },
    winnerText:      { color: '#10b981', fontSize: 14, fontWeight: '700' },
    tableLabel: {
      width: 130, textAlign: 'center', fontSize: 11,
      color: c.muted, fontWeight: '500'
    },
    backBtn:         { marginBottom: 20 },
    backText:        { color: c.accent, fontSize: 16, fontWeight: '600' },
    pickCard: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.card, borderRadius: 12, padding: 16,
      borderWidth: 1, borderColor: c.cardBorder, marginBottom: 10
    },
    pickCardSelected: { borderColor: c.accent, backgroundColor: `${c.accent}20` },
    pickName:        { fontSize: 14, fontWeight: '600', color: c.foreground },
    pickSub:         { fontSize: 12, color: c.muted, marginTop: 2 },
    pickBadge: {
      fontSize: 12, fontWeight: '700', color: c.accent,
      backgroundColor: c.background, paddingHorizontal: 8,
      paddingVertical: 3, borderRadius: 6, marginLeft: 8
    },
    emptyState:      { alignItems: 'center', marginTop: 60 },
    emptyTitle:      { fontSize: 18, fontWeight: 'bold', color: c.foreground, marginBottom: 8 },
    emptySub:        { fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 20 }
  })
}
