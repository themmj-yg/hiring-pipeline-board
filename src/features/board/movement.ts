import type { Applicant, Stage } from '../applicants'

export const moveApplicantToStage = (items: Applicant[], id: string, stage: Stage): Applicant[] =>
  items.map((applicant) => applicant.id === id ? { ...applicant, stage } : applicant)
