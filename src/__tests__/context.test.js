function toggleAppMode(currentMode) {
  return currentMode === 'personal' ? 'dfl' : 'personal'
}

describe('toggleAppMode', () => {
  it('alterna de personal para dfl', () => {
    expect(toggleAppMode('personal')).toBe('dfl')
  })

  it('alterna de dfl para personal', () => {
    expect(toggleAppMode('dfl')).toBe('personal')
  })
})