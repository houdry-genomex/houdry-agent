import { describe, expect, it } from 'vitest'

import {
  describeLocalInferenceHit,
  LOCAL_INFERENCE_CANDIDATES,
  type LocalInferenceProbe,
  scanLocalInference
} from './local-inference-scan'

const OLLAMA = 'http://127.0.0.1:11434/v1'
const LM_STUDIO = 'http://127.0.0.1:1234/v1'
const FABRIC = 'http://127.0.0.1:18080/v1'

/** Every candidate refuses except the ones named, which serve `models`. */
function probeServing(serving: Record<string, string[]>): LocalInferenceProbe {
  return async baseUrl =>
    baseUrl in serving
      ? { models: serving[baseUrl], ok: true, reachable: true }
      : { models: [], ok: false, reachable: false }
}

describe('scanLocalInference', () => {
  it('adopts a running server and reports the models it advertised', async () => {
    const hit = await scanLocalInference(probeServing({ [OLLAMA]: ['qwen3:8b', 'llama3.2'] }))

    expect(hit).toEqual({ baseUrl: OLLAMA, label: 'Ollama', models: ['qwen3:8b', 'llama3.2'] })
  })

  it('returns null when nothing is listening', async () => {
    expect(await scanLocalInference(probeServing({}))).toBeNull()
  })

  it('prefers the fabric over a bare engine when both answer', async () => {
    // The router fronts the engines; adopting Ollama directly while the fabric
    // is up would pin the app to one backend and lose the routing.
    const hit = await scanLocalInference(probeServing({ [FABRIC]: ['auto'], [OLLAMA]: ['qwen3:8b'] }))

    expect(hit?.label).toBe('Houdry fabric')
  })

  it('resolves by candidate order, not by which probe replied first', async () => {
    const probe: LocalInferenceProbe = async baseUrl => {
      if (baseUrl === LM_STUDIO) {
        return { models: ['local-model'], ok: true, reachable: true }
      }

      if (baseUrl === OLLAMA) {
        await new Promise(resolve => setTimeout(resolve, 20))

        return { models: ['qwen3:8b'], ok: true, reachable: true }
      }

      return { models: [], ok: false, reachable: false }
    }

    expect((await scanLocalInference(probe))?.label).toBe('Ollama')
  })

  it('ignores a port that answers but serves no model', async () => {
    // Reachable-but-empty saves cleanly and then fails on the first message,
    // which is worse than reporting nothing found.
    expect(await scanLocalInference(probeServing({ [OLLAMA]: [] }))).toBeNull()
  })

  it('still accepts the fabric with an empty catalog — it is a router', async () => {
    const hit = await scanLocalInference(probeServing({ [FABRIC]: [] }))

    expect(hit).toEqual({ baseUrl: FABRIC, label: 'Houdry fabric', models: ['auto'] })
  })

  it('treats a throwing probe as absent rather than failing the scan', async () => {
    const probe: LocalInferenceProbe = async baseUrl => {
      if (baseUrl === FABRIC) {
        throw new Error('gateway not ready')
      }

      return baseUrl === OLLAMA
        ? { models: ['qwen3:8b'], ok: true, reachable: true }
        : { models: [], ok: false, reachable: false }
    }

    expect((await scanLocalInference(probe))?.label).toBe('Ollama')
  })

  it('probes every known candidate exactly once', async () => {
    const seen: string[] = []

    await scanLocalInference(async baseUrl => {
      seen.push(baseUrl)

      return { models: [], ok: false, reachable: false }
    })

    expect(seen).toEqual(LOCAL_INFERENCE_CANDIDATES.map(c => c.baseUrl))
  })
})

describe('describeLocalInferenceHit', () => {
  it('summarises a hit as name, host and model count', () => {
    const summary = describeLocalInferenceHit({ baseUrl: OLLAMA, label: 'Ollama', models: ['a', 'b', 'c'] }, 'models')

    expect(summary).toBe('Ollama · 127.0.0.1:11434 · 3 models')
  })

  it('falls back to the raw string when the URL will not parse', () => {
    const summary = describeLocalInferenceHit({ baseUrl: 'not a url', label: 'Custom', models: ['x'] }, 'models')

    expect(summary).toBe('Custom · not a url · 1 models')
  })
})
