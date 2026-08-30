'use client'

import { type FC, useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

/**
 * Inline 3D preview for models produced by the Houdry CAD pipeline.
 *
 * Mounted by the `::model3d{...}` transcript directive, which the fabric emits
 * after a drawing → STEP run. STEP is a b-rep format a browser cannot draw, so
 * the pipeline tessellates an STL alongside it and the directive points here
 * via `preview`. Without that attribute there is nothing renderable, and this
 * degrades to a download card rather than an empty canvas.
 *
 * three.js is loaded lazily: it is ~600 KB and only CAD conversations need it,
 * so keeping it out of the main chunk keeps normal chat startup unaffected.
 */

// Hosts the fabric can legitimately serve artifacts from. A directive is just
// text the model emitted, so an unvalidated href would let any model that
// learned the name make the app fetch from — or link the user to — an
// arbitrary host. On-premise means artifacts come from this machine.
const LOCAL_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])

/**
 * Return `attr` if it is an http(s) URL served by a loopback host, else ''.
 * Callers treat '' as "no artifact", so a rejected URL degrades rather than
 * rendering something that points off-box.
 */
export function localArtifactUrl(attr: string | undefined): string {
  if (!attr) {
    return ''
  }

  try {
    const parsed = new URL(attr)

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return ''
    }

    return LOCAL_HOSTS.has(parsed.hostname) ? parsed.href : ''
  } catch {
    return ''
  }
}

interface Model3DViewerProps {
  name: string
  previewUrl: string
  sizeBytes: number
  url: string
}

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return ''
  }

  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const FRAME_CLASS = 'relative h-72 w-full overflow-hidden rounded-lg border border-border bg-muted/30'

export const Model3DViewer: FC<Model3DViewerProps> = ({ name, previewUrl, sizeBytes, url }) => {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState<'error' | 'loading' | 'ready'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!previewUrl) {
      return
    }

    const mount = mountRef.current

    if (!mount) {
      return
    }

    // `cancelled` guards every await below: React can unmount this mid-load
    // (the user scrolls away, a new message streams in), and touching the DOM
    // or allocating a WebGL context after that leaks the context permanently —
    // browsers cap those at ~16 and then start killing the oldest.
    let cancelled = false
    let dispose: (() => void) | undefined

    const run = async () => {
      try {
        const [THREE, { OrbitControls }, { STLLoader }] = await Promise.all([
          import('three'),
          import('three/examples/jsm/controls/OrbitControls.js'),
          import('three/examples/jsm/loaders/STLLoader.js')
        ])

        const response = await fetch(previewUrl)

        if (!response.ok) {
          throw new Error(`preview fetch failed (${response.status})`)
        }

        const buffer = await response.arrayBuffer()

        if (cancelled) {
          return
        }

        const geometry = new STLLoader().parse(buffer)

        // STL carries no origin convention and CadQuery models are built up
        // from z=0, so recentre on the bounding box before framing. Otherwise
        // the part orbits around a point off to one side.
        geometry.computeBoundingBox()
        geometry.computeVertexNormals()
        const box = geometry.boundingBox

        if (!box) {
          throw new Error('model has no geometry')
        }

        const size = box.getSize(new THREE.Vector3())
        const centre = box.getCenter(new THREE.Vector3())

        geometry.translate(-centre.x, -centre.y, -centre.z)

        const scene = new THREE.Scene()
        const width = mount.clientWidth || 640
        const height = mount.clientHeight || 288
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10_000)

        // Frame the part from an isometric-ish angle. The 1.9 factor leaves
        // margin so rotation never clips the corners out of view.
        const extent = Math.max(size.x, size.y, size.z) || 1
        const distance = extent * 1.9

        camera.position.set(distance, -distance, distance * 0.8)
        camera.up.set(0, 0, 1) // CadQuery is Z-up; the three.js default is Y-up
        camera.lookAt(0, 0, 0)

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })

        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.setSize(width, height)
        mount.append(renderer.domElement)

        const material = new THREE.MeshStandardMaterial({
          color: 0x9aa4b2,
          metalness: 0.25,
          roughness: 0.55
        })

        const mesh = new THREE.Mesh(geometry, material)

        scene.add(mesh)
        scene.add(new THREE.AmbientLight(0xffffff, 0.7))

        const key = new THREE.DirectionalLight(0xffffff, 1.1)

        key.position.set(1, -1, 1).multiplyScalar(extent)
        scene.add(key)

        const fill = new THREE.DirectionalLight(0xffffff, 0.4)

        fill.position.set(-1, 1, 0.5).multiplyScalar(extent)
        scene.add(fill)

        const controls = new OrbitControls(camera, renderer.domElement)

        controls.enableDamping = true
        controls.enablePan = false

        renderer.setAnimationLoop(() => {
          controls.update()
          renderer.render(scene, camera)
        })

        const observer = new ResizeObserver(() => {
          const w = mount.clientWidth || width
          const h = mount.clientHeight || height

          camera.aspect = w / h
          camera.updateProjectionMatrix()
          renderer.setSize(w, h)
        })

        observer.observe(mount)

        dispose = () => {
          observer.disconnect()
          renderer.setAnimationLoop(null)
          controls.dispose()
          geometry.dispose()
          material.dispose()
          renderer.dispose()
          // dispose() alone does not always release the GPU context; without
          // this the context survives until GC and counts against the cap.
          renderer.forceContextLoss()
          renderer.domElement.remove()
        }

        if (cancelled) {
          dispose()
          dispose = undefined

          return
        }

        setStatus('ready')
      } catch (cause) {
        if (cancelled) {
          return
        }

        setError(cause instanceof Error ? cause.message : String(cause))
        setStatus('error')
      }
    }

    void run()

    return () => {
      cancelled = true
      dispose?.()
    }
  }, [previewUrl])

  const sizeLabel = formatSize(sizeBytes)

  return (
    <div className="my-2 flex flex-col gap-2">
      {previewUrl ? (
        <div className={FRAME_CLASS}>
          <div className="absolute inset-0" ref={mountRef} />
          {status !== 'ready' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              {status === 'error' ? `Preview unavailable — ${error}` : 'Loading 3D preview…'}
            </div>
          )}
          {status === 'ready' && (
            <div className="pointer-events-none absolute bottom-2 left-3 text-xs text-muted-foreground">
              drag to rotate · scroll to zoom
            </div>
          )}
        </div>
      ) : (
        <div className={cn(FRAME_CLASS, 'flex h-20 items-center justify-center text-sm text-muted-foreground')}>
          No preview mesh was generated for this model.
        </div>
      )}

      <div className="flex items-center gap-2 text-sm">
        <a className="font-medium underline underline-offset-2" download={name} href={url}>
          {name}
        </a>
        {sizeLabel && <span className="text-muted-foreground">{sizeLabel}</span>}
        <span className="text-muted-foreground">· STEP, opens in FreeCAD or any CAD tool</span>
      </div>
    </div>
  )
}
