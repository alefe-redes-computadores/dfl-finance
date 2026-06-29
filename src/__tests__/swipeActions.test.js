function detectSwipe(startX, endX, threshold = 80) {
  const dx = endX - startX
  if (Math.abs(dx) > threshold) {
    return dx > 0 ? 'right' : 'left'
  }
  return null
}

describe('detectSwipe', () => {
  it('detecta swipe para a direita', () => {
    expect(detectSwipe(100, 200)).toBe('right')
  })

  it('detecta swipe para a esquerda', () => {
    expect(detectSwipe(200, 100)).toBe('left')
  })

  it('ignora movimento abaixo do threshold', () => {
    expect(detectSwipe(100, 150)).toBeNull()
  })

  it('usa threshold personalizado', () => {
    expect(detectSwipe(100, 180, 50)).toBe('right')
  })
})