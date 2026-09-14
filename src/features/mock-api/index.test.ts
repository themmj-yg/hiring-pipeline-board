import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchApplicants, patchApplicant } from './index'

describe('mock applicants API', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.localStorage.clear()
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('returns and persists 200 typed applicants after a bounded delay', async () => {
    const request = fetchApplicants()
    await vi.advanceTimersByTimeAsync(800)
    const result = await request

    expect(result).toHaveLength(200)
    expect(window.localStorage.getItem('hiring-pipeline-board:applicants')).not.toBeNull()
    expect(result[0]).toMatchObject({ id: 'applicant-1', name: 'Ava Rodriguez', stage: 'Applied' })
  })

  it('persists a successful patch and rejects a failed write', async () => {
    const fetchRequest = fetchApplicants()
    await vi.advanceTimersByTimeAsync(800)
    await fetchRequest

    const patchRequest = patchApplicant('applicant-1', { stage: 'Screening' })
    await vi.advanceTimersByTimeAsync(800)
    await expect(patchRequest).resolves.toMatchObject({ id: 'applicant-1', stage: 'Screening' })

    vi.spyOn(Math, 'random').mockReturnValue(0.1)
    const failedRequest = patchApplicant('applicant-1', { stage: 'Interview' })
    const failure = expect(failedRequest).rejects.toThrow('Mock API write failed')
    await vi.advanceTimersByTimeAsync(800)
    await failure
  })
})