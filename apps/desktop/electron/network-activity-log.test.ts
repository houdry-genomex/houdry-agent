import { describe, expect, it } from 'vitest'

import { classifyUrl, isLocalHost, NetworkActivityLog, observeSessionNetworkActivity } from './network-activity-log'

describe('isLocalHost', () => {
  it('treats loopback and private LAN ranges as local', () => {
    expect(isLocalHost('localhost')).toBe(true)
    expect(isLocalHost('127.0.0.1')).toBe(true)
    expect(isLocalHost('10.0.4.12')).toBe(true)
    expect(isLocalHost('192.168.1.50')).toBe(true)
    expect(isLocalHost('172.16.0.1')).toBe(true)
    expect(isLocalHost('172.31.255.255')).toBe(true)
    expect(isLocalHost('169.254.1.1')).toBe(true)
    expect(isLocalHost('machine.local')).toBe(true)
  })

  it('treats public internet hosts as non-local', () => {
    expect(isLocalHost('api.openai.com')).toBe(false)
    expect(isLocalHost('example.com')).toBe(false)
    expect(isLocalHost('172.32.0.1')).toBe(false) // just outside the 172.16-31 private range
    expect(isLocalHost('8.8.8.8')).toBe(false)
  })

  it('honors an explicit fabric-host allowlist', () => {
    expect(isLocalHost('fabric.mrpl.internal', ['fabric.mrpl.internal'])).toBe(true)
    expect(isLocalHost('fabric.mrpl.internal')).toBe(false)
  })
})

describe('classifyUrl', () => {
  it('classifies http(s) hosts by locality', () => {
    expect(classifyUrl('http://localhost:8090/v1/models')).toEqual({ cls: 'local', host: 'localhost' })
    expect(classifyUrl('https://api.openai.com/v1/chat/completions')).toEqual({ cls: 'external', host: 'api.openai.com' })
  })

  it('never flags non-network schemes as external', () => {
    expect(classifyUrl('file:///tmp/report.pdf').cls).toBe('local')
    expect(classifyUrl('devtools://devtools/bundled/inspector.html').cls).toBe('local')
  })

  it('falls back to local on unparseable input rather than false-flagging', () => {
    expect(classifyUrl('not a url').cls).toBe('local')
  })
})

describe('NetworkActivityLog', () => {
  it('records entries newest-first and counts external calls', () => {
    const log = new NetworkActivityLog()

    log.record({ method: 'GET', url: 'http://127.0.0.1:8090/v1/status' })
    log.record({ method: 'POST', url: 'https://api.anthropic.com/v1/messages' })

    const entries = log.list()

    expect(entries).toHaveLength(2)
    expect(entries[0].url).toBe('https://api.anthropic.com/v1/messages') // newest first
    expect(entries[0].cls).toBe('external')
    expect(entries[1].cls).toBe('local')
    expect(log.externalCount()).toBe(1)
  })

  it('evicts oldest entries beyond capacity', () => {
    const log = new NetworkActivityLog({ capacity: 2 })

    log.record({ method: 'GET', url: 'http://localhost/a' })
    log.record({ method: 'GET', url: 'http://localhost/b' })
    log.record({ method: 'GET', url: 'http://localhost/c' })

    const entries = log.list()

    expect(entries).toHaveLength(2)
    expect(entries.map(entry => entry.url)).toEqual(['http://localhost/c', 'http://localhost/b'])
  })

  it('clears all entries', () => {
    const log = new NetworkActivityLog()

    log.record({ method: 'GET', url: 'http://localhost/a' })
    log.clear()

    expect(log.list()).toHaveLength(0)
    expect(log.externalCount()).toBe(0)
  })

  it('applies an extraLocalHosts allowlist at the log level', () => {
    const log = new NetworkActivityLog({ extraLocalHosts: ['fabric.mrpl.internal'] })

    log.record({ method: 'GET', url: 'https://fabric.mrpl.internal/v1/chat/completions' })

    expect(log.list()[0].cls).toBe('local')
  })
})

describe('observeSessionNetworkActivity', () => {
  it('records the request and always allows it through unmodified', () => {
    const log = new NetworkActivityLog()
    let registered: ((details: any, callback: (response: { cancel: boolean }) => void) => void) | undefined

    const fakeSession = {
      webRequest: {
        onBeforeRequest: (fn: typeof registered) => {
          registered = fn
        }
      }
    }

    observeSessionNetworkActivity(fakeSession, log, 'default')

    expect(registered).toBeTypeOf('function')

    let cancelled: boolean | undefined
    registered?.({ method: 'GET', resourceType: 'xhr', url: 'https://example.com/x' }, response => {
      cancelled = response.cancel
    })

    expect(cancelled).toBe(false)
    expect(log.list()).toHaveLength(1)
    expect(log.list()[0].host).toBe('example.com')
  })

  it('is a no-op when given a session without webRequest support', () => {
    const log = new NetworkActivityLog()

    expect(() => observeSessionNetworkActivity(null, log, 'default')).not.toThrow()
    expect(() => observeSessionNetworkActivity({} as any, log, 'default')).not.toThrow()
    expect(log.list()).toHaveLength(0)
  })

  it('never throws even if recording fails, and still allows the request', () => {
    const log = new NetworkActivityLog()

    // Force record() to throw by handing it a details object with a getter that throws.
    const throwingLog = {
      record: () => {
        throw new Error('boom')
      }
    } as unknown as NetworkActivityLog

    let registered: ((details: any, callback: (response: { cancel: boolean }) => void) => void) | undefined

    const fakeSession = {
      webRequest: {
        onBeforeRequest: (fn: typeof registered) => {
          registered = fn
        }
      }
    }

    observeSessionNetworkActivity(fakeSession, throwingLog, 'default')

    let cancelled: boolean | undefined
    expect(() =>
      registered?.({ method: 'GET', url: 'https://example.com' }, response => {
        cancelled = response.cancel
      })
    ).not.toThrow()
    expect(cancelled).toBe(false)
    void log
  })
})
