import { execFile } from 'child_process'

export interface RunResult {
  ok: boolean
  stdout: string
  stderr: string
  code: number | null
}

interface RunOpts {
  timeoutMs?: number
  maxBuffer?: number
}

export function run(cmd: string, args: string[], opts?: RunOpts): Promise<RunResult> {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      {
        timeout: opts?.timeoutMs ?? 15000,
        maxBuffer: opts?.maxBuffer ?? 8 * 1024 * 1024,
        encoding: 'utf8',
        killSignal: 'SIGKILL'
      },
      (err, stdout, stderr) => {
        if (err) {
          const e = err as NodeJS.ErrnoException & { code?: unknown }
          const out = typeof stdout === 'string' ? stdout : String(stdout ?? '')
          const errOut = typeof stderr === 'string' && stderr ? stderr : err.message
          const code = typeof e.code === 'number' ? e.code : null
          resolve({ ok: false, stdout: out, stderr: errOut, code })
          return
        }
        resolve({ ok: true, stdout: String(stdout ?? ''), stderr: String(stderr ?? ''), code: 0 })
      }
    )
  })
}

/** Exécute une commande système via pkexec (invite graphique Polkit, jamais d'élévation silencieuse). */
export function runAsRoot(cmd: string, args: string[], opts?: RunOpts): Promise<RunResult> {
  return run('pkexec', [cmd, ...args], opts)
}
