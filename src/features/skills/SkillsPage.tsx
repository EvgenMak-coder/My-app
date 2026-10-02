import { useEffect, useState, type FormEvent } from 'react'
import { Bar, DataGate, Panel, RankBadge } from '../../components/ui'
import { changeSkill, createSkill } from '../../data/actions'
import { useAction } from '../../data/hooks'
import { clamp100, type Skill, type SkillCategory, type Snapshot } from '../../data/types'

const CATEGORIES: { key: SkillCategory; name: string }[] = [
  { key: 'hard', name: 'Ремесло' },
  { key: 'soft', name: 'Люди и воля' },
  { key: 'hobby', name: 'Увлечения' },
]

function SkillRow({ skill }: { skill: Skill }) {
  const [draft, setDraft] = useState(String(skill.value))
  const change = useAction((store, v: number) => changeSkill(store, skill, v))
  const remove = useAction((store, id: string) => store.deleteSkill(id))

  useEffect(() => setDraft(String(skill.value)), [skill.value])

  const commit = () => {
    const v = Number(draft)
    if (draft.trim() === '' || Number.isNaN(v)) setDraft(String(skill.value))
    else change.mutate(clamp100(v))
  }

  return (
    <li className="skill">
      <div className="row wrap">
        <span>{skill.name}</span>
        <RankBadge value={skill.value} />
      </div>
      <div className="row">
        <button
          className="small ghost"
          aria-label={`Понизить «${skill.name}»`}
          disabled={skill.value <= 0 || change.isPending}
          onClick={() => change.mutate(skill.value - 1)}
        >
          −
        </button>
        <input
          type="number"
          min={0}
          max={100}
          value={draft}
          aria-label={`Значение «${skill.name}»`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <button
          className="small"
          aria-label={`Повысить «${skill.name}»`}
          disabled={skill.value >= 100 || change.isPending}
          onClick={() => change.mutate(skill.value + 1)}
        >
          +
        </button>
        <button
          className="small danger"
          aria-label={`Удалить «${skill.name}»`}
          onClick={() => confirm(`Удалить навык «${skill.name}» вместе с историей?`) && remove.mutate(skill.id)}
        >
          ×
        </button>
      </div>
      <Bar value={skill.value} />
    </li>
  )
}

function AddSkill({ category, position }: { category: SkillCategory; position: number }) {
  const [name, setName] = useState('')
  const [value, setValue] = useState('0')
  const create = useAction((store, a: { name: string; value: number }) =>
    createSkill(store, category, a.name, a.value, position),
  )

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    create.mutate({ name, value: Number(value) || 0 }, { onSuccess: () => setName('') })
  }

  return (
    <form className="row wrap" onSubmit={submit}>
      <input
        className="grow"
        type="text"
        placeholder="Новый навык"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        type="number"
        min={0}
        max={100}
        value={value}
        aria-label="Начальное значение"
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit" disabled={create.isPending || !name.trim()}>
        Добавить
      </button>
    </form>
  )
}

function Skills({ snapshot }: { snapshot: Snapshot }) {
  const [category, setCategory] = useState<SkillCategory>('hard')
  const skills = snapshot.skills.filter((s) => s.category === category).sort((a, b) => a.position - b.position)
  const average = skills.length ? Math.round(skills.reduce((sum, s) => sum + s.value, 0) / skills.length) : 0
  const nextPosition = snapshot.skills.reduce((max, s) => Math.max(max, s.position), -1) + 1

  return (
    <>
      <h1>Навыки</h1>
      <div className="tabs" role="tablist">
        {CATEGORIES.map((c) => (
          <button key={c.key} role="tab" aria-selected={c.key === category} onClick={() => setCategory(c.key)}>
            {c.name}
          </button>
        ))}
      </div>
      <Panel>
        <p className="muted">
          Навыков: {skills.length}, средний уровень: {average}. Каждый пункт роста даёт 10 ци.
        </p>
        {skills.length === 0 ? (
          <p className="muted">Здесь пока пусто — добавь первый навык или загрузи данные из Excel в Настройках.</p>
        ) : (
          <ul className="list">
            {skills.map((s) => (
              <SkillRow key={s.id} skill={s} />
            ))}
          </ul>
        )}
        <AddSkill category={category} position={nextPosition} />
      </Panel>
    </>
  )
}

export function SkillsPage() {
  return <DataGate>{(snapshot) => <Skills snapshot={snapshot} />}</DataGate>
}
