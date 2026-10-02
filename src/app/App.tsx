import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { Atmosphere } from '../components/Atmosphere'
import { useSession } from '../data/hooks'
import { cloudEnabled } from '../data/index'
import { HomePage } from '../features/home/HomePage'
import { LoginPage } from '../features/settings/LoginPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { SkillsPage } from '../features/skills/SkillsPage'
import { StatsPage } from '../features/stats/StatsPage'
import { StubPage } from '../features/stubs/StubPage'
import { TrainingPage } from '../features/training/TrainingPage'
import { Layout } from './Layout'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 } },
})

function Gate() {
  const session = useSession()
  if (cloudEnabled && session === undefined) return null
  if (cloudEnabled && !session) return <LoginPage />

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="skills" element={<SkillsPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="training" element={<TrainingPage />} />
          <Route path="spirit" element={<StubPage title="Дух" plan="Техники медитации, их уровень и время практики." />} />
          <Route path="goals" element={<StubPage title="Цели" plan="Цели с прогрессом и задачи к ним." />} />
          <Route
            path="treasury"
            element={<StubPage title="Казна" plan="Счета, инвестиции, кредиты и бюджет по датам; баланс во времени." />}
          />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<HomePage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Atmosphere />
      <Gate />
    </QueryClientProvider>
  )
}
