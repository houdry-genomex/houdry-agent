import assert from 'node:assert/strict'
import path from 'node:path'

import { test } from 'vitest'

import { resolveMrplTemplateDir, seedMrplDesktopHome, type SeedMrplHomeFs } from './seed-mrpl-home'

function memoryFs(initial: Record<string, string> = {}): SeedMrplHomeFs & { files: Record<string, string> } {
  const files: Record<string, string> = { ...initial }

  return {
    files,
    exists: target => Object.hasOwn(files, target),
    join: (...parts) => parts.join('/'),
    mkdirp: () => undefined,
    readFile: target => files[target] ?? '',
    writeFile: (target, contents) => {
      files[target] = contents
    }
  }
}

const TEMPLATE = 'model:\n  provider: azure\n  default: "gpt-5.6-luna"\n  api_mode: chat_completions\n'
const TEMPLATE_DIR = '/repo/config'
const TEMPLATE_PATH = `${TEMPLATE_DIR}/mrpl-desktop.defaults.yaml`
const HOME = '/home/.houdry-agent'

test('copies the MRPL desktop template when config.yaml is missing', () => {
  const io = memoryFs({ [TEMPLATE_PATH]: TEMPLATE })
  const result = seedMrplDesktopHome({ fs: io, hermesHome: HOME, templateDir: TEMPLATE_DIR })

  assert.equal(result.wroteConfig, true)
  assert.equal(io.files[`${HOME}/config.yaml`], TEMPLATE)
  assert.match(io.files[`${HOME}/.env`] ?? '', /AZURE_OPENAI_API_KEY=/)
  assert.match(io.files[`${HOME}/.env`] ?? '', /AZURE_OPENAI_DEPLOYMENT=gpt-5.6-luna/)
})

test('does not overwrite an existing config.yaml', () => {
  const io = memoryFs({
    [TEMPLATE_PATH]: TEMPLATE,
    [`${HOME}/config.yaml`]: 'model:\n  provider: custom\n'
  })

  const result = seedMrplDesktopHome({ fs: io, hermesHome: HOME, templateDir: TEMPLATE_DIR })

  assert.equal(result.wroteConfig, false)
  assert.equal(io.files[`${HOME}/config.yaml`], 'model:\n  provider: custom\n')
})

test('does not duplicate Azure env keys already present', () => {
  const io = memoryFs({
    [TEMPLATE_PATH]: TEMPLATE,
    [`${HOME}/config.yaml`]: 'model:\n  provider: azure\n',
    [`${HOME}/.env`]: 'AZURE_OPENAI_API_KEY=secret\nAZURE_OPENAI_ENDPOINT=https://example.openai.azure.com\nAZURE_OPENAI_DEPLOYMENT=gpt-5.6-luna\n'
  })

  const result = seedMrplDesktopHome({ fs: io, hermesHome: HOME, templateDir: TEMPLATE_DIR })

  assert.equal(result.wroteEnvPlaceholders, false)
  assert.equal((io.files[`${HOME}/.env`].match(/AZURE_OPENAI_API_KEY=/g) ?? []).length, 1)
})

test('resolveMrplTemplateDir picks the first candidate that has the template', () => {
  const io = memoryFs({ [TEMPLATE_PATH]: TEMPLATE })

  assert.equal(resolveMrplTemplateDir(['/missing', TEMPLATE_DIR], io), TEMPLATE_DIR)
  assert.equal(resolveMrplTemplateDir(['/missing'], io), null)
})

test('posix join used by tests is not Windows-specific (path module still works)', () => {
  assert.equal(path.posix.join('a', 'b'), 'a/b')
})
