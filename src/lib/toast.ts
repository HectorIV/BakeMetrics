export type ToastTone = 'default' | 'success' | 'error'

export interface ToastMessage {
  id: number
  message: string
  tone: ToastTone
}

type Listener = (toast: ToastMessage) => void

const listeners = new Set<Listener>()
let counter = 0

export function toast(message: string, tone: ToastTone = 'default'): void {
  counter += 1
  const item: ToastMessage = { id: counter, message, tone }
  listeners.forEach((listener) => listener(item))
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
