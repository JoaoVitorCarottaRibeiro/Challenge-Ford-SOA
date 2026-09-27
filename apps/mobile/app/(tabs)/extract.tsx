import { useMemo, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, Platform
} from 'react-native'
import { Search, UploadCloud, FileText, X, ChevronDown } from 'lucide-react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import api from '@/services/api'
import SpecReport from '@/components/SpecReport'
import { BrandBadge } from '@/components/BrandBadge'
import { HERO_FIELDS, SOURCE_LABEL, formatSpecValue } from '@/constants/specCategories'
import { useTheme, ThemeColors } from '@/contexts/ThemeContext'

interface ExtractResult {
  source: 'db_cache' | 'pdf_oficial' | 'pdf_upload' | 'web_scraping' | 'ia_generated'
  vehicle: { id: string; brand: string; model: string; version: string; yearModel: number }
  spec: Record<string, unknown> & { pdfSourceFile?: string | null }
}

interface PdfFile {
  uri: string
  name: string
  size: number
  file?: File
}

const MAX_PDF_MB = 15
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 27 }, (_, i) => String(CURRENT_YEAR - i))

async function pdfToBase64(pdf: PdfFile): Promise<string> {
  if (Platform.OS === 'web' && pdf.file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
      reader.onerror = reject
      reader.readAsDataURL(pdf.file as File)
    })
  }
  return FileSystem.readAsStringAsync(pdf.uri, { encoding: FileSystem.EncodingType.Base64 })
}

export default function ExtractScreen() {
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [brand,   setBrand]   = useState('')
  const [model,   setModel]   = useState('')
  const [version, setVersion] = useState('')
  const [year,    setYear]    = useState(String(CURRENT_YEAR))
  const [pickingYear, setPickingYear] = useState(false)
  const [pdfFile, setPdfFile] = useState<PdfFile | null>(null)
  const [pdfError, setPdfError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [result,  setResult]  = useState<ExtractResult | null>(null)

  async function handlePickPdf() {
    setPdfError('')
    const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' })
    if (res.canceled || !res.assets?.[0]) return
    const asset = res.assets[0]
    if (asset.size && asset.size > MAX_PDF_MB * 1024 * 1024) {
      setPdfError(`O arquivo excede ${MAX_PDF_MB}MB.`)
      return
    }
    setPdfFile({ uri: asset.uri, name: asset.name, size: asset.size ?? 0, file: (asset as any).file })
  }

  function handleRemovePdf() {
    setPdfFile(null)
    setPdfError('')
  }

  async function handleExtract() {
    if (!brand.trim() || !model.trim() || !version.trim()) {
      Alert.alert('Campos obrigatórios', 'Preencha marca, modelo e versão.')
      return
    }
    setError('')
    setResult(null)
    setLoading(true)
    try {
      const body: Record<string, unknown> = {
        brand: brand.trim(), model: model.trim(), version: version.trim(),
        yearModel: Number(year),
      }
      if (pdfFile) {
        body.pdfBase64 = await pdfToBase64(pdfFile)
        body.pdfFileName = pdfFile.name
      }
      const { data } = await api.post('/extract', body)
      setResult(data)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Erro ao extrair especificações.')
    } finally {
      setLoading(false)
    }
  }

  function handleNewSearch() {
    setBrand(''); setModel(''); setVersion(''); setYear(String(CURRENT_YEAR))
    setPdfFile(null); setPdfError(''); setResult(null); setError('')
  }

  if (pickingYear) {
    return (
      <View style={styles.container}>
        <View style={[styles.content, { flex: 1 }]}>
          <TouchableOpacity onPress={() => setPickingYear(false)} style={styles.backBtn}>
            <Text style={styles.backText}>← Cancelar</Text>
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Selecione o ano</Text>
          <ScrollView style={{ flex: 1 }}>
            {YEARS.map(y => (
              <TouchableOpacity
                key={y}
                style={[styles.optionCard, year === y && styles.optionCardSelected]}
                onPress={() => { setYear(y); setPickingYear(false) }}>
                <Text style={styles.optionText}>{y}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    )
  }

  const sourceInfo = result ? SOURCE_LABEL[result.source] : null

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Extrair Specs</Text>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Marca</Text>
          <TextInput style={styles.textInput} value={brand} onChangeText={setBrand}
            placeholder="Ex: Ford" placeholderTextColor={colors.muted} />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Modelo</Text>
          <TextInput style={styles.textInput} value={model} onChangeText={setModel}
            placeholder="Ex: Ranger" placeholderTextColor={colors.muted} />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Versão</Text>
          <TextInput style={styles.textInput} value={version} onChangeText={setVersion}
            placeholder="Ex: Raptor" placeholderTextColor={colors.muted} />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Ano</Text>
          <TouchableOpacity style={styles.selector} onPress={() => setPickingYear(true)}>
            <Text style={styles.selectorText}>{year}</Text>
            <ChevronDown color={colors.muted} size={16} />
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Ficha técnica em PDF (opcional)</Text>
          <TouchableOpacity style={styles.dropzone} onPress={handlePickPdf}>
            {pdfFile ? (
              <>
                <FileText color={colors.primary} size={24} />
                <Text style={styles.dropzoneTitle}>{pdfFile.name}</Text>
                <TouchableOpacity onPress={handleRemovePdf} style={styles.removeFileBtn}>
                  <X color={colors.muted} size={12} />
                  <Text style={styles.removeFileText}>Remover arquivo</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <UploadCloud color={colors.muted} size={24} />
                <Text style={styles.dropzoneTitle}>Selecionar ficha técnica</Text>
                <Text style={styles.dropzoneSub}>PDF até {MAX_PDF_MB}MB</Text>
              </>
            )}
          </TouchableOpacity>
          {pdfError ? <Text style={styles.pdfErrorText}>{pdfError}</Text> : null}
        </View>

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleExtract}
          disabled={loading}
          activeOpacity={0.8}>
          {loading
            ? <ActivityIndicator color={colors.primaryForeground} size="small" />
            : <><Search color={colors.primaryForeground} size={18} /><Text style={styles.btnText}>Buscar Especificações</Text></>
          }
        </TouchableOpacity>

        {loading && (
          <Text style={styles.loadingHint}>
            {pdfFile ? 'Extraindo especificações do PDF...' : 'Consultando banco e agente de IA...'}
          </Text>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      {result ? (
        <View style={styles.resultContainer}>
          <View style={styles.resultHeader}>
            <BrandBadge brand={result.vehicle.brand} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={styles.vehicleBrand}>{result.vehicle.brand}</Text>
              <Text style={styles.vehicleName}>{result.vehicle.model} {result.vehicle.version}</Text>
              <Text style={styles.vehicleYear}>{result.vehicle.yearModel}</Text>
            </View>
          </View>

          {sourceInfo && (
            <View style={[styles.sourceBadge, { backgroundColor: `${sourceInfo.color}20`, borderColor: sourceInfo.color }]}>
              <Text style={[styles.sourceText, { color: sourceInfo.color }]}>
                {sourceInfo.text}{result.spec?.pdfSourceFile ? ` · ${String(result.spec.pdfSourceFile)}` : ''}
              </Text>
            </View>
          )}

          <View style={styles.specsGrid}>
            {HERO_FIELDS.map(field => {
              const val = result.spec?.[field.key]
              if (val == null) return null
              return (
                <View key={field.key} style={styles.specCard}>
                  <Text style={styles.specValue}>{formatSpecValue(val, field)}</Text>
                  <Text style={styles.specLabel}>{field.label}</Text>
                </View>
              )
            })}
          </View>

          <Text style={styles.reportTitle}>Relatório completo</Text>
          <SpecReport spec={result.spec} />

          <TouchableOpacity style={styles.clearBtn} onPress={handleNewSearch}>
            <Text style={styles.clearText}>Fazer nova busca</Text>
          </TouchableOpacity>
        </View>
      ) : !loading ? (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>As especificações extraídas vão aparecer aqui.</Text>
        </View>
      ) : null}
    </ScrollView>
  )
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container:    { flex: 1, backgroundColor: c.background },
    content:      { padding: 20, paddingTop: 60, paddingBottom: 40 },
    pageTitle:    { fontSize: 22, fontWeight: 'bold', color: c.foreground, marginBottom: 20 },
    form: {
      backgroundColor: c.card, borderRadius: 16,
      padding: 20, borderWidth: 1, borderColor: c.cardBorder,
      marginBottom: 24, gap: 16
    },
    inputGroup:   { gap: 6 },
    inputLabel:   { fontSize: 12, fontWeight: '600', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
    textInput: {
      backgroundColor: c.background, borderRadius: 10,
      borderWidth: 1, borderColor: c.cardBorder,
      paddingHorizontal: 14, paddingVertical: 12,
      color: c.foreground, fontSize: 15
    },
    selector: {
      backgroundColor: c.background, borderRadius: 10,
      borderWidth: 1, borderColor: c.cardBorder,
      paddingHorizontal: 14, paddingVertical: 14,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
    },
    selectorText: { color: c.foreground, fontSize: 15 },
    dropzone: {
      borderWidth: 2, borderStyle: 'dashed', borderColor: c.cardBorder,
      borderRadius: 12, paddingVertical: 24, alignItems: 'center', gap: 6,
      backgroundColor: c.background
    },
    dropzoneTitle: { fontSize: 13, fontWeight: '600', color: c.foreground, textAlign: 'center' },
    dropzoneSub:   { fontSize: 11, color: c.muted },
    removeFileBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    removeFileText: { fontSize: 11, fontWeight: '600', color: c.muted },
    pdfErrorText:  { fontSize: 11, color: '#ef4444' },
    btn: {
      backgroundColor: c.primary, borderRadius: 12,
      paddingVertical: 14, flexDirection: 'row',
      alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4
    },
    btnDisabled:  { opacity: 0.6 },
    btnText:      { color: c.primaryForeground, fontSize: 15, fontWeight: '700' },
    loadingHint:  { textAlign: 'center', color: c.muted, fontSize: 12, marginTop: -8 },
    errorText:    { color: '#ef4444', fontSize: 13 },
    backBtn:      { marginBottom: 20 },
    backText:     { color: c.accent, fontSize: 16, fontWeight: '600' },
    optionCard: {
      backgroundColor: c.card, borderRadius: 12, padding: 16,
      borderWidth: 1, borderColor: c.cardBorder, marginBottom: 10
    },
    optionCardSelected: { borderColor: c.primary, backgroundColor: `${c.primary}20` },
    optionText:   { fontSize: 15, color: c.foreground, fontWeight: '500' },
    placeholder: {
      borderWidth: 2, borderStyle: 'dashed', borderColor: c.cardBorder,
      borderRadius: 16, paddingVertical: 60, alignItems: 'center', paddingHorizontal: 24
    },
    placeholderText: { color: c.muted, fontSize: 13, textAlign: 'center' },
    resultContainer: { gap: 16 },
    resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    vehicleBrand: { fontSize: 12, fontWeight: '600', color: c.muted },
    vehicleName:  { fontSize: 20, fontWeight: 'bold', color: c.foreground, marginTop: 2 },
    vehicleYear:  { fontSize: 13, color: c.muted, marginTop: 2 },
    sourceBadge: {
      borderRadius: 10, borderWidth: 1,
      paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start'
    },
    sourceText:   { fontSize: 12, fontWeight: '600' },
    specsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    specCard: {
      flex: 1, minWidth: '45%', backgroundColor: c.card,
      borderRadius: 12, paddingVertical: 18, paddingHorizontal: 16,
      borderWidth: 1, borderColor: c.cardBorder, alignItems: 'center'
    },
    specValue:    { fontSize: 22, fontWeight: 'bold', color: c.foreground, marginBottom: 4 },
    specLabel:    { fontSize: 11, color: c.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
    reportTitle: {
      fontSize: 12, fontWeight: '700', color: c.muted,
      textTransform: 'uppercase', letterSpacing: 1, marginTop: 8
    },
    clearBtn:     { alignItems: 'center', paddingVertical: 12 },
    clearText:    { color: c.accent, fontSize: 14, fontWeight: '600' }
  })
}
