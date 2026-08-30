// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { paragraphPlainText } from '@/components/assistant-ui/transcript-directive'
import { parseTranscriptDirective } from '@/lib/transcript-directives'

import { localArtifactUrl, Model3DViewer, resolveArtifactUrl } from './model3d-viewer'

// The exact line the Houdry fabric emits after a drawing → STEP run. Pinned
// verbatim so a change to either side's format fails here rather than silently
// degrading to a paragraph of literal text in the transcript.
const FABRIC_DIRECTIVE =
  '::model3d{name="model-20260830-140721.step" origin="127.0.0.1:18080" ' +
  'url="/files/model-20260830-140721.step" ' +
  'preview="/files/model-20260830-140721.stl" size="17859"}'

describe('localArtifactUrl', () => {
  it('accepts artifacts served from loopback', () => {
    expect(localArtifactUrl('http://127.0.0.1:18080/files/a.stl')).toBe('http://127.0.0.1:18080/files/a.stl')
    expect(localArtifactUrl('http://localhost:18080/files/a.stl')).toBe('http://localhost:18080/files/a.stl')
  })

  // Directive attributes are untrusted model output: a model that learned the
  // name must not be able to make the app fetch from, or link the user to, a
  // host that isn't this machine.
  it('rejects anything that would leave the machine', () => {
    expect(localArtifactUrl('http://evil.example.com/a.stl')).toBe('')
    expect(localArtifactUrl('https://169.254.169.254/latest/meta-data')).toBe('')
  })

  it('rejects non-http schemes and malformed input', () => {
    expect(localArtifactUrl('javascript:alert(1)')).toBe('')
    expect(localArtifactUrl('file:///C:/Windows/System32/config/SAM')).toBe('')
    expect(localArtifactUrl('not a url')).toBe('')
    expect(localArtifactUrl(undefined)).toBe('')
    expect(localArtifactUrl('')).toBe('')
  })
})

describe('the fabric artifact directive', () => {
  it('parses into the attributes the viewer needs', () => {
    const parsed = parseTranscriptDirective(FABRIC_DIRECTIVE)

    expect(parsed).not.toBeNull()
    expect(parsed?.name).toBe('model3d')
    expect(parsed?.attrs).toMatchObject({
      name: 'model-20260830-140721.step',
      origin: '127.0.0.1:18080',
      preview: '/files/model-20260830-140721.stl',
      size: '17859',
      url: '/files/model-20260830-140721.step'
    })
    expect(resolveArtifactUrl(parsed?.attrs.origin, parsed?.attrs.url)).toBe(
      'http://127.0.0.1:18080/files/model-20260830-140721.step'
    )
    expect(resolveArtifactUrl(parsed?.attrs.origin, parsed?.attrs.preview)).toBe(
      'http://127.0.0.1:18080/files/model-20260830-140721.stl'
    )
  })

  // The regression that shipped broken: a bare `http://` in the attributes is
  // turned into a link by the GFM autolink pass before directive detection
  // runs, so the paragraph gains element children, paragraphPlainText rejects
  // it, and the user sees prose with prettified link labels instead of a
  // viewer. Nothing in the directive may be autolinkable.
  it('contains nothing the markdown pipeline will autolink', () => {
    expect(FABRIC_DIRECTIVE).not.toMatch(/https?:\/\//)
    expect(FABRIC_DIRECTIVE).not.toMatch(/\bwww\./)
    expect(paragraphPlainText(FABRIC_DIRECTIVE)).toBe(FABRIC_DIRECTIVE)
  })
})

describe('resolveArtifactUrl', () => {
  it('joins a loopback origin with a root-relative path', () => {
    expect(resolveArtifactUrl('127.0.0.1:18080', '/files/a.stl')).toBe('http://127.0.0.1:18080/files/a.stl')
    expect(resolveArtifactUrl('localhost:18080', 'files/a.stl')).toBe('http://localhost:18080/files/a.stl')
  })

  it('still accepts absolute URLs from an older fabric', () => {
    expect(resolveArtifactUrl(undefined, 'http://127.0.0.1:18080/files/a.stl')).toBe(
      'http://127.0.0.1:18080/files/a.stl'
    )
  })

  // origin is untrusted model output, and userinfo makes a hostile host look
  // loopback-ish to a string comparison.
  it('rejects an origin that resolves off-box', () => {
    expect(resolveArtifactUrl('evil.example.com', '/files/a.stl')).toBe('')
    expect(resolveArtifactUrl('127.0.0.1:18080@evil.example.com', '/files/a.stl')).toBe('')
    expect(resolveArtifactUrl(undefined, '/files/a.stl')).toBe('')
    expect(resolveArtifactUrl('127.0.0.1:18080', undefined)).toBe('')
  })
})

describe('Model3DViewer', () => {
  afterEach(cleanup)

  it('offers the STEP download with a human-readable size', () => {
    render(
      <Model3DViewer
        name="model-1.step"
        previewUrl="http://127.0.0.1:18080/files/model-1.stl"
        sizeBytes={17_859}
        url="http://127.0.0.1:18080/files/model-1.step"
      />
    )

    const step = screen.getByRole('link', { name: /Download STEP/i })

    expect(step.getAttribute('href')).toBe('http://127.0.0.1:18080/files/model-1.step')
    expect(step.getAttribute('download')).toBe('model-1.step')
    expect(step.textContent).toContain('17 KB')

    // The STL is what a slicer/printer takes, and it already exists for the
    // preview, so it is offered rather than left for the user to convert.
    const stl = screen.getByRole('link', { name: /Download STL/i })

    expect(stl.getAttribute('href')).toBe('http://127.0.0.1:18080/files/model-1.stl')
    expect(stl.getAttribute('download')).toBe('model-1.stl')
  })

  // The STEP is the deliverable; the mesh is only for looking at it. A run
  // where tessellation failed must still hand the user their file.
  it('degrades to a download card when no preview mesh exists', () => {
    render(<Model3DViewer name="model-2.step" previewUrl="" sizeBytes={0} url="http://127.0.0.1:18080/files/model-2.step" />)

    expect(screen.getByText(/No preview mesh/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: /Download STEP/i }).getAttribute('href')).toBe(
      'http://127.0.0.1:18080/files/model-2.step'
    )
    // No mesh means no STL to offer.
    expect(screen.queryByRole('link', { name: /Download STL/i })).toBeNull()
  })
})
