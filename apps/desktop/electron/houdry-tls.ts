import { createHash } from 'node:crypto'
import fs from 'node:fs'
import https from 'node:https'
import os from 'node:os'
import path from 'node:path'

export function houdryHome(env: NodeJS.ProcessEnv = process.env, homedir: string = os.homedir()): string {
  const override = env.HOUDRY_HOME?.trim()

  return override || path.join(homedir, '.houdry')
}

export function localHoudryCAPath(home: string = houdryHome()): string {
  return path.join(home, 'server', 'pki', 'root_ca.crt')
}

export function fabricHttpsOrigin(port: number): string {
  return `https://127.0.0.1:${port}`
}

export function fabricHttpsApi(port: number): string {
  return `${fabricHttpsOrigin(port)}/v1`
}

/** Upgrade a Houdry control-plane URL to https:// (old ads / config). */
export function rewriteHoudryHttps(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '')

  if (trimmed.startsWith('http://')) {
    return `https://${trimmed.slice('http://'.length)}`
  }

  return trimmed
}

export function readLocalHoudryCA(home: string = houdryHome()): string {
  const file = localHoudryCAPath(home)

  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

export function applyHoudryCATrust(pem: string, destFile: string): void {
  if (!pem.trim()) {
    return
  }

  fs.mkdirSync(path.dirname(destFile), { recursive: true })
  fs.writeFileSync(destFile, pem, { encoding: 'utf8', mode: 0o644 })
  process.env.SSL_CERT_FILE = destFile
  process.env.REQUESTS_CA_BUNDLE = destFile
  process.env.NODE_EXTRA_CA_CERTS = destFile
}

/** After local `houdry serve` is up, pin its Root CA for Node and Python https. */
export function trustLocalHoudryCA(home: string = houdryHome()): string {
  const pem = readLocalHoudryCA(home)

  if (!pem) {
    return ''
  }

  const dest = path.join(home, 'node', 'agent-ca.crt')

  applyHoudryCATrust(pem, dest)

  return dest
}

type TofuStore = Record<string, { fingerprint: string; pem: string }>

export function tofuStorePath(userData: string): string {
  return path.join(userData, 'houdry-tofu-ca.json')
}

export function loadTofuStore(file: string): TofuStore {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as TofuStore

    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function persistTofuCA(file: string, origin: string, pem: string): string {
  const fingerprint = createHash('sha256').update(pem).digest('hex')
  const store = loadTofuStore(file)

  store[origin] = { fingerprint, pem }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(store, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })

  return fingerprint
}

export function httpsAgentForCA(ca: string, insecure = false): https.Agent {
  return new https.Agent({
    ca: ca || undefined,
    rejectUnauthorized: !insecure && Boolean(ca)
  })
}

let tofuFile = ''

/** Persist remote CA pins under Electron userData (`houdry-tofu-ca.json`). */
export function configureHoudryTofu(userData: string): void {
  tofuFile = tofuStorePath(userData)
}

export function pinnedCAForOrigin(origin: string, file: string = tofuFile): string {
  if (!file) {
    return ''
  }

  return loadTofuStore(file)[origin]?.pem ?? ''
}

async function pinRemoteCA(origin: string, timeoutMs: number): Promise<void> {
  if (!tofuFile) {
    return
  }

  try {
    const parsed = new URL(origin)
    const caUrl = `${parsed.origin}/v1/pki/ca`
    const res = await houdryHttpsGet(caUrl, { insecure: true, timeoutMs, skipPin: true })

    if (!res.ok || !res.body.includes('BEGIN CERTIFICATE')) {
      return
    }

    persistTofuCA(tofuFile, parsed.origin, res.body)
    applyHoudryCATrust(res.body, path.join(path.dirname(tofuFile), 'houdry-ca.crt'))
  } catch {
    // First-contact pin is best-effort; later probes retry.
  }
}

export function houdryHttpsGet(
  url: string,
  opts: { ca?: string; insecure?: boolean; timeoutMs?: number; skipPin?: boolean } = {}
): Promise<{ ok: boolean; body: string; status: number }> {
  const timeoutMs = opts.timeoutMs ?? 2_000
  let origin = ''

  try {
    origin = new URL(url).origin
  } catch {
    origin = ''
  }

  const pinned = opts.ca || pinnedCAForOrigin(origin)
  const insecure = Boolean(opts.insecure) || !pinned

  return new Promise(resolve => {
    const req = https.get(
      url,
      {
        agent: httpsAgentForCA(pinned, insecure),
        timeout: timeoutMs
      },
      res => {
        const chunks: Buffer[] = []

        res.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
        res.on('end', () => {
          const ok = (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300

          if (ok && insecure && origin && !opts.skipPin) {
            void pinRemoteCA(origin, timeoutMs)
          }

          resolve({
            ok,
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8')
          })
        })
      }
    )

    req.on('timeout', () => {
      req.destroy()
      resolve({ ok: false, status: 0, body: '' })
    })
    req.on('error', () => resolve({ ok: false, status: 0, body: '' }))
  })
}
