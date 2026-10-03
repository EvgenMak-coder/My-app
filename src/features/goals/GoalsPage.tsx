import { useState, type CSSProperties, type FormEvent } from 'react'
import { DataGate, formatDate, Panel } from '../../components/ui'
import { CoinIcon, Talisman } from '../../components/Talisman'
import { changeGoalProgress, completeGoal, createGoal, restoreGoal } from '../../data/actions'
import { useAction } from '../../data/hooks'
import type { Goal, Snapshot } from '../../data/types'
import { GOAL_COLORS, GOAL_LEVELS, GOAL_STEP, levelOf } from '../../game/goals'

function GoalCard({ goal }: { goal: Goal }) {
  const level = levelOf(goal.level)
  const change = useAction((store, delta: number) => changeGoalProgress(store, goal, goal.progress + delta))
  const complete = useAction((store, g: Goal) => completeGoal(store, g))
  const remove = useAction((store, id: string) => store.deleteGoal(id))

  return (
    <li className="goal" style={{ '--cord': goal.color } as CSSProperties}>
      <div className="goal-talisman">
        <Talisman coins={level.coins} progress={goal.progress} color={goal.color} />
        <span className="goal-percent num">{goal.progress}%</span>
        {/* левая половина талисмана убавляет, правая прибавляет */}
        <button
          className="goal-tap minus"
          aria-label={`Убавить «${goal.title}» на ${GOAL_STEP}%`}
          disabled={goal.progress <= 0 || change.isPending}
          onClick={() => change.mutate(-GOAL_STEP)}
        >
          −
        </button>
        <button
          className="goal-tap plus"
          aria-label={`Прибавить «${goal.title}» на ${GOAL_STEP}%`}
          disabled={goal.progress >= 100 || change.isPending}
          onClick={() => change.mutate(GOAL_STEP)}
        >
          +
        </button>
      </div>
      <p className="goal-title">{goal.title}</p>
      <div className="row">
        {goal.progress >= 100 ? (
          <button className="small grow" disabled={complete.isPending} onClick={() => complete.mutate(goal)}>
            Завершить{goal.rewarded ? '' : ` · +${level.reward} ци`}
          </button>
        ) : (
          <span className="grow muted">с {formatDate(goal.createdAt)}</span>
        )}
        <button
          className="small danger"
          aria-label={`Удалить «${goal.title}»`}
          onClick={() => confirm(`Удалить «${goal.title}»? Это не архив — цель исчезнет совсем.`) && remove.mutate(goal.id)}
        >
          ×
        </button>
      </div>
    </li>
  )
}

const coinsLabel = (n: number): string => `${n} ${n === 1 ? 'монета' : n < 5 ? 'монеты' : 'монет'}`

function AddGoal({ position }: { position: number }) {
  const [title, setTitle] = useState('')
  const [level, setLevel] = useState(3)
  // null — берём цвет уровня
  const [color, setColor] = useState<string | null>(null)
  const create = useAction((store, g: { title: string; level: number; color: string }) =>
    createGoal(store, g.title, g.level, g.color, position),
  )
  const chosen = color ?? levelOf(level).color

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    create.mutate({ title, level, color: chosen }, { onSuccess: () => setTitle('') })
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="row wrap">
        <input
          className="grow"
          type="text"
          placeholder="Новая цель или задача"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select value={level} onChange={(e) => setLevel(Number(e.target.value))} aria-label="Уровень важности">
          {GOAL_LEVELS.map((l, i) => (
            <option key={l.key} value={i}>
              {l.glyph} {l.name} · {coinsLabel(l.coins)}
            </option>
          ))}
        </select>
        <button type="submit" disabled={create.isPending || !title.trim()}>
          Добавить
        </button>
      </div>
      <div className="row wrap">
        <span className="muted">Шнур:</span>
        <div className="swatches" role="radiogroup" aria-label="Цвет шнура">
          {GOAL_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={c === chosen}
              aria-label={`Цвет ${c}`}
              style={{ '--swatch': c } as CSSProperties}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <span className="muted">{levelOf(level).hint}</span>
      </div>
    </form>
  )
}

function Archive({ goals }: { goals: Goal[] }) {
  const restore = useAction((store, g: Goal) => restoreGoal(store, g))
  const remove = useAction((store, id: string) => store.deleteGoal(id))

  if (goals.length === 0) return <p className="muted">Архив пуст. Сюда попадают завершённые цели.</p>
  return (
    <ul className="list">
      {goals.map((g) => {
        const level = levelOf(g.level)
        return (
          <li key={g.id} className="row wrap archive-row">
            <span className="archive-coin">
              <CoinIcon />
            </span>
            <span className="grow">
              {g.title}
              <small className="muted">
                {' '}
                {level.glyph} {level.name} · {formatDate(g.createdAt)} — {g.doneAt ? formatDate(g.doneAt) : ''}
              </small>
            </span>
            <button className="small ghost" onClick={() => restore.mutate(g)}>
              Вернуть
            </button>
            <button
              className="small danger"
              aria-label={`Удалить «${g.title}» из архива`}
              onClick={() => confirm(`Удалить «${g.title}» из архива навсегда?`) && remove.mutate(g.id)}
            >
              ×
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function Goals({ snapshot }: { snapshot: Snapshot }) {
  const [tab, setTab] = useState<'active' | 'archive'>('active')
  const active = snapshot.goals.filter((g) => !g.doneAt).sort((a, b) => a.position - b.position)
  const archived = snapshot.goals.filter((g) => g.doneAt).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
  const nextPosition = snapshot.goals.reduce((max, g) => Math.max(max, g.position), -1) + 1

  return (
    <>
      <h1>Цели</h1>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'active'} onClick={() => setTab('active')}>
          В работе · {active.length}
        </button>
        <button role="tab" aria-selected={tab === 'archive'} onClick={() => setTab('archive')}>
          Архив · {archived.length}
        </button>
      </div>

      {tab === 'archive' ? (
        <Panel title="Свершённое">
          <Archive goals={archived} />
        </Panel>
      ) : (
        <>
          <Panel title="Новая цель">
            <AddGoal position={nextPosition} />
          </Panel>

          {active.length === 0 && (
            <p className="muted">Целей пока нет. Нажатие на правую половину талисмана прибавляет {GOAL_STEP}%, на левую — убавляет.</p>
          )}

          {GOAL_LEVELS.map((level, i) => {
            const goals = active.filter((g) => g.level === i)
            if (goals.length === 0) return null
            return (
              <section key={level.key} className="goal-level">
                <h2>
                  {level.glyph} {level.name}
                </h2>
                <p className="muted">
                  {level.hint} · {coinsLabel(level.coins)}
                </p>
                <ul className="goals">
                  {goals.map((g) => (
                    <GoalCard key={g.id} goal={g} />
                  ))}
                </ul>
              </section>
            )
          })}
        </>
      )}
    </>
  )
}

export function GoalsPage() {
  return <DataGate>{(snapshot) => <Goals snapshot={snapshot} />}</DataGate>
}
