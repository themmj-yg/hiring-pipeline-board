import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Provider } from 'jotai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applicants } from '../applicants'
import { fetchApplicants, patchApplicant } from '../mock-api'
import Board from './Board'
import { moveApplicantToStage } from './movement'

vi.mock('../mock-api', () => ({
  fetchApplicants: vi.fn(),
  patchApplicant: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fetchApplicants).mockResolvedValue(applicants)
  vi.mocked(patchApplicant).mockImplementation(async (id, patch) => {
    const applicant = applicants.find((item) => item.id === id)
    if (!applicant || !patch.stage) throw new Error('Applicant not found')
    return { ...applicant, stage: patch.stage }
  })
})

afterEach(() => {
  vi.useRealTimers()
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

  it('shows a loading state while the API request is pending', () => {
    vi.mocked(fetchApplicants).mockReturnValueOnce(new Promise(() => undefined))
    render(<Provider><Board /></Provider>)

    expect(screen.getByText('지원자 목록을 불러오는 중입니다.')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '서류검토' })).not.toBeInTheDocument()
  })

  it('shows an API error state when loading fails', async () => {
    vi.mocked(fetchApplicants).mockRejectedValueOnce(new Error('network'))
    render(<Provider><Board /></Provider>)

    expect(await screen.findByRole('alert')).toHaveTextContent('지원자 목록을 불러오지 못했습니다.')
    expect(screen.queryByRole('region', { name: '서류검토' })).not.toBeInTheDocument()
  })

  it('debounces name search and applies the job filter through the derived lists', async () => {
    render(<Provider><Board /></Provider>)
    await waitFor(() => expect(screen.getByRole('region', { name: '서류검토' })).toBeInTheDocument())

    fireEvent.change(screen.getByRole('searchbox', { name: '이름 검색' }), { target: { value: 'Ava Rodriguez' } })
    expect(screen.getAllByRole('listitem')).toHaveLength(200)
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2))

    fireEvent.change(screen.getByRole('combobox', { name: '직무 필터' }), { target: { value: 'Product Designer' } })
    expect(screen.getAllByRole('listitem')).toHaveLength(2)

    fireEvent.change(screen.getByRole('searchbox', { name: '이름 검색' }), { target: { value: '' } })
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(50))
  })

  it('shows a zero-result state when filters match no applicants', async () => {
    render(<Provider><Board /></Provider>)
    await waitFor(() => expect(screen.getByRole('region', { name: '서류검토' })).toBeInTheDocument())

    fireEvent.change(screen.getByRole('searchbox', { name: '이름 검색' }), { target: { value: 'does-not-exist' } })

    expect(await screen.findByRole('status')).toHaveTextContent('검색 또는 필터 조건에 맞는 지원자가 없습니다.')
    expect(screen.queryByRole('region', { name: '서류검토' })).not.toBeInTheDocument()
  })

  it('opens applicant details, moves focus, and closes with Escape', async () => {
    render(<Provider><Board /></Provider>)
    await waitFor(() => expect(screen.getByRole('region', { name: '서류검토' })).toBeInTheDocument())

    const firstCard = within(screen.getByRole('list', { name: '서류검토 지원자 목록' })).getAllByRole('listitem')[0].querySelector('[role="button"]') as HTMLElement
    expect(firstCard).toHaveAttribute('role', 'button')
    expect(firstCard).toHaveAttribute('tabindex', '0')
    firstCard.focus()
    expect(firstCard).toHaveFocus()
    fireEvent.click(firstCard)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Ava Rodriguez' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: '상세보기 닫기' })).toHaveFocus())
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes applicant details when the backdrop is clicked', async () => {
    render(<Provider><Board /></Provider>)
    await waitFor(() => expect(screen.getByRole('region', { name: '서류검토' })).toBeInTheDocument())

    const firstCard = within(screen.getByRole('list', { name: '서류검토 지원자 목록' })).getAllByRole('listitem')[0].querySelector('[role="button"]') as HTMLElement
    fireEvent.click(firstCard)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('presentation'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('moves a card with the keyboard-accessible next-stage button', async () => {
    render(<Provider><Board /></Provider>)
    await waitFor(() => expect(screen.getByRole('region', { name: '서류검토' })).toBeInTheDocument())

    const cardItem = screen.getByText('Ava Rodriguez', { exact: true }).closest('li')
    expect(cardItem).not.toBeNull()
    const moveButton = within(cardItem as HTMLElement).getByRole('button', { name: '면접 단계로 이동' })
    moveButton.focus()
    expect(moveButton).toHaveFocus()
    fireEvent.keyDown(moveButton, { key: 'Enter' })
    fireEvent.click(moveButton)

    await waitFor(() => expect(patchApplicant).toHaveBeenCalledWith('applicant-1', { stage: 'Screening' }))
    expect(moveApplicantToStage(applicants, 'applicant-1', 'Screening')[0].stage).toBe('Screening')
  })

  it('updates the column before a successful API response', async () => {
    let resolvePatch: ((value: typeof applicants[0]) => void) | undefined
    vi.mocked(patchApplicant).mockReturnValueOnce(new Promise((resolve) => { resolvePatch = resolve }))
    render(<Provider><Board /></Provider>)
    await waitFor(() => expect(screen.getByRole('region', { name: '서류검토' })).toBeInTheDocument())

    const cardItem = screen.getByText('Ava Rodriguez', { exact: true }).closest('li') as HTMLElement
    fireEvent.click(within(cardItem).getByRole('button', { name: '면접 단계로 이동' }))

    await waitFor(() => expect(within(screen.getByRole('list', { name: '면접 지원자 목록' })).getByText('Ava Rodriguez')).toBeInTheDocument())
    resolvePatch?.(applicants[0])
  })

  it('rolls back a failed move and shows a toast', async () => {
    vi.mocked(patchApplicant).mockRejectedValueOnce(new Error('network'))
    render(<Provider><Board /></Provider>)
    await waitFor(() => expect(screen.getByRole('region', { name: '서류검토' })).toBeInTheDocument())

    const cardItem = screen.getByText('Ava Rodriguez', { exact: true }).closest('li') as HTMLElement
    fireEvent.click(within(cardItem).getByRole('button', { name: '면접 단계로 이동' }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('단계 이동에 실패해 이전 상태로 되돌렸습니다.'))
    expect(within(screen.getByRole('list', { name: '서류검토 지원자 목록' })).getByText('Ava Rodriguez')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '알림 닫기' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('automatically closes the rollback toast after five seconds', async () => {
    vi.mocked(patchApplicant).mockRejectedValueOnce(new Error('network'))
    render(<Provider><Board /></Provider>)
    await waitFor(() => expect(screen.getByRole('region', { name: '서류검토' })).toBeInTheDocument())

    vi.useFakeTimers()
    const cardItem = screen.getByText('Ava Rodriguez', { exact: true }).closest('li') as HTMLElement
    fireEvent.click(within(cardItem).getByRole('button', { name: '면접 단계로 이동' }))
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByRole('status')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('does not let an older failed request roll back a newer move', async () => {
    let rejectFirst: ((reason?: unknown) => void) | undefined
    let resolveSecond: ((value: typeof applicants[0]) => void) | undefined
    vi.mocked(patchApplicant)
      .mockReturnValueOnce(new Promise((_, reject) => { rejectFirst = reject }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveSecond = resolve }))
    render(<Provider><Board /></Provider>)
    await waitFor(() => expect(screen.getByRole('region', { name: '서류검토' })).toBeInTheDocument())

    const firstCard = screen.getByText('Ava Rodriguez', { exact: true }).closest('li') as HTMLElement
    fireEvent.click(within(firstCard).getByRole('button', { name: '면접 단계로 이동' }))
    await waitFor(() => expect(within(screen.getByRole('list', { name: '면접 지원자 목록' })).getByText('Ava Rodriguez')).toBeInTheDocument())

    const secondCard = screen.getByText('Ava Rodriguez', { exact: true }).closest('li') as HTMLElement
    fireEvent.click(within(secondCard).getByRole('button', { name: '처우협의 단계로 이동' }))
    await waitFor(() => expect(within(screen.getByRole('list', { name: '처우협의 지원자 목록' })).getByText('Ava Rodriguez')).toBeInTheDocument())

    rejectFirst?.(new Error('old request failed'))
    await waitFor(() => expect(within(screen.getByRole('list', { name: '처우협의 지원자 목록' })).getByText('Ava Rodriguez')).toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent('단계 이동에 실패해 이전 상태로 되돌렸습니다.')
    resolveSecond?.(applicants[0])
  })
})
