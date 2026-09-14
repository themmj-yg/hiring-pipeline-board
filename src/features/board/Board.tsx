import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent } from 'react'
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai'
import { List, type RowComponentProps } from 'react-window'
import { fetchApplicants, patchApplicant } from '../mock-api'
import { stages, type Applicant, type FinalOutcome, type Stage } from '../applicants'
import { moveApplicantToStage } from './movement'

type BoardColumn = {
  stage: Stage
  label: string
  description: string
}

type UndoMove = {
  applicantId: string
  fromStage: Stage
  toStage: Stage
}

type MoveUpdate = {
  id: string
  stage: Stage
  operationId: number
  recordUndo: boolean
  preserveLastMoveOnFailure: boolean
  finalOutcome?: FinalOutcome
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
const undoMoveAtom = atom<UndoMove | null>(null)
const undoPendingAtom = atom(false)
const searchQueryAtom = atom('')
const debouncedSearchQueryAtom = atom('')
const jobFilterAtom = atom('all')
const undoRetryAtom = atom(false)
const pendingMovesAtom = atom<Record<string, { operationId: number; previousStage: Stage; preserveLastMoveOnFailure: boolean }>>({})
const optimisticMoveAtom = atom(null, (get, set, update: MoveUpdate) => {
  const applicant = get(applicantsAtom).find((item) => item.id === update.id)
  if (!applicant) return
  const moved = moveApplicantToStage(get(applicantsAtom), update.id, update.stage, Date.now())
  set(applicantsAtom, moved.map((item) => item.id === update.id ? { ...item, finalOutcome: update.finalOutcome ?? null } : item))
  if (update.recordUndo) {
    set(undoMoveAtom, { applicantId: update.id, fromStage: applicant.stage, toStage: update.stage })
    set(undoRetryAtom, false)
    set(undoPendingAtom, false)
  }
  set(pendingMovesAtom, { ...get(pendingMovesAtom), [update.id]: { operationId: update.operationId, previousStage: applicant.stage, preserveLastMoveOnFailure: update.preserveLastMoveOnFailure } })
})
const rollbackMoveAtom = atom(null, (get, set, update: { id: string; operationId: number }) => {
  const pendingMove = get(pendingMovesAtom)[update.id]
  if (!pendingMove || pendingMove.operationId !== update.operationId) return
  set(applicantsAtom, moveApplicantToStage(get(applicantsAtom), update.id, pendingMove.previousStage))
  if (!pendingMove.preserveLastMoveOnFailure && get(undoMoveAtom)?.applicantId === update.id) set(undoMoveAtom, null)
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
  get(filteredApplicantsAtom).toSorted((left, right) => right.updatedAt - left.updatedAt).forEach((applicant) => grouped[applicant.stage].push(applicant))
  return grouped
})

const jobOptionsAtom = atom((get) => Array.from(new Set(get(applicantsAtom).map((applicant) => applicant.role))).sort())

type ApplicantCardProps = {
  applicant: Applicant
  style?: React.CSSProperties
  ariaAttributes?: RowComponentProps['ariaAttributes']
}

function ApplicantCard({ applicant, style, ariaAttributes }: ApplicantCardProps) {
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
    <li {...ariaAttributes} style={style} onClick={openDetails} className="group box-border rounded-lg border border-brand/5 bg-white p-4 shadow-[0_2px_8px_rgba(24,36,50,0.02)] transition hover:-translate-y-0.5 hover:border-brand/15 hover:shadow-[0_4px_12px_rgba(24,36,50,0.06)]">
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
          <div className="flex min-w-0 flex-col">
          <span>{applicant.applied}</span>
            {applicant.stage === 'Offer' ? <span className={applicant.finalOutcome === 'passed' ? 'font-semibold text-emerald-700' : applicant.finalOutcome === 'failed' ? 'font-semibold text-rose-700' : 'font-semibold text-black/50'}>{applicant.finalOutcome === 'passed' ? '최종합격' : applicant.finalOutcome === 'failed' ? '불합격' : '결과 미정'}</span> : <span>{applicant.stage}</span>}
        </div>
        <ApplicantMoveButton applicant={applicant} />
      </div>
    </li>
  )
}

function ApplicantRow({ applicants, index, style, ariaAttributes }: RowComponentProps<{ applicants: Applicant[] }>) {
  return <ApplicantCard applicant={applicants[index]} style={style} ariaAttributes={ariaAttributes} />
}

function ApplicantList({ applicants, label }: { applicants: Applicant[]; label: string }) {
  return <List
    tagName="ul"
    className="mt-5"
    defaultHeight={640}
    overscanCount={6}
    rowComponent={ApplicantRow}
    rowCount={applicants.length}
    rowHeight={148}
    rowProps={{ applicants }}
    style={{ height: 640, width: '100%' }}
    aria-label={`${label} 지원자 목록`}
  />
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

  const handleMove = async (event: MouseEvent<HTMLButtonElement>, outcome: FinalOutcome = null): Promise<void> => {
    event.stopPropagation()
    const operationId = ++nextOperationId
    optimisticMove({ id: applicant.id, stage: nextStage, operationId, recordUndo: true, preserveLastMoveOnFailure: false, finalOutcome: outcome })
    setIsSaving(true)
    try {
      await patchApplicant(applicant.id, { stage: nextStage, finalOutcome: outcome })
      settleMove({ id: applicant.id, operationId })
    } catch {
      rollbackMove({ id: applicant.id, operationId })
      setToast('단계 이동에 실패해 이전 상태로 되돌렸습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  if (nextStage === 'Offer') return <span className="flex shrink-0 items-center gap-2">
    <button type="button" onClick={(event) => void handleMove(event, 'passed')} onKeyDown={(event) => event.stopPropagation()} disabled={isSaving} className="rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 disabled:cursor-wait disabled:opacity-50">합격처리</button>
    <button type="button" onClick={(event) => void handleMove(event, 'failed')} onKeyDown={(event) => event.stopPropagation()} disabled={isSaving} className="rounded-full bg-rose-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-400/50 disabled:cursor-wait disabled:opacity-50">불합격처리</button>
  </span>

  return <span className="flex shrink-0 items-center gap-2">
    <button type="button" onClick={(event) => void handleMove(event)} onKeyDown={(event) => event.stopPropagation()} disabled={isSaving} className="rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400/50 disabled:cursor-wait disabled:opacity-50">{isSaving ? '저장 중...' : `${nextStageLabel} 단계로 이동`}</button>
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

function RollbackToast({ message, onClose, onRetry }: { message: string; onClose: () => void; onRetry?: () => void }) {
  useEffect(() => {
    const timeoutId = window.setTimeout(onClose, 5000)
    return () => window.clearTimeout(timeoutId)
  }, [message, onClose])

  return <div role="status" aria-live="polite" className="fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg">
    <span>{message}</span>
    {onRetry && <button type="button" onClick={onRetry} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-white/70">다시 시도</button>}
    <button type="button" onClick={onClose} className="rounded-full p-0.5 text-white/70 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50" aria-label="알림 닫기">x</button>
  </div>
}

function UndoToast({ move, onUndo, disabled }: { move: UndoMove; onUndo: () => void; disabled: boolean }) {
  const fromLabel = boardColumns.find((column) => column.stage === move.fromStage)?.label
  const toLabel = boardColumns.find((column) => column.stage === move.toStage)?.label

  return <div role="status" aria-live="polite" className="fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg">
    <span>{fromLabel}에서 {toLabel}로 이동했습니다.</span>
    <button type="button" onClick={onUndo} disabled={disabled} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-white/70 disabled:cursor-not-allowed disabled:opacity-50">Undo</button>
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
  const undoMove = useAtomValue(undoMoveAtom)
  const clearUndoMove = useSetAtom(undoMoveAtom)
  const undoPending = useAtomValue(undoPendingAtom)
  const setUndoPending = useSetAtom(undoPendingAtom)
  const optimisticMove = useSetAtom(optimisticMoveAtom)
  const rollbackMove = useSetAtom(rollbackMoveAtom)
  const settleMove = useSetAtom(settleMoveAtom)
  const undoRetry = useAtomValue(undoRetryAtom)
  const setUndoRetry = useSetAtom(undoRetryAtom)
  const toast = useAtomValue(toastAtom)
  const setToast = useSetAtom(toastAtom)
  const filteredApplicants = useAtomValue(filteredApplicantsAtom)
  const applicantsByStage = useAtomValue(applicantsByStageAtom)
  const jobOptions = useAtomValue(jobOptionsAtom)

  const handleUndo = async (): Promise<void> => {
    if (!undoMove) return
    const move = undoMove
    const operationId = ++nextOperationId
    setUndoPending(true)
    setUndoRetry(false)
    setToast(null)
    optimisticMove({ id: move.applicantId, stage: move.fromStage, operationId, recordUndo: false, preserveLastMoveOnFailure: true })
    try {
      await patchApplicant(move.applicantId, { stage: move.fromStage, finalOutcome: null })
      settleMove({ id: move.applicantId, operationId })
      clearUndoMove(null)
      setUndoPending(false)
    } catch {
      rollbackMove({ id: move.applicantId, operationId })
      setUndoPending(false)
      setUndoRetry(true)
      setToast('되돌리기에 실패했습니다.')
    }
  }

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
          <div className="mt-1 flex items-center gap-3">
            <h2 id="board-title" className="text-2xl font-bold tracking-tight text-black">지원자 현황</h2>
            <button type="button" onClick={() => void handleUndo()} disabled={!undoMove || undoPending} className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400/50 disabled:cursor-not-allowed disabled:opacity-10">실행취소</button>
          </div>
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
        {!loading && !error && filteredApplicants.length === 0 && <p role="status" className="rounded-lg border border-dashed border-brand/10 bg-white p-6 text-center text-sm text-black/50">검색 또는 필터 조건에 맞는 지원자가 없습니다.</p>}
        {!loading && !error && filteredApplicants.length > 0 && <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {boardColumns.map(({ stage, label, description }) => {
            const stageApplicants = applicantsByStage[stage]
            return <section key={stage} role="region" aria-label={label} className="min-h-96 rounded-xl border border-brand/5 bg-white p-6 shadow-[0_4px_12px_rgba(24,36,50,0.02)]">
              <div className="flex items-start justify-between gap-4 border-b border-brand/5 pb-5">
                <div><h3 className="text-base font-semibold tracking-tight text-black">{label}</h3><p className="mt-1 text-xs font-medium text-black/50">{description}</p></div>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-black/50" aria-label="지원자 수">{stageApplicants.length}</span>
              </div>
              <ApplicantList applicants={stageApplicants} label={label} />
            </section>
          })}
        </div>}
      </section>
      {undoMove && <UndoToast move={undoMove} disabled={undoPending} onUndo={() => void handleUndo()} />}
      {toast && <RollbackToast message={toast} onRetry={undoRetry ? () => void handleUndo() : undefined} onClose={() => setToast(null)} />}
      {selectedApplicant && <ApplicantDetails applicant={selectedApplicant} onClose={() => setSelectedApplicantId(null)} />}
    </main>
  )
}
