import fs from 'node:fs'
import path from 'node:path'

import { knowledgeSourceDirs } from './houdry-knowledge'

/**
 * First-run seed of MRPL Desktop defaults into HERMES_HOME.
 *
 * Copies config/mrpl-desktop.defaults.yaml when config.yaml is missing, and
 * appends AZURE_OPENAI_* placeholders to .env when those keys are absent.
 * Never overwrites an existing config.yaml (user model/secrets stay put).
 */

export const MRPL_DESKTOP_CONFIG_TEMPLATE = 'mrpl-desktop.defaults.yaml'

export interface SeedMrplHomeFs {
  exists: (target: string) => boolean
  join: (...parts: string[]) => string
  mkdirp: (target: string) => void
  readFile: (target: string) => string
  writeFile: (target: string, contents: string) => void
}

export interface SeedMrplHomeResult {
  skippedReason?: string
  wroteConfig: boolean
  wroteEnvPlaceholders: boolean
}

const ENV_PLACEHOLDERS: ReadonlyArray<readonly [string, string]> = [
  ['AZURE_OPENAI_API_KEY', ''],
  ['AZURE_OPENAI_ENDPOINT', 'https://YOUR_RESOURCE.openai.azure.com'],
  ['AZURE_OPENAI_DEPLOYMENT', 'gpt-5.6-luna']
]

export function resolveMrplTemplateDir(
  candidates: readonly string[],
  io: Pick<SeedMrplHomeFs, 'exists' | 'join'>
): null | string {
  for (const dir of candidates) {
    if (!dir) {
      continue
    }

    if (io.exists(io.join(dir, MRPL_DESKTOP_CONFIG_TEMPLATE))) {
      return dir
    }
  }

  return null
}

export function seedMrplDesktopHome({
  fs: io,
  hermesHome,
  templateDir
}: {
  fs: SeedMrplHomeFs
  hermesHome: string
  templateDir: null | string
}): SeedMrplHomeResult {
  if (!hermesHome) {
    return { skippedReason: 'no-hermes-home', wroteConfig: false, wroteEnvPlaceholders: false }
  }

  io.mkdirp(hermesHome)
  knowledgeSourceDirs(hermesHome, io)

  const configPath = io.join(hermesHome, 'config.yaml')
  const envPath = io.join(hermesHome, '.env')
  let wroteConfig = false
  let wroteEnvPlaceholders = false

  if (!io.exists(configPath)) {
    if (!templateDir) {
      return { skippedReason: 'no-template', wroteConfig: false, wroteEnvPlaceholders: false }
    }

    const templatePath = io.join(templateDir, MRPL_DESKTOP_CONFIG_TEMPLATE)

    if (!io.exists(templatePath)) {
      return { skippedReason: 'no-template', wroteConfig: false, wroteEnvPlaceholders: false }
    }

    io.writeFile(configPath, io.readFile(templatePath))
    wroteConfig = true
  }

  const existingEnv = io.exists(envPath) ? io.readFile(envPath) : ''
  const missing = ENV_PLACEHOLDERS.filter(([key]) => !hasEnvKey(existingEnv, key))

  if (missing.length > 0) {
    const block = missing.map(([key, value]) => `${key}=${value}`).join('\n')
    const prefix = existingEnv && !existingEnv.endsWith('\n') ? '\n' : ''
    io.writeFile(envPath, `${existingEnv}${prefix}${block}\n`)
    wroteEnvPlaceholders = true
  }

  return { wroteConfig, wroteEnvPlaceholders }
}

function hasEnvKey(envText: string, key: string): boolean {
  const pattern = new RegExp(`^${key}=`, 'm')

  return pattern.test(envText)
}

export function createNodeSeedMrplHomeFs(): SeedMrplHomeFs {
  return {
    exists: target => fs.existsSync(target),
    join: (...parts) => path.join(...parts),
    mkdirp: target => {
      fs.mkdirSync(target, { recursive: true })
    },
    readFile: target => fs.readFileSync(target, 'utf8'),
    writeFile: (target, contents) => {
      fs.writeFileSync(target, contents, 'utf8')
    }
  }
}
