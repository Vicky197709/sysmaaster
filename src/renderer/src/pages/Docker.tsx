import { useChannel } from '../hooks'
import type { ContainerInfo, DockerOp } from '@shared/types'
import { useApp } from '../store'
import { Badge, Empty, Panel } from '../components/ui'

const OPS: DockerOp[] = ['start', 'stop', 'restart']
const OP_LABEL: Record<DockerOp, string> = { start: 'Démarrer', stop: 'Arrêter', restart: 'Redémarrer' }

export default function Docker() {
  const act = useApp((s) => s.act)
  const { data: containers, loading, reload } = useChannel<ContainerInfo[]>('system:docker')

  const op = (c: ContainerInfo, o: DockerOp) =>
    void act({
      channel: 'control:docker',
      payload: { op: o, id: c.id },
      confirm: {
        title: `${OP_LABEL[o]} le conteneur`,
        message: `${OP_LABEL[o]} ${c.name} (${c.image}) ?`,
        danger: o === 'stop'
      },
      success: `${c.name} : ${OP_LABEL[o]} effectué`
    }).then(() => reload())

  return (
    <Panel
      title={`Conteneurs Docker — ${containers ? containers.length : '…'}`}
      actions={
        <button className="btn sm" onClick={reload}>
          Rafraîchir
        </button>
      }
    >
      {loading && !containers ? (
        <Empty text="Interrogation du démon Docker…" />
      ) : !containers ? (
        <Empty text="Docker inaccessible (démon arrêté ou non installé)" />
      ) : containers.length === 0 ? (
        <Empty text="Aucun conteneur" />
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Image</th>
                <th>État</th>
                <th className="num">ID</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {containers.map((c) => {
                const up = c.status.toLowerCase().startsWith('up')
                return (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className="mono muted">{c.image}</td>
                    <td>
                      <Badge kind={up ? 'ok' : 'muted'}>{c.status}</Badge>
                    </td>
                    <td className="num mono">{c.id.slice(0, 12)}</td>
                    <td className="right" style={{ whiteSpace: 'nowrap' }}>
                      {OPS.map((o, i) => (
                        <span key={o}>
                          {i > 0 && ' '}
                          <button
                            className={`btn sm${o === 'stop' ? ' danger' : ''}`}
                            disabled={(o === 'start' && up) || (o === 'stop' && !up)}
                            onClick={() => op(c, o)}
                          >
                            {OP_LABEL[o]}
                          </button>
                        </span>
                      ))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
