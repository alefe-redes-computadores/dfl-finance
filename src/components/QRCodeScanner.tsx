'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface QRCodeScannerProps {
  onResult: (text: string) => void
  onClose: () => void
}

export default function QRCodeScanner({ onResult, onClose }: QRCodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [starting, setStarting] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode('reader')
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 250 },
          async (decodedText) => {
            await stopScanner(false)
            onResult(decodedText)
          },
          () => {}
        )

        if (mounted) setStarting(false)
      } catch {
        if (mounted) {
          setError('Não foi possível iniciar o leitor de QR Code.')
          setStarting(false)
        }
      }
    }

    startScanner()

    return () => {
      mounted = false
      stopScanner(false)
    }
  }, [])

  const stopScanner = async (shouldClose = true) => {
    try {
      const scanner = scannerRef.current
      if (scanner) {
        const state = scanner.getState()
        if (state === 2 || state === 3) {
          await scanner.stop()
        }
        await scanner.clear()
      }
    } catch {
    } finally {
      scannerRef.current = null
      if (shouldClose) onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-[300] bg-black flex flex-col">
      <div className="p-4 flex justify-between items-center text-white">
        <span className="font-bold">Escanear QR Code</span>
        <button type="button" onClick={() => stopScanner(true)}>
          Fechar
        </button>
      </div>

      {error ? (
        <div className="flex-1 flex items-center justify-center text-white p-6 text-center">
          {error}
        </div>
      ) : (
        <>
          <div id="reader" className="flex-1 w-full" />
          {starting && (
            <div className="p-4 text-center text-white/80 text-sm">
              Iniciando câmera...
            </div>
          )}
        </>
      )}
    </div>
  )
}