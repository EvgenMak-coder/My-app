import { useEffect, useState, type ChangeEvent, type CSSProperties } from 'react'
import { ELEMENTS, imageToDataUrl, setBackground, setElement, useAppearance } from '../../theme/appearance'
import { DataGate, Panel } from '../../components/ui'
import { useAction } from '../../data/hooks'
import { cloudEnabled, supabase } from '../../data/index'
import { parseImport, type Snapshot } from '../../data/types'

function download(snapshot: Snapshot) {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `dragon-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function AppearancePanel() {
  const { element, background } = useAppearance()
  const [message, setMessage] = useState('')

  const onImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      setBackground(await imageToDataUrl(file))
      setMessage('')
    } catch {
      setMessage('Не получилось сохранить картинку — попробуй файл поменьше.')
    }
  }

  return (
    <Panel title="Оформление">
      <div className="elements">
        {ELEMENTS.map((el) => (
          <button
            key={el.key}
            aria-pressed={el.key === element}
            style={{ '--swatch': el.color } as CSSProperties}
            onClick={() => setElement(el.key)}
          >
            <span className="swatch" />
            {el.name}
          </button>
        ))}
      </div>
      <p className="muted">
        Свой фон хранится только на этом устройстве и никуда не отправляется. Лучше всего смотрятся тёмные
        вертикальные картинки.
      </p>
      <div className="row wrap">
        <label>
          <span className="muted">Фон: </span>
          <input type="file" accept="image/*" onChange={onImage} />
        </label>
        {background && (
          <button className="ghost" onClick={() => setBackground(null)}>
            Убрать фон
          </button>
        )}
      </div>
      {message && <p className="error">{message}</p>}
    </Panel>
  )
}

function Settings({ snapshot }: { snapshot: Snapshot }) {
  const [name, setName] = useState(snapshot.profile.dragonName)
  const [message, setMessage] = useState('')
  const rename = useAction((store, n: string) => store.setDragonName(n))
  const replace = useAction((store, s: Snapshot) => store.replaceAll(s))

  useEffect(() => setName(snapshot.profile.dragonName), [snapshot.profile.dragonName])

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const next = parseImport(JSON.parse(await file.text()))
      const ok = confirm(
        `Заменить ВСЕ текущие данные содержимым файла?\nВ файле: сфер ${next.areas.length}, навыков ${next.skills.length}.`,
      )
      if (!ok) return
      replace.mutate(next, {
        onSuccess: () => setMessage('Данные загружены.'),
        onError: (err) => setMessage(`Ошибка импорта: ${err.message}`),
      })
    } catch (err) {
      setMessage(`Не удалось прочитать файл: ${(err as Error).message}`)
    }
  }

  return (
    <>
      <h1>Настройки</h1>

      <Panel title="Имя дракона">
        <form
          className="row wrap"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) rename.mutate(name.trim())
          }}
        >
          <input className="grow" type="text" value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit" disabled={rename.isPending || !name.trim()}>
            Сохранить
          </button>
        </form>
      </Panel>

      <AppearancePanel />

      <Panel title="Данные">
        <p className="muted">
          Экспорт сохраняет резервную копию. Импорт принимает такую копию или файл seed.local.json из
          scripts/import_excel.py и заменяет все текущие данные.
        </p>
        <div className="row wrap">
          <button onClick={() => download(snapshot)}>Экспорт</button>
          <label>
            <span className="muted">Импорт: </span>
            <input type="file" accept="application/json,.json" onChange={onFile} disabled={replace.isPending} />
          </label>
        </div>
        {message && <p className="muted">{message}</p>}
      </Panel>

      <Panel title="Хранилище">
        {cloudEnabled ? (
          <div className="row wrap">
            <p className="grow">Облако Supabase — данные синхронизируются между устройствами.</p>
            <button className="ghost" onClick={() => supabase?.auth.signOut()}>
              Выйти
            </button>
          </div>
        ) : (
          <p>
            Только этот браузер. Чтобы включить синхронизацию, заполни .env.local по образцу .env.example и
            пересобери приложение.
          </p>
        )}
      </Panel>
    </>
  )
}

export function SettingsPage() {
  return <DataGate>{(snapshot) => <Settings snapshot={snapshot} />}</DataGate>
}
