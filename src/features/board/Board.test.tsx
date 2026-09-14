import { fireEvent, render, screen, within } from '@testing-library/react'
import { Provider } from 'jotai'
import { describe, expect, it } from 'vitest'
import Board from './Board'

describe('Board', () => {
  it('filters candidates by name or role', () => {
    render(<Provider><Board /></Provider>)

    fireEvent.change(screen.getByPlaceholderText('Search candidates'), { target: { value: 'frontend' } })

    expect(screen.getByText('Liam Chen')).toBeInTheDocument()
    expect(screen.getByText('Noah Williams')).toBeInTheDocument()
    expect(screen.queryByText('Ava Rodriguez')).not.toBeInTheDocument()
  })

  it('moves a candidate to the next stage', () => {
    render(<Provider><Board /></Provider>)

    const avaCard = screen.getByText('Ava Rodriguez').closest('article')
    expect(avaCard).not.toBeNull()
    fireEvent.click(within(avaCard as HTMLElement).getByRole('button', { name: 'Move to Screening →' }))

    expect(screen.getByText('Ava Rodriguez').closest('section')).toHaveTextContent('Screening')
  })
})
