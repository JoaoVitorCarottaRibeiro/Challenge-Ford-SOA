import { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, useWindowDimensions } from 'react-native'
import Svg, { Line as SvgLine, Polyline, Circle, Text as SvgText } from 'react-native-svg'
import { FIPE_HISTORY, fipeKey } from '@/constants/fipeHistory'
import { useTheme, ThemeColors } from '@/contexts/ThemeContext'

interface Vehicle {
  brand: string
  model: string
  version: string
  yearModel: number
  spec?: { precoBaseBrl: number | null } | null
}

// Mesma paleta categórica validada usada no web — uma cor fixa por MARCA, com
// variante clara/escura pra manter contraste nos dois temas.
const BRAND_COLOR: Record<string, { light: string; dark: string }> = {
  Ford:       { light: '#2a78d6', dark: '#3987e5' },
  Toyota:     { light: '#eb6834', dark: '#d95926' },
  Volkswagen: { light: '#1baf7a', dark: '#199e70' },
  Chevrolet:  { light: '#eda100', dark: '#c98500' },
  Mitsubishi: { light: '#e87ba4', dark: '#d55181' },
  Nissan:     { light: '#008300', dark: '#008300' },
  Fiat:       { light: '#4a3aa7', dark: '#9085e9' },
  BYD:        { light: '#e34948', dark: '#e66767' },
}
const FALLBACK_COLOR = { light: '#898781', dark: '#898781' }
const DASH_PATTERNS: (string | undefined)[] = [undefined, '7 4', '2 3']

const PRICE_BUCKETS = [
  { label: 'Até R$ 250 mil', test: (p: number) => p <= 250_000 },
  { label: 'R$ 250 mil – R$ 350 mil', test: (p: number) => p > 250_000 && p <= 350_000 },
  { label: 'Acima de R$ 350 mil', test: (p: number) => p > 350_000 },
]

function formatCompactBRL(value: number) {
  return `R$${Math.round(value / 1000)}k`
}

// Geometria do SVG: mantém a proporção original do mobile intacta e usa uma
// geometria mais "achatada" em telas largas (notebook), evitando que o mesmo
// aspect ratio do celular vire um gráfico gigantesco ao esticar a largura.
const PLOT_MOBILE = { left: 46, right: 10, top: 10, bottom: 22, width: 300, height: 140 }
const PLOT_WIDE = { left: 70, right: 24, top: 20, bottom: 34, width: 850, height: 230 }

const WIDE_BREAKPOINT = 700
const WIDE_FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

export default function PriceHistoryChart({ vehicles }: { vehicles: Vehicle[] }) {
  const { colors, mode } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { width: windowWidth } = useWindowDimensions()
  const isWide = windowWidth >= WIDE_BREAKPOINT
  const PLOT = isWide ? PLOT_WIDE : PLOT_MOBILE
  const SVG_W = PLOT.left + PLOT.width + PLOT.right
  const SVG_H = PLOT.top + PLOT.height + PLOT.bottom
  const axisFontSize = isWide ? '11' : '9'
  const axisFontFamily = isWide ? WIDE_FONT_FAMILY : undefined

  const [active, setActive] = useState<string | null>(null)
  const [brandFilter, setBrandFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [priceFilter, setPriceFilter] = useState('')

  const { allSeries, noDataAll } = useMemo(() => {
    const sorted = [...vehicles].sort((a, b) =>
      a.brand === b.brand ? a.version.localeCompare(b.version) : a.brand.localeCompare(b.brand)
    )
    const seenPerBrand: Record<string, number> = {}
    const series: {
      label: string; brand: string; yearModel: number
      precoBaseBrl: number | null
      historico: { ano: number; valor: number }[]
      kind: 'line' | 'point'
      color: string; dash: string | undefined
    }[] = []
    const noData: { label: string; brand: string; yearModel: number }[] = []

    sorted.forEach(v => {
      const entry = FIPE_HISTORY.find(f => fipeKey(f.brand, f.model, f.version) === fipeKey(v.brand, v.model, v.version))
      const precoBaseBrl = v.spec?.precoBaseBrl ?? null
      const historico = (entry?.historico ?? []).filter(h => h.ano >= v.yearModel)
      const label = `${v.brand} ${v.model} ${v.version}`

      if (historico.length === 0) {
        noData.push({ label, brand: v.brand, yearModel: v.yearModel })
        return
      }

      const idxInBrand = seenPerBrand[v.brand] ?? 0
      seenPerBrand[v.brand] = idxInBrand + 1
      const brandColor = BRAND_COLOR[v.brand] ?? FALLBACK_COLOR
      series.push({
        label, brand: v.brand, yearModel: v.yearModel, precoBaseBrl, historico,
        kind: historico.length >= 2 ? 'line' : 'point',
        color: brandColor[mode],
        dash: DASH_PATTERNS[idxInBrand % DASH_PATTERNS.length],
      })
    })

    return { allSeries: series, noDataAll: noData }
  }, [vehicles, mode])

  const brandOptions = useMemo(() => [...new Set([...allSeries, ...noDataAll].map(s => s.brand))].sort(), [allSeries, noDataAll])
  const yearOptions = useMemo(() => [...new Set([...allSeries, ...noDataAll].map(s => s.yearModel))].sort((a, b) => a - b), [allSeries, noDataAll])

  const filteredSeries = useMemo(() => allSeries.filter(s =>
    (!brandFilter || s.brand === brandFilter) &&
    (!yearFilter || s.yearModel === Number(yearFilter)) &&
    (!priceFilter || (s.precoBaseBrl != null && PRICE_BUCKETS.find(b => b.label === priceFilter)?.test(s.precoBaseBrl)))
  ), [allSeries, brandFilter, yearFilter, priceFilter])

  const filteredNoData = useMemo(() => noDataAll.filter(u =>
    (!brandFilter || u.brand === brandFilter) &&
    (!yearFilter || u.yearModel === Number(yearFilter))
  ), [noDataAll, brandFilter, yearFilter])

  const activeStillVisible = active && filteredSeries.some(s => s.label === active)
  const visibleSeries = activeStillVisible ? filteredSeries.filter(s => s.label === active) : filteredSeries

  const pointOnlyMessage =
    activeStillVisible && visibleSeries.length === 1 && visibleSeries[0].kind === 'point'
      ? 'Somente preço do ano de lançamento disponível.'
      : null

  const years = useMemo(
    () => [...new Set(visibleSeries.flatMap(s => s.historico.map(h => h.ano)))].sort((a, b) => a - b),
    [visibleSeries]
  )
  const maxVal = useMemo(() => {
    const vals = visibleSeries.flatMap(s => s.historico.map(h => h.valor))
    const m = vals.length ? Math.max(...vals) : 0
    return Math.ceil((m * 1.1) / 50_000) * 50_000 || 50_000
  }, [visibleSeries])

  const minYear = years[0] ?? 0
  const maxYear = years[years.length - 1] ?? 1
  const yearSpan = maxYear - minYear || 1

  function xFor(year: number) {
    return PLOT.left + ((year - minYear) / yearSpan) * PLOT.width
  }
  function yFor(value: number) {
    return PLOT.top + PLOT.height - (value / maxVal) * PLOT.height
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxVal * f))
  const yearLabelStep = years.length > 6 ? Math.ceil(years.length / 6) : 1

  return (
    <View style={{ maxWidth: isWide ? 1100 : 480, alignSelf: 'center', width: '100%' }}>
      <View style={styles.filtersSection}>
        <FilterRow label="Todas as marcas" options={brandOptions} value={brandFilter} onChange={setBrandFilter} colors={colors} />
        <FilterRow label="Todos os anos" options={yearOptions.map(String)} value={yearFilter} onChange={setYearFilter} colors={colors} />
        <FilterRow label="Todas as faixas de preço" options={PRICE_BUCKETS.map(b => b.label)} value={priceFilter} onChange={setPriceFilter} colors={colors} />
      </View>

      {filteredSeries.length === 0 && filteredNoData.length === 0 ? (
        <Text style={styles.muted}>Nenhum veículo corresponde a esses filtros.</Text>
      ) : filteredSeries.length === 0 ? null : (
        <>
          <View style={styles.legend}>
            {filteredSeries.map(s => {
              const isActive = active === s.label
              const dimmed = active !== null && !isActive
              return (
                <TouchableOpacity
                  key={s.label}
                  onPress={() => setActive(isActive ? null : s.label)}
                  style={[
                    styles.legendChip,
                    isWide && styles.legendChipWide,
                    { borderColor: isActive ? s.color : colors.cardBorder, opacity: dimmed ? 0.4 : 1 }
                  ]}>
                  <Svg width={14} height={8}>
                    {s.kind === 'line'
                      ? <SvgLine x1="0" y1="4" x2="14" y2="4" stroke={s.color} strokeWidth="2" />
                      : <Circle cx="7" cy="4" r="3" fill={s.color} />
                    }
                  </Svg>
                  <Text style={styles.legendText} numberOfLines={1}>{s.label}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <View style={[styles.chartBox, { aspectRatio: SVG_W / SVG_H }, isWide && styles.chartBoxWide]}>
            <Svg width="100%" height="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`} preserveAspectRatio="xMidYMid meet">
              {yTicks.map(v => (
                <SvgLine key={v}
                  x1={PLOT.left} x2={PLOT.left + PLOT.width}
                  y1={yFor(v)} y2={yFor(v)}
                  stroke={colors.cardBorder} strokeWidth="1" />
              ))}
              {yTicks.map(v => (
                <SvgText key={`label-${v}`} x={PLOT.left - 6} y={yFor(v) + 3}
                  fontSize={axisFontSize} fontFamily={axisFontFamily} fill={colors.muted} textAnchor="end">
                  {formatCompactBRL(v)}
                </SvgText>
              ))}
              {years.map((y, i) => (
                i % yearLabelStep === 0 ? (
                  <SvgText key={y} x={xFor(y)} y={SVG_H - 6}
                    fontSize={axisFontSize} fontFamily={axisFontFamily} fill={colors.muted} textAnchor="middle">
                    {y}
                  </SvgText>
                ) : null
              ))}
              {visibleSeries.map(s => {
                if (s.kind === 'point') {
                  const p = s.historico[0]
                  return (
                    <Circle key={s.label} cx={xFor(p.ano)} cy={yFor(p.valor)} r={5}
                      fill={s.color} stroke={colors.card} strokeWidth="1.5" />
                  )
                }
                const points = s.historico.map(h => `${xFor(h.ano)},${yFor(h.valor)}`).join(' ')
                return (
                  <Polyline key={s.label} points={points} fill="none"
                    stroke={s.color} strokeWidth="2" strokeDasharray={s.dash} />
                )
              })}
            </Svg>
          </View>
        </>
      )}

      {pointOnlyMessage && <Text style={styles.footnote}>{pointOnlyMessage}</Text>}

      {filteredNoData.length > 0 && (
        <Text style={styles.footnote}>
          Preços de anos seguintes não disponíveis para {filteredNoData.map(u => u.label).join(', ')}.
        </Text>
      )}
    </View>
  )
}

function FilterRow({ label, options, value, onChange, colors }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void; colors: ThemeColors
}) {
  const styles = useMemo(() => makeStyles(colors), [colors])
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ gap: 6 }}>
      <Chip text={label} active={value === ''} onPress={() => onChange('')} colors={colors} />
      {options.map(opt => (
        <Chip key={opt} text={opt} active={value === opt} onPress={() => onChange(opt)} colors={colors} />
      ))}
    </ScrollView>
  )
}

function Chip({ text, active, onPress, colors }: { text: string; active: boolean; onPress: () => void; colors: ThemeColors }) {
  const styles = useMemo(() => makeStyles(colors), [colors])
  return (
    <TouchableOpacity onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]} numberOfLines={1}>{text}</Text>
    </TouchableOpacity>
  )
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    filtersSection: {
      gap: 8, paddingBottom: 12, marginBottom: 12,
      borderBottomWidth: 1, borderBottomColor: c.cardBorder
    },
    filterRow:   {},
    filterChip: {
      borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
      borderWidth: 1, borderColor: c.cardBorder, backgroundColor: c.background
    },
    filterChipActive:   { backgroundColor: c.primary, borderColor: c.primary },
    filterChipText:     { fontSize: 11, fontWeight: '600', color: c.muted },
    filterChipTextActive: { color: c.primaryForeground },
    legend:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    legendChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      borderRadius: 20, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, maxWidth: 180
    },
    legendChipWide: { maxWidth: 360 },
    legendText:  { fontSize: 10, color: c.foreground, flexShrink: 1 },
    chartBox:    { width: '100%' },
    chartBoxWide: { maxHeight: 380 },
    muted:       { color: c.muted, fontSize: 13 },
    footnote:    { color: c.muted, fontSize: 11, marginTop: 8 },
  })
}
