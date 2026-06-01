import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Clock } from './Clock'

describe('Clock', () => {
  it('分小秒大顯示整秒', () => {
    render(<Clock totalSec={72} secSize={50} />)
    expect(screen.getByTestId('clock-min').textContent).toBe('1:')
    expect(screen.getByTestId('clock-sec').textContent).toBe('12')
  })
  it('over 時分與秒都套用紅色 class', () => {
    render(<Clock totalSec={104} secSize={40} tone="over" />)
    expect(screen.getByTestId('clock-sec').className).toContain('over-text')
    expect(screen.getByTestId('clock-min').className).toContain('over-text')
  })
  it('warn 時套用橘紅 class', () => {
    render(<Clock totalSec={80} secSize={40} tone="warn" />)
    expect(screen.getByTestId('clock-sec').className).toContain('warn-text')
  })
})
