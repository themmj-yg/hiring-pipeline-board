import { useEffect } from 'react'
import { atom, useAtom, useSetAtom } from 'jotai'
import { applicants, stages, type Applicant, type Stage } from '../applicants'
import { fetchApplicants, patchApplicant } from '../mock-api'

const applicantsAtom = atom<Applicant[]>(applicants)
const queryAtom = atom('')
const filteredApplicantsAtom = atom((get) => {
  const query = get(queryAtom).trim().toLowerCase()
  const list = get(applicantsAtom)
  return query ? list.filter((applicant) => `${applicant.name} ${applicant.role}`.toLowerCase().includes(query)) : list
})

const moveApplicantAtom = atom(null, (get, set, update: { id: string; stage: Stage }) => {
  set(applicantsAtom, get(applicantsAtom).map((applicant) => applicant.id === update.id ? { ...applicant, stage: update.stage } : applicant))
})

const stageColors: Record<Stage, string> = {
  Applied: 'bg-slate-100 text-black',
  Screening: 'bg-slate-100 text-black',
  Interview: 'bg-slate-100 text-black',
  Offer: 'bg-slate-100 text-black',
}

function ApplicantCard({ applicant }: { applicant: Applicant }) {
  const moveApplicant = useSetAtom(moveApplicantAtom)
  const nextStage = stages[(stages.indexOf(applicant.stage) + 1) % stages.length]

  const handleMove = async (): Promise<void> => {
    const updated = await patchApplicant(applicant.id, { stage: nextStage })
    moveApplicant({ id: updated.id, stage: updated.stage })
  }

  return (
    <article className="group rounded-xl border border-brand/5 bg-white p-4 shadow-[0_3px_12px_rgba(0,0,0,0.04)] transition hover:-translate-y-0.5 hover:border-brand/15 hover:shadow-[0_8px_22px_rgba(0,0,0,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="!bg-slate-100 flex size-10 items-center justify-center rounded-full text-sm font-bold text-black" style={{ backgroundColor: applicant.accent }}>{applicant.initials}</div>
          <div>
            <h3 className="font-semibold text-black">{applicant.name}</h3>
            <p className="mt-0.5 text-xs text-black/50">{applicant.role}</p>
          </div>
        </div>
        <button className="rounded-md p-1 text-lg leading-none text-black/40 opacity-0 transition group-hover:opacity-100 hover:bg-slate-100" aria-label={`More actions for ${applicant.name}`}>...</button>
      </div>
      <p className="mt-4 text-xs text-black/60">{applicant.location}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {applicant.tags.map((tag) => <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-black/60" key={tag}>{tag}</span>)}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-brand/5 pt-3">
        <span className="text-[11px] text-black/40">Applied {applicant.applied}</span>
        <button type="button" onClick={() => void handleMove()} className="text-[11px] font-semibold text-black opacity-0 transition group-hover:opacity-100 hover:text-black/60">Move to {nextStage} &rarr;</button>
      </div>
    </article>
  )
}

export default function Board() {
  const [query, setQuery] = useAtom(queryAtom)
  const [visibleApplicants] = useAtom(filteredApplicantsAtom)
  const setApplicants = useSetAtom(applicantsAtom)
  const total = visibleApplicants.length

  useEffect(() => {
    void fetchApplicants().then(setApplicants).catch(() => undefined)
  }, [setApplicants])

  return (
    <main className="min-h-screen bg-slate-50/60 text-black">
      <header className="border-b border-brand/5 bg-white/90 px-6 py-5 backdrop-blur sm:px-10">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4"><div className="flex size-10 items-center justify-center rounded-xl border border-brand/10 bg-white text-xl font-bold text-black shadow-sm">H</div><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-black">Hiring pipeline</p><h1 className="mt-1 text-2xl font-bold tracking-[-0.03em]">Candidate workspace</h1></div></div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><label className="relative"><span className="sr-only">Search candidates</span><span className="pointer-events-none absolute left-3 top-2.5 text-black/40">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search candidates" className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-black outline-none transition placeholder:text-black/40 focus:border-brand focus:ring-2 focus:ring-brand/10 sm:w-64" /></label><button type="button" onClick={() => setApplicants(applicants)} className="h-10 rounded-lg border border-brand/10 bg-white px-4 text-sm font-semibold text-black shadow-sm transition hover:bg-slate-50">+ Add candidate</button></div>
        </div>
      </header>
      <section className="mx-auto max-w-[1440px] px-6 py-8 sm:px-10"><div className="mb-7 flex items-end justify-between"><div><p className="text-sm font-medium text-black/50">Overview / June 2024</p><h2 className="mt-1 text-3xl font-bold tracking-[-0.04em]">Open roles <span className="ml-2 align-middle rounded-full bg-slate-100 px-2.5 py-1 text-sm font-semibold text-black">{total}</span></h2></div><button className="hidden rounded-lg border border-brand/5 bg-white px-3 py-2 text-sm font-medium text-black hover:bg-slate-50 sm:block">Filter & sort</button></div>
        <div className="grid gap-5 xl:grid-cols-4">{stages.map((stage) => { const stageApplicants = visibleApplicants.filter((applicant) => applicant.stage === stage); return <section key={stage} className="min-w-0"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><span className={`size-2 rounded-full ${stage === 'Applied' ? 'bg-black/40' : stage === 'Screening' ? 'bg-black/50' : stage === 'Interview' ? 'bg-black/60' : 'bg-black/70'}`} /><h3 className="text-sm font-bold text-black">{stage}</h3><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${stageColors[stage]}`}>{stageApplicants.length}</span></div><button className="text-xl leading-none text-black/40 hover:text-black" aria-label={`Add candidate to ${stage}`}>+</button></div><div className="space-y-3">{stageApplicants.map((applicant) => <ApplicantCard applicant={applicant} key={applicant.id} />)}{stageApplicants.length === 0 && <div className="rounded-xl border border-dashed border-brand/10 p-6 text-center text-xs text-black/40">No candidates match</div>}</div></section> })}</div>
      </section>
    </main>
  )
}
