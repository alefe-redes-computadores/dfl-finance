'use client'

import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface QRCodeScannerProps {
  onResult: (text: string) => void
  onClose: () => void
}

export default function QRCodeScanner({ onResult, onClose }: QRCodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)

  useEffect(() => {
    scannerRef.current = new Html5Qrcode('reader')
    scannerRef.current.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: 250 },
      (decodedText) => {
        onResult(decodedText)
        stopScanner()
      },
      () => {} // ignora erros de leitura
    )
    return () => stopScanner()
  }, [])

  const stopScanner = () => {
    scannerRef.current?.stop().then(() => scannerRef.current?.clear())
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[300] bg-black flex flex-col">
      <div className="p-4 flex justify-between items-center text-white">
        <span className="font-bold">Escanear QR Code</span>
        <button onClick={stopScanner}>Fechar</button>
      </div>
      <div id="reader" className="flex-1 w-full" />
    </div>
  )
}