import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import AppUpdatesPage from '@/app/(app)/updates/page'
import { App } from '@capacitor/app'

let mockResumeListener: ((event: { isActive: boolean }) => void) | undefined
const mockNative = {
  downloadVerified: jest.fn(),
  installVerified: jest.fn(),
  openInstallSettings: jest.fn(),
  addListener: jest.fn(),
}

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@capacitor/browser', () => ({ Browser: { open: jest.fn() } }))
jest.mock('@capacitor/app', () => ({
  App: { addListener: jest.fn((_event: string, listener: (event: { isActive: boolean }) => void) => {
    mockResumeListener = listener
    return Promise.resolve({ remove: jest.fn().mockResolvedValue(undefined) })
  }) },
}))
jest.mock('@/lib/nativeApkUpdater', () => ({ getNativeApkUpdater: () => mockNative }))
jest.mock('@/hooks/useApkUpdate', () => ({ useApkUpdate: () => ({
  android: true,
  installedBuild: 1053,
  latest: {
    build: 1054,
    pageUrl: 'https://github.com/alefe-redes-computadores/dfl-finance/releases',
    expiresAt: null,
    direct: { sha256: 'a'.repeat(64), bytes: 12500000 },
  },
  state: 'ready',
  updateAvailable: true,
  refresh: jest.fn(),
}) }))
jest.mock('@/lib/mobileUpdateService', () => ({
  fetchApkWorkflowHealth: jest.fn().mockResolvedValue({ kind: 'none', build: 1054 }),
}))
jest.mock('@/lib/financeReleaseNotes', () => ({ FINANCE_RELEASE_NOTES: [] }))

beforeEach(() => {
  jest.clearAllMocks()
  mockResumeListener = undefined
  mockNative.downloadVerified.mockResolvedValue({ verified: true, build: 1054 })
  mockNative.openInstallSettings.mockResolvedValue(undefined)
  mockNative.addListener.mockResolvedValue({ remove: jest.fn().mockResolvedValue(undefined) })
})

async function reachPermission() {
  render(<AppUpdatesPage />)
  await waitFor(() => expect(App.addListener).toHaveBeenCalledWith('appStateChange', expect.any(Function)))
  fireEvent.click(screen.getByRole('button', { name: 'Baixar e atualizar no aplicativo' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Abrir permissões do Android' })).toBeTruthy())
  expect(mockNative.downloadVerified).toHaveBeenCalledTimes(1)
  expect(mockNative.installVerified).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Abrir permissões do Android' }))
  await waitFor(() => expect(mockNative.openInstallSettings).toHaveBeenCalledTimes(1))
}

describe('R466 — retorno inteligente de permissões Android', () => {
  it('retoma a instalação pendente uma só vez, sem refazer o download', async () => {
    mockNative.installVerified.mockResolvedValueOnce({ permissionRequired: true })
      .mockResolvedValueOnce({ opened: true })
    await reachPermission()
    act(() => {
      mockResumeListener?.({ isActive: true })
      mockResumeListener?.({ isActive: true })
    })
    await waitFor(() => expect(mockNative.installVerified).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByText('Instalador do Android solicitado.')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Abrir permissões do Android' })).toBeNull()
    expect(mockNative.downloadVerified).toHaveBeenCalledTimes(1)
  })

  it('sem autorização, não declara sucesso nem inicia instalação indevida', async () => {
    mockNative.installVerified.mockResolvedValue({ permissionRequired: true })
    await reachPermission()
    act(() => { mockResumeListener?.({ isActive: true }) })
    await waitFor(() => expect(mockNative.installVerified).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('button', { name: 'Abrir permissões do Android' })).toBeTruthy()
    expect(screen.queryByText('Instalador do Android solicitado.')).toBeNull()
    expect(mockNative.downloadVerified).toHaveBeenCalledTimes(1)
  })
})
