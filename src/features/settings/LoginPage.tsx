import { useState, type FormEvent } from 'react'
import { supabase } from '../../data/index'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError('')
    const res = await supabase.auth.signInWithPassword({ email, password })
    if (res.error) setError('Не удалось войти: проверь почту и пароль.')
    setBusy(false)
  }

  return (
    <div className="login">
      <section className="panel">
        <h1>Небесный дракон</h1>
        <p className="muted">Врата открываются только хозяину.</p>
        <form onSubmit={submit}>
          <input
            type="email"
            placeholder="Почта"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Пароль"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" disabled={busy}>
            Войти
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      </section>
    </div>
  )
}
