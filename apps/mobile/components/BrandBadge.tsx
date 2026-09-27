import { useState } from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'

const BRAND_COLORS: Record<string, string> = {
  ford: '1F3A6E', toyota: 'CC0000', mitsubishi: 'E60012', volkswagen: '001E50', chevrolet: 'CC0000', ram: '5B2A86',
  fiat: '941711', nissan: 'C3002F', byd: 'E60012',
}

// Slugs do Simple Icons (cdn.simpleicons.org) — mesmo CDN usado no web.
const BRAND_LOGO_SLUGS: Record<string, string> = {
  ford: 'ford', toyota: 'toyota', mitsubishi: 'mitsubishi', volkswagen: 'volkswagen', chevrolet: 'chevrolet', ram: 'ram',
  fiat: 'fiat', nissan: 'nissan',
}

// BYD não tem ícone no Simple Icons — usa o mesmo asset local do web.
const BRAND_LOCAL_LOGOS: Record<string, any> = {
  byd: require('../assets/byd-logo.png'),
}

export function brandColor(brand: string) {
  return `#${BRAND_COLORS[brand.toLowerCase()] || '1F3A6E'}`
}

export function BrandBadge({ brand, size = 40 }: { brand: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  const key = brand.toLowerCase()
  const slug = BRAND_LOGO_SLUGS[key]
  const localLogo = BRAND_LOCAL_LOGOS[key]
  const color = brandColor(brand)

  if ((!slug && !localLogo) || failed) {
    return (
      <View style={[styles.fallback, { width: size, height: size, borderRadius: size * 0.3, backgroundColor: color }]}>
        <Text style={[styles.fallbackText, { fontSize: size * 0.4 }]}>{brand[0]?.toUpperCase()}</Text>
      </View>
    )
  }

  const imgSize = Math.round(size * (localLogo ? 0.7 : 0.55))

  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size * 0.3 }]}>
      <Image
        source={localLogo || { uri: `https://cdn.simpleicons.org/${slug}/${color.replace('#', '')}` }}
        style={{ width: imgSize, height: imgSize }}
        resizeMode="contain"
        onError={() => setFailed(true)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: '#fff', fontWeight: 'bold' },
  wrap: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#ffffff'
  },
})
