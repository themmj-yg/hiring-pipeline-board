import { atom, useAtom, useSetAtom } from 'jotai'
import { applicants, stages, type Applicant, type Stage } from '../applicants'

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
  Applied: 'bg-[#e7eef9] text-[#31527c]',
  Screening: 'bg-[#f9ecd2] text-[#8f651d]',
  Interview: 'bg-[#e6f1e8] text-[#356445]',
  Offer: 'bg-[#f1e8f7] text-[#75458b]',
}

function ApplicantCard({ applicant }: { applicant: Applicant }) {
  const moveApplicant = useSetAtom(moveApplicantAtom)
  const nextStage = stages[(stages.indexOf(applicant.stage) + 1) % stages.length]

  return (
    <article className="group rounded-xl border border-[#e6e1d9] bg-white p-4 shadow-[0_3px_12px_rgba(54,45,33,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(54,45,33,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full text-sm font-bold text-[#564c42]" style={{ backgroundColor: applicant.accent }}>{applicant.initials}</div>
          <div>
            <h3 className="font-semibold text-[#2f2a25]">{applicant.name}</h3>
            <p className="mt-0.5 text-xs text-[#8b8176]">{applicant.role}</p>
          </div>
        </div>
        <button className="rounded-md p-1 text-lg leading-none text-[#a79b8d] opacity-0 transition group-hover:opacity-100 hover:bg-[#f5f1eb]" aria-label={`More actions for ${applicant.name}`}>...</button>
      </div>
      <p className="mt-4 text-xs text-[#74695e]">{applicant.location}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {applicant.tags.map((tag) => <span className="rounded-md bg-[#f5f2ed] px-2 py-1 text-[11px] font-medium text-[#766b60]" key={tag}>{tag}</span>)}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-[#f0ece6] pt-3">
        <span className="text-[11px] text-[#a1978c]">Applied {applicant.applied}</span>
        <button type="button" onClick={() => moveApplicant({ id: applicant.id, stage: nextStage })} className="text-[11px] font-semibold text-[#a05a43] opacity-0 transition group-hover:opacity-100 hover:text-[#713b2b]">Move to {nextStage} &rarr;</button>
      </div>
    </article>
  )
}

export default function Board() {
  const [query, setQuery] = useAtom(queryAtom)
  const [visibleApplicants] = useAtom(filteredApplicantsAtom)
  const setApplicants = useSetAtom(applicantsAtom)
  const total = visibleApplicants.length

  return (
    <main className="min-h-screen bg-[#f4f0e9] text-[#2f2a25]">
      <header className="border-b border-[#e4ded4] bg-[#f8f5f0]/90 px-6 py-5 backdrop-blur sm:px-10">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4"><div className="flex size-10 items-center justify-center rounded-xl bg-[#a05a43] text-xl font-bold text-white shadow-sm">H</div><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#a05a43]">Hiring pipeline</p><h1 className="mt-1 text-2xl font-bold tracking-[-0.03em]">Candidate workspace</h1></div></div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><label className="relative"><span className="sr-only">Search candidates</span><span className="pointer-events-none absolute left-3 top-2.5 text-[#9b9185]">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search candidates" className="h-10 w-full rounded-lg border border-[#ded7cd] bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-[#ada49a] focus:border-[#a05a43] focus:ring-2 focus:ring-[#a05a43]/15 sm:w-64" /></label><button type="button" onClick={() => setApplicants(applicants)} className="h-10 rounded-lg bg-[#a05a43] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#874835]">+ Add candidate</button></div>
        </div>
      </header>
      <section className="mx-auto max-w-[1440px] px-6 py-8 sm:px-10"><div className="mb-7 flex items-end justify-between"><div><p className="text-sm font-medium text-[#94897d]">Overview / June 2024</p><h2 className="mt-1 text-3xl font-bold tracking-[-0.04em]">Open roles <span className="ml-2 align-middle rounded-full bg-[#e7ded3] px-2.5 py-1 text-sm font-semibold text-[#8d5b43]">{total}</span></h2></div><button className="hidden rounded-lg border border-[#ddd6cc] bg-[#fbf9f6] px-3 py-2 text-sm font-medium text-[#72685e] hover:bg-white sm:block">Filter & sort</button></div>
        <div className="grid gap-5 xl:grid-cols-4">{stages.map((stage) => { const stageApplicants = visibleApplicants.filter((applicant) => applicant.stage === stage); return <section key={stage} className="min-w-0"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><span className={`size-2 rounded-full ${stage === 'Applied' ? 'bg-[#6689b8]' : stage === 'Screening' ? 'bg-[#d6a444]' : stage === 'Interview' ? 'bg-[#73a77d]' : 'bg-[#9a69ae]'}`} /><h3 className="text-sm font-bold text-[#544b42]">{stage}</h3><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${stageColors[stage]}`}>{stageApplicants.length}</span></div><button className="text-xl leading-none text-[#a99e92] hover:text-[#6b5d50]" aria-label={`Add candidate to ${stage}`}>+</button></div><div className="space-y-3">{stageApplicants.map((applicant) => <ApplicantCard applicant={applicant} key={applicant.id} />)}{stageApplicants.length === 0 && <div className="rounded-xl border border-dashed border-[#d8d0c5] p-6 text-center text-xs text-[#a1988d]">No candidates match</div>}</div></section> })}</div>
      </section>
    </main>
  )
}
