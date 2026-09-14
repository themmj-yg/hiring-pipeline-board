import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Board from './Board'

describe('Board', () => {
  it('renders four semantic pipeline regions without applicant cards', () => {
    render(<Board />)

    expect(screen.getByRole('region', { name: '서류검토' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '면접' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '처우협의' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '최종합격/불합격' })).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })
})
