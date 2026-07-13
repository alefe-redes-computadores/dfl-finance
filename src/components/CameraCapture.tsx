'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Camera, AlertCircle } from 'lucide-react'

interface CameraCaptureProps {
  isOpen: boolean
  onClose: () => void
  onCapture: (file: File) => void
}

export default function CameraCapture({ isOpen, onClose, onCapture }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    let cancelled = false

    const startCamera = async () => {
      try {
        setError('')
        setReady(false)
        setLoading(true)

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera not supported')
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })

        if (cancelled) {
          mediaStream.getTracks().forEach((t) => t.stop())
          return
        }

        streamRef.current = mediaStream

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
          await videoRef.current.play().catch(() => {})
        }
      } catch {
        setError('Não foi possível acessar a câmera. Verifique as permissões.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    startCamera()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      setReady(false)
    }
  }, [isOpen])

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current || !ready) return

    const video = videoRef.current
    const canvas = canvasRef.current

    const width = video.videoWidth
    const height = video.videoHeight

    if (!width || !height) return

    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, width, height)

    canvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' })
      onCapture(file)
      onClose()
    }, 'image/jpeg', 0.92)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      <div className="flex justify-between items-center p-4 text-white border-b border-white/10">
        <button type="button" onClick={onClose} className="p-2 rounded-full active:scale-95" aria-label="Fechar câmera">
          <X size={24} />
        </button>
        <span className="font-bold">Tirar foto</span>
        <div className="w-10" />
      </div>

      {error ? (
        <div className="flex-1 flex items-center justify-center text-white p-4 text-center">
          <div className="max-w-sm">
            <AlertCircle className="mx-auto mb-3" size={28} />
            <p>{error}</p>
          </div>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={() => setReady(true)}
            className="flex-1 w-full object-cover bg-black"
          />

          <div className="p-6 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={handleCapture}
              disabled={!ready || loading}
              className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.96]"
              aria-label="Capturar foto"
            >
              <div className="w-14 h-14 rounded-full border-2 border-gray-800 flex items-center justify-center">
                <Camera size={20} className="text-gray-800" />
              </div>
            </button>
          </div>

          <canvas ref={canvasRef} className="hidden" />
        </>
      )}
    </div>
  )
}