import { applicants, stages, type Applicant, type Stage } from '../applicants'

const STORAGE_KEY = 'hiring-pipeline-board:applicants'
const MIN_DELAY_MS = 200
const MAX_DELAY_MS = 800
const WRITE_FAILURE_RATE = 0.15

type ApplicantPatch = Partial<Pick<Applicant, 'name' | 'role' | 'location' | 'stage' | 'applied' | 'tags'>>

const cloneApplicants = (items: Applicant[]): Applicant[] => items.map((applicant) => ({ ...applicant, tags: [...applicant.tags] }))

const wait = async (): Promise<void> => {
  const delay = MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1))
  await new Promise<void>((resolve) => window.setTimeout(resolve, delay))
}

const readStoredApplicants = (): Applicant[] => {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (!stored) return cloneApplicants(applicants)

  try {
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed) || parsed.length !== 200) return cloneApplicants(applicants)
    return cloneApplicants(parsed.filter((item): item is Applicant => isApplicant(item)))
  } catch {
    return cloneApplicants(applicants)
  }
}

const isApplicant = (value: unknown): value is Applicant => {
  if (!value || typeof value !== 'object') return false
  const applicant = value as Record<string, unknown>
  return typeof applicant.id === 'string'
    && typeof applicant.name === 'string'
    && typeof applicant.role === 'string'
    && typeof applicant.location === 'string'
    && stages.includes(applicant.stage as Stage)
    && typeof applicant.initials === 'string'
    && typeof applicant.accent === 'string'
    && typeof applicant.applied === 'string'
    && typeof applicant.updatedAt === 'number'
    && Array.isArray(applicant.tags)
    && applicant.tags.every((tag): tag is string => typeof tag === 'string')
}

const writeApplicants = (items: Applicant[]): void => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export const fetchApplicants = async (): Promise<Applicant[]> => {
  await wait()
  const items = readStoredApplicants()
  writeApplicants(items)
  return cloneApplicants(items)
}

export const patchApplicant = async (id: string, patch: ApplicantPatch): Promise<Applicant> => {
  await wait()
  if (Math.random() < WRITE_FAILURE_RATE) throw new Error('Mock API write failed')

  const items = readStoredApplicants()
  const index = items.findIndex((applicant) => applicant.id === id)
  if (index < 0) throw new Error(`Applicant not found: ${id}`)

  const updated = { ...items[index], ...patch, ...(patch.stage ? { updatedAt: Date.now() } : {}) }
  items[index] = updated
  writeApplicants(items)
  return { ...updated, tags: [...updated.tags] }
}
