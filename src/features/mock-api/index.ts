import { applicants, type Applicant } from '../applicants'

export const fetchApplicants = async (): Promise<Applicant[]> => {
  await Promise.resolve()
  return applicants.map((applicant) => ({ ...applicant, tags: [...applicant.tags] }))
}
