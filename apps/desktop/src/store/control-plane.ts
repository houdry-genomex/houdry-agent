import { atom } from 'nanostores'

export type ControlPlanePhase = 'searching' | 'found' | 'connecting'

export interface ControlPlaneState {
  api: string | null
  phase: ControlPlanePhase
}

const INITIAL: ControlPlaneState = {
  api: null,
  phase: 'searching'
}

export const $controlPlane = atom<ControlPlaneState>(INITIAL)

export function resetControlPlaneForTests() {
  $controlPlane.set({ ...INITIAL })
}

export function setControlPlaneSearching() {
  $controlPlane.set({ api: null, phase: 'searching' })
}

export function setControlPlaneFound(api: string) {
  $controlPlane.set({ api, phase: 'found' })
}

export function setControlPlaneConnecting(api: string | null = $controlPlane.get().api) {
  $controlPlane.set({ api, phase: 'connecting' })
}
