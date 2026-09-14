import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent } from 'react'
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai'
import { fetchApplicants, patchApplicant } from '../mock-api'
import { stages, type Applicant, type Stage } from '../applicants'
import { moveApplicantToStage } from './movement'

type BoardColumn = {
  stage: Stage
  label: string
  description: string
}

const boardColumns: BoardColumn[] = [
  { stage: 'Applied', label: '서류검토', description: '지원서를 검토할 후보자' },
  { stage: 'Screening', label: '면접', description: '면접을 진행할 후보자' },
  { stage: 'Interview', label: '처우협의', description: '처우를 협의할 후보자' },
  { stage: 'Offer', label: '최종합격/불합격', description: '최종 결과를 정리할 후보자' },
]

let nextOperationId = 0

const applicantsAtom = atom<Applicant[]>([])
const loadingAtom = atom(true)
const errorAtom = atom<string | null>(null)
const selectedApplicantIdAtom = atom<string | null>(null)
const toastAtom = atom<string | null>(null)
const searchQueryAtom = atom('')
const debouncedSearchQueryAtom = atom('')
const jobFilterAtom = atom('all')
const pendingMovesAtom = atom<Record<string, { operationId: number; previousStage: Stage }>>({})
const optimisticMoveAtom = atom(null, (get, set, update: { id: string; stage: Stage; operationId: number }) => {
  const applicant = get(applicantsAtom).find((item) => item.id === update.id)
  if (!applicant) return
  set(applicantsAtom, moveApplicantToStage(get(applicantsAtom), update.id, update.stage))
  set(pendingMovesAtom, { ...get(pendingMovesAtom), [update.id]: { operationId: update.operationId, previousStage: applicant.stage } })
})
const rollbackMoveAtom = atom(null, (get, set, update: { id: string; operationId: number }) => {
  const pendingMove = get(pendingMovesAtom)[update.id]
  if (!pendingMove || pendingMove.operationId !== update.operationId) return
  set(applicantsAtom, moveApplicantToStage(get(applicantsAtom), update.id, pendingMove.previousStage))
  const { [update.id]: _removed, ...remaining } = get(pendingMovesAtom)
  set(pendingMovesAtom, remaining)
})
const settleMoveAtom = atom(null, (get, set, update: { id: string; operationId: number }) => {
  const pendingMove = get(pendingMovesAtom)[update.id]
  if (!pendingMove || pendingMove.operationId !== update.operationId) return
  const { [update.id]: _removed, ...remaining } = get(pendingMovesAtom)
  set(pendingMovesAtom, remaining)
})

const filteredApplicantsAtom = atom((get): Applicant[] => {
  const query = get(debouncedSearchQueryAtom).trim().toLowerCase()
  const job = get(jobFilterAtom)
  return get(applicantsAtom).filter((applicant) => {
    const matchesName = !query || applicant.name.toLowerCase().includes(query)
    const matchesJob = job === 'all' || applicant.role === job
    return matchesName && matchesJob
  })
})

const selectedApplicantAtom = atom((get) => {
  const selectedId = get(selectedApplicantIdAtom)
  return get(applicantsAtom).find((applicant) => applicant.id === selectedId) ?? null
})

const applicantsByStageAtom = atom((get): Record<Stage, Applicant[]> => {
  const grouped: Record<Stage, Applicant[]> = { Applied: [], Screening: [], Interview: [], Offer: [] }
  get(filteredApplicantsAtom).forEach((applicant) => grouped[applicant.stage].push(applicant))
  return grouped
})

const jobOptionsAtom = atom((get) => Array.from(new Set(get(applicantsAtom).map((applicant) => applicant.role))).sort())

function ApplicantCard({ applicant }: { applicant: Applicant }) {
  const setSelectedApplicantId = useSetAtom(selectedApplicantIdAtom)
  const openDetails = (): void => setSelectedApplicantId(applicant.id)
  const handleCardKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openDetails()
    }
  }

  return (
    <li onClick={openDetails} className="group rounded-lg border border-brand/5 bg-white p-4 shadow-[0_2px_8px_rgba(24,36,50,0.02)] transition hover:-translate-y-0.5 hover:border-brand/15 hover:shadow-[0_4px_12px_rgba(24,36,50,0.06)]">
      <div role="button" tabIndex={0} onKeyDown={handleCardKeyDown} className="focus:outline-none focus:ring-2 focus:ring-brand/20">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="font-semibold tracking-tight text-black">{applicant.name}</h4>
            <p className="mt-1 text-xs font-medium text-black/55">{applicant.role}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-black/55">{applicant.initials}</span>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-brand/5 pt-3 text-[11px] text-black/45">
        <div className="flex flex-col min-w-0">
          <span>{applicant.applied}</span>
          <span>{applicant.stage}</span>
        </div>
        <ApplicantMoveButton applicant={applicant} />
      </div>
    </li>
  )
}

function ApplicantMoveButton({ applicant }: { applicant: Applicant }) {
  const optimisticMove = useSetAtom(optimisticMoveAtom)
  const rollbackMove = useSetAtom(rollbackMoveAtom)
  const settleMove = useSetAtom(settleMoveAtom)
  const setToast = useSetAtom(toastAtom)
  const [isSaving, setIsSaving] = useState(false)
  const currentIndex = stages.indexOf(applicant.stage)
  const nextStage = stages[currentIndex + 1]
  const nextStageLabel = boardColumns.find((column) => column.stage === nextStage)?.label

  if (!nextStage) return null

  const handleMove = async (event: MouseEvent<HTMLButtonElement>): Promise<void> => {
    event.stopPropagation()
    const operationId = ++nextOperationId
    optimisticMove({ id: applicant.id, stage: nextStage, operationId })
    setIsSaving(true)
    try {
      await patchApplicant(applicant.id, { stage: nextStage })
      settleMove({ id: applicant.id, operationId })
    } catch {
      rollbackMove({ id: applicant.id, operationId })
      setToast('단계 이동에 실패해 이전 상태로 되돌렸습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  return <span className="flex shrink-0 items-center gap-2">
    <button type="button" onClick={handleMove} onKeyDown={(event) => event.stopPropagation()} disabled={isSaving} className="rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400/50 disabled:cursor-wait disabled:opacity-50">{isSaving ? '저장 중...' : `${nextStageLabel} 단계로 이동`}</button>
  </span>
}

function ApplicantDetails({ applicant, onClose }: { applicant: Applicant; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-brand/20 p-6" role="presentation" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="applicant-details-title" className="w-full max-w-md rounded-xl border border-brand/5 bg-white p-6 shadow-[0_12px_32px_rgba(24,36,50,0.12)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/45">Applicant details</p>
            <h2 id="applicant-details-title" className="mt-2 text-xl font-bold tracking-tight text-black">{applicant.name}</h2>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} className="rounded-md px-2 py-1 text-sm text-black/50 hover:bg-slate-100 hover:text-black focus:outline-none focus:ring-2 focus:ring-brand/20" aria-label="상세보기 닫기">닫기</button>
        </div>
        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between gap-4 border-b border-brand/5 pb-3"><dt className="text-black/50">직무</dt><dd className="font-medium text-black">{applicant.role}</dd></div>
          <div className="flex justify-between gap-4 border-b border-brand/5 pb-3"><dt className="text-black/50">지원일</dt><dd className="font-medium text-black">{applicant.applied}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-black/50">현재 단계</dt><dd className="font-medium text-black">{applicant.stage}</dd></div>
        </dl>
      </section>
    </div>
  )
}

function RollbackToast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timeoutId = window.setTimeout(onClose, 5000)
    return () => window.clearTimeout(timeoutId)
  }, [message, onClose])

  return <div role="status" aria-live="polite" className="fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg">
    <span>{message}</span>
    <button type="button" onClick={onClose} className="rounded-full p-0.5 text-white/70 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50" aria-label="알림 닫기">x</button>
  </div>
}

export default function Board() {
  const setApplicants = useSetAtom(applicantsAtom)
  const setDebouncedSearchQuery = useSetAtom(debouncedSearchQueryAtom)
  const [searchQuery, setSearchQuery] = useAtom(searchQueryAtom)
  const [jobFilter, setJobFilter] = useAtom(jobFilterAtom)
  const [loading, setLoading] = useAtom(loadingAtom)
  const [error, setError] = useAtom(errorAtom)
  const selectedApplicant = useAtomValue(selectedApplicantAtom)
  const setSelectedApplicantId = useSetAtom(selectedApplicantIdAtom)
  const toast = useAtomValue(toastAtom)
  const setToast = useSetAtom(toastAtom)
  const applicantsByStage = useAtomValue(applicantsByStageAtom)
  const jobOptions = useAtomValue(jobOptionsAtom)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearchQuery(searchQuery), 200)
    return () => window.clearTimeout(timeoutId)
  }, [searchQuery, setDebouncedSearchQuery])

  useEffect(() => {
    let active = true
    void fetchApplicants()
      .then((items) => {
        if (active) setApplicants(items)
      })
      .catch(() => {
        if (active) setError('지원자 목록을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [setApplicants, setError, setLoading])

  return (
    <main className="min-h-screen bg-slate-50/60 text-black">
      <header className="border-b border-brand/5 bg-white/90 px-6 py-6 backdrop-blur sm:px-10">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/50">Hiring pipeline</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-black">채용 파이프라인</h1>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-6 py-8 sm:px-10 sm:py-10" aria-labelledby="board-title">
        <div className="mb-8">
          <p className="text-sm font-medium text-black/50">Candidate workspace</p>
          <h2 id="board-title" className="mt-1 text-2xl font-bold tracking-tight text-black">지원자 현황</h2>
        </div>
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1.5 text-xs font-semibold text-black/60">
            이름 검색
            <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="지원자 이름 검색" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-black outline-none transition placeholder:text-black/35 focus:border-brand focus:ring-2 focus:ring-brand/10" />
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-xs font-semibold text-black/60">
            직무 필터
            <select value={jobFilter} onChange={(event) => setJobFilter(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-black outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10">
              <option value="all">전체 직무</option>
              {jobOptions.map((job) => <option key={job} value={job}>{job}</option>)}
            </select>
          </label>
        </div>
        {loading && <p className="rounded-lg border border-dashed border-brand/10 bg-white p-6 text-center text-sm text-black/50">지원자 목록을 불러오는 중입니다.</p>}
        {error && <p role="alert" className="rounded-lg border border-dashed border-brand/10 bg-white p-6 text-center text-sm text-black/50">{error}</p>}
        {!loading && !error && <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {boardColumns.map(({ stage, label, description }) => {
            const stageApplicants = applicantsByStage[stage]
            return <section key={stage} role="region" aria-label={label} className="min-h-96 rounded-xl border border-brand/5 bg-white p-6 shadow-[0_4px_12px_rgba(24,36,50,0.02)]">
              <div className="flex items-start justify-between gap-4 border-b border-brand/5 pb-5">
                <div><h3 className="text-base font-semibold tracking-tight text-black">{label}</h3><p className="mt-1 text-xs font-medium text-black/50">{description}</p></div>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-black/50" aria-label="지원자 수">{stageApplicants.length}</span>
              </div>
              <ul className="mt-5 space-y-3" aria-label={`${label} 지원자 목록`}>
                {stageApplicants.map((applicant) => <ApplicantCard key={applicant.id} applicant={applicant} />)}
              </ul>
            </section>
          })}
        </div>}
      </section>
      {toast && <RollbackToast message={toast} onClose={() => setToast(null)} />}
      {selectedApplicant && <ApplicantDetails applicant={selectedApplicant} onClose={() => setSelectedApplicantId(null)} />}
    </main>
  )
}
