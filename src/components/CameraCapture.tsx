'use client'

import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface CameraCaptureProps {
  isOpen: boolean
  onClose: () => void
  onCapture: (file: File) => void
}

export default function CameraCapture({ isOpen, onClose, onCapture }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Guarda o stream em ref para o cleanup sempre ter acesso ao valor correto
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return

    let cancelled = false

    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (cancelled) {
          mediaStream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = mediaStream
        if (videoRef.current) videoRef.current.srcObject = mediaStream
      } catch {
        setError('Não foi possível acessar a câmera. Verifique as permissões.')
      }
    }

    setError('')
    startCamera()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [isOpen])

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' })
        onCapture(file)
        onClose()
      }
    }, 'image/jpeg')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      <div className="flex justify-between items-center p-4 text-white">
        <button onClick={onClose} className="p-2">
          <X size={24} />
        </button>
        <span className="font-bold">Tirar foto</span>
        <div className="w-10" />
      </div>

      {error ? (
        <div className="flex-1 flex items-center justify-center text-white p-4 text-center">
          <p>{error}</p>
        </div>
      ) : (
        <>
          <video ref={videoRef} autoPlay playsInline className="flex-1 w-full object-cover" />
          <div className="p-6 flex justify-center">
            <button
              onClick={handleCapture}
              className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg"
            >
              <div className="w-14 h-14 rounded-full border-2 border-gray-800" />
            </button>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </>
      )}
    </div>
  )
}