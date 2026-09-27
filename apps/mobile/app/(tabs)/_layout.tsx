import { Tabs } from 'expo-router'
import { LayoutDashboard, Car, GitCompare, Sparkles } from 'lucide-react-native'
import { useTheme } from '@/contexts/ThemeContext'

export default function TabsLayout() {
  const { colors } = useTheme()

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: {
        backgroundColor: colors.card,
        borderTopColor: colors.cardBorder,
        paddingBottom: 8,
        height: 60
      },
      tabBarActiveTintColor: colors.accent,
      tabBarInactiveTintColor: colors.muted,
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' }
    }}>
      <Tabs.Screen name="index" options={{
        title: 'Dashboard',
        tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />
      }} />
      <Tabs.Screen name="vehicles" options={{
        title: 'Veículos',
        tabBarIcon: ({ color, size }) => <Car color={color} size={size} />
      }} />
      <Tabs.Screen name="compare" options={{
        title: 'Comparativo',
        tabBarIcon: ({ color, size }) => <GitCompare color={color} size={size} />
      }} />
      <Tabs.Screen name="extract" options={{
        title: 'Extrair',
        tabBarIcon: ({ color, size }) => <Sparkles color={color} size={size} />
      }} />
    </Tabs>
  )
}
