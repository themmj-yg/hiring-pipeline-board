import type { Stage } from '../applicants'

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

export default function Board() {
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
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {boardColumns.map(({ stage, label, description }) => (
            <section
              key={stage}
              role="region"
              aria-label={label}
              className="min-h-96 rounded-xl border border-brand/5 bg-white p-6 shadow-[0_4px_12px_rgba(24,36,50,0.02)]"
            >
              <div className="flex items-start justify-between gap-4 border-b border-brand/5 pb-5">
                <div>
                  <h3 className="text-base font-semibold tracking-tight text-black">{label}</h3>
                  <p className="mt-1 text-xs font-medium text-black/50">{description}</p>
                </div>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-black/50" aria-label="지원자 수">0</span>
              </div>
              <div className="flex min-h-64 items-center justify-center text-center text-sm text-black/40">
                <p>아직 지원자가 없습니다.</p>
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  )
}
