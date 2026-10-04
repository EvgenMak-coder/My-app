import { NavLink, Outlet } from 'react-router-dom'
import { APP_VERSION } from '../pwa'

const LINKS = [
  { to: '/', glyph: '龍', label: 'Главная' },
  { to: '/treasury', glyph: '財', label: 'Казна' },
  { to: '/training', glyph: '武', label: 'Тренировки' },
  { to: '/goals', glyph: '志', label: 'Цели' },
  { to: '/wishes', glyph: '願', label: 'Желания' },
  { to: '/skills', glyph: '技', label: 'Навыки' },
  { to: '/stats', glyph: '鑑', label: 'Статистика' },
  { to: '/settings', glyph: '設', label: 'Настройки' },
]

export function Layout() {
  return (
    <div className="shell">
      <nav className="nav" aria-label="Разделы">
        <span className="brand">
          Небесный дракон
          <small>v{APP_VERSION}</small>
        </span>
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="glyph" aria-hidden="true">
              {l.glyph}
            </span>
            {l.label}
          </NavLink>
        ))}
      </nav>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
