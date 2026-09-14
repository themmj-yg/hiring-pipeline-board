import { useEffect, useState, type MouseEvent } from 'react'
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

const applicantsAtom = atom<Applicant[]>([])
const loadingAtom = atom(true)
const errorAtom = atom<string | null>(null)
const selectedApplicantAtom = atom<Applicant | null>(null)
const moveApplicantAtom = atom(null, (get, set, update: { id: string; stage: Stage }) => {
  set(applicantsAtom, moveApplicantToStage(get(applicantsAtom), update.id, update.stage))
})

const applicantsByStageAtom = atom((get): Record<Stage, Applicant[]> => {
  const grouped: Record<Stage, Applicant[]> = { Applied: [], Screening: [], Interview: [], Offer: [] }
  get(applicantsAtom).forEach((applicant) => grouped[applicant.stage].push(applicant))
  return grouped
})

function ApplicantCard({ applicant }: { applicant: Applicant }) {
  const setSelectedApplicant = useSetAtom(selectedApplicantAtom)

  return (
    <li>
      <button
        type="button"
        onClick={() => setSelectedApplicant(applicant)}
        className="group w-full rounded-lg border border-brand/5 bg-white p-4 text-left shadow-[0_2px_8px_rgba(24,36,50,0.02)] transition hover:-translate-y-0.5 hover:border-brand/15 hover:shadow-[0_4px_12px_rgba(24,36,50,0.06)] focus:outline-none focus:ring-2 focus:ring-brand/20"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="font-semibold tracking-tight text-black">{applicant.name}</h4>
            <p className="mt-1 text-xs font-medium text-black/55">{applicant.role}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-black/55">{applicant.initials}</span>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-black/45">
          <span>{applicant.applied}</span>
          <span>{applicant.stage}</span>
        </div>
      </button>
      <ApplicantMoveButton applicant={applicant} />
    </li>
  )
}

function ApplicantMoveButton({ applicant }: { applicant: Applicant }) {
  const moveApplicant = useSetAtom(moveApplicantAtom)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const currentIndex = stages.indexOf(applicant.stage)
  const nextStage = stages[currentIndex + 1]

  if (!nextStage) return null

  const handleMove = async (event: MouseEvent<HTMLButtonElement>): Promise<void> => {
    event.stopPropagation()
    setIsSaving(true)
    setError(null)
    try {
      const updated = await patchApplicant(applicant.id, { stage: nextStage })
      moveApplicant({ id: updated.id, stage: updated.stage })
    } catch {
      setError('저장하지 못했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  return <span className="mt-4 block border-t border-brand/5 pt-3">
    <button type="button" onClick={handleMove} disabled={isSaving} className="font-semibold text-black/60 hover:text-black disabled:cursor-wait disabled:opacity-50">{isSaving ? '저장 중...' : `${nextStage}로 이동`}</button>
    {error && <span role="alert" className="ml-2 text-black/50">{error}</span>}
  </span>
}

function ApplicantDetails({ applicant, onClose }: { applicant: Applicant; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-brand/20 p-6" role="presentation" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="applicant-details-title" className="w-full max-w-md rounded-xl border border-brand/5 bg-white p-6 shadow-[0_12px_32px_rgba(24,36,50,0.12)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/45">Applicant details</p>
            <h2 id="applicant-details-title" className="mt-2 text-xl font-bold tracking-tight text-black">{applicant.name}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-sm text-black/50 hover:bg-slate-100 hover:text-black focus:outline-none focus:ring-2 focus:ring-brand/20" aria-label="상세보기 닫기">닫기</button>
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

export default function Board() {
  const setApplicants = useSetAtom(applicantsAtom)
  const [loading, setLoading] = useAtom(loadingAtom)
  const [error, setError] = useAtom(errorAtom)
  const [selectedApplicant, setSelectedApplicant] = useAtom(selectedApplicantAtom)
  const applicantsByStage = useAtomValue(applicantsByStageAtom)

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
      {selectedApplicant && <ApplicantDetails applicant={selectedApplicant} onClose={() => setSelectedApplicant(null)} />}
    </main>
  )
}
