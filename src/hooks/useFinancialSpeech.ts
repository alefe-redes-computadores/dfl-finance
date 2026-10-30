'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'

export type FinancialVoiceStatus = 'idle' | 'listening' | 'processing' | 'error'
type WebRecognizer = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start(): void
  abort(): void
}

const messageFor = (reason: string) => {
  if (/denied|permission|not-allowed/i.test(reason)) return 'Permissão de microfone negada. Ative nas configurações do Android ou do navegador.'
  if (/no-speech/i.test(reason)) return 'Nenhuma fala identificada. Tente novamente em um lugar silencioso.'
  if (/network|connection/i.test(reason)) return 'Reconhecimento de voz indisponível pela rede. Você pode digitar normalmente.'
  return 'Não foi possível reconhecer sua fala. Tente novamente ou digite o comando.'
}

export function useFinancialSpeech() {
  const [status, setStatus] = useState<FinancialVoiceStatus>('idle')
  const [notice, setNotice] = useState('')
  const [transcript, setTranscript] = useState('')
  const web = useRef<WebRecognizer | null>(null)
  const token = useRef(0)
  const active = useRef(false)

  const cancel = useCallback(() => {
    token.current += 1
    active.current = false
    try { web.current?.abort() } catch { /* encerramento opcional */ }
    web.current = null
    if (Capacitor.isNativePlatform()) {
      void import('@capacitor-community/speech-recognition').then(({ SpeechRecognition }) =>
        SpeechRecognition.stop().catch(() => {})
      ).catch(() => {})
    }
    setStatus('idle')
    setNotice('')
  }, [])

  useEffect(() => () => {
    token.current += 1
    active.current = false
    try { web.current?.abort() } catch { /* desmontagem */ }
    if (Capacitor.isNativePlatform()) {
      void import('@capacitor-community/speech-recognition').then(({ SpeechRecognition }) =>
        SpeechRecognition.stop().catch(() => {})
      ).catch(() => {})
    }
  }, [])

  const start = useCallback(async () => {
    if (active.current) return
    active.current = true
    const id = ++token.current
    setTranscript('')
    setNotice('Ouvindo... fale em português.')
    setStatus('listening')
    try {
      if (Capacitor.isNativePlatform()) {
        const { SpeechRecognition } = await import('@capacitor-community/speech-recognition')
        const available = await SpeechRecognition.available()
        if (!available.available) throw new Error('Reconhecimento nativo indisponível')
        const current = await SpeechRecognition.checkPermissions()
        if (current.speechRecognition !== 'granted') {
          const requested = await SpeechRecognition.requestPermissions()
          if (requested.speechRecognition !== 'granted') throw new Error('permission denied')
        }
        if (id !== token.current) return
        const result = await SpeechRecognition.start({ language: 'pt-BR', maxResults: 1, popup: true, partialResults: false })
        if (id !== token.current) return
        const value = result.matches?.[0]?.trim().slice(0, 400)
        if (!value) throw new Error('no-speech')
        setStatus('processing')
        setTranscript(value)
        setNotice('Transcrição recebida. Revise o comando antes de salvar.')
        active.current = false
        return
      }
      const target = window as unknown as {
        SpeechRecognition?: new () => WebRecognizer
        webkitSpeechRecognition?: new () => WebRecognizer
      }
      const Constructor = target.SpeechRecognition || target.webkitSpeechRecognition
      if (!Constructor) throw new Error('Reconhecimento indisponível neste navegador')
      const recognizer = new Constructor()
      web.current = recognizer
      recognizer.lang = 'pt-BR'
      recognizer.interimResults = false
      recognizer.maxAlternatives = 1
      recognizer.onresult = (event) => {
        if (id !== token.current) return
        const value = event.results[0]?.[0]?.transcript?.trim().slice(0, 400)
        if (value) {
          setTranscript(value)
          setNotice('Transcrição recebida. Confira antes de continuar.')
          setStatus('processing')
        }
      }
      recognizer.onerror = (event) => {
        if (id !== token.current) return
        setStatus('error')
        setNotice(messageFor(event.error || 'error'))
        active.current = false
      }
      recognizer.onend = () => {
        if (id !== token.current) return
        active.current = false
        web.current = null
        setStatus((previous) => previous === 'listening' ? 'idle' : previous)
      }
      recognizer.start()
    } catch (error) {
      if (id !== token.current) return
      active.current = false
      setStatus('error')
      setNotice(messageFor(String(error)))
    }
  }, [])

  return { status, notice, transcript, start, cancel }
}
