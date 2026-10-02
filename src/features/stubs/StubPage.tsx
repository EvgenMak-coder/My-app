import { Panel } from '../../components/ui'

export function StubPage({ title, plan }: { title: string; plan: string }) {
  return (
    <>
      <h1>{title}</h1>
      <Panel>
        <p>Этот зал ещё строится.</p>
        <p className="muted">{plan}</p>
      </Panel>
    </>
  )
}
