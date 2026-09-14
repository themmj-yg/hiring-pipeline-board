import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Provider } from 'jotai'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applicants } from '../applicants'
import { fetchApplicants } from '../mock-api'
import Board from './Board'

vi.mock('../mock-api', () => ({
  fetchApplicants: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(fetchApplicants).mockResolvedValue(applicants)
})

describe('Board', () => {
  it('loads applicants into four semantic stage regions', async () => {
    render(<Provider><Board /></Provider>)

    await waitFor(() => expect(screen.getByRole('region', { name: '서류검토' })).toBeInTheDocument())

    expect(screen.getByRole('region', { name: '면접' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '처우협의' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '최종합격/불합격' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: '서류검토 지원자 목록' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(200)
  })

  it('opens applicant details from a focusable card button', async () => {
    render(<Provider><Board /></Provider>)
    await waitFor(() => expect(screen.getByRole('region', { name: '서류검토' })).toBeInTheDocument())

    const firstCard = within(screen.getByRole('list', { name: '서류검토 지원자 목록' })).getAllByRole('button')[0]
    expect(firstCard).toHaveAttribute('type', 'button')
    firstCard.focus()
    expect(firstCard).toHaveFocus()
    fireEvent.click(firstCard)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Ava Rodriguez' })).toBeInTheDocument()
  })
})
