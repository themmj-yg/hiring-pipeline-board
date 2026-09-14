export type Stage = 'Applied' | 'Screening' | 'Interview' | 'Offer'

export type Applicant = {
  id: string
  name: string
  role: string
  location: string
  stage: Stage
  initials: string
  accent: string
  applied: string
  tags: string[]
}

export const stages: Stage[] = ['Applied', 'Screening', 'Interview', 'Offer']

export const applicants: Applicant[] = [
  { id: 'ava', name: 'Ava Rodriguez', role: 'Product Designer', location: 'New York, NY', stage: 'Applied', initials: 'AR', accent: '#e9d5ff', applied: '2h ago', tags: ['Figma', 'Systems'] },
  { id: 'liam', name: 'Liam Chen', role: 'Frontend Engineer', location: 'Austin, TX', stage: 'Applied', initials: 'LC', accent: '#bfdbfe', applied: '5h ago', tags: ['React', 'TypeScript'] },
  { id: 'sophia', name: 'Sophia Patel', role: 'Product Manager', location: 'San Francisco, CA', stage: 'Screening', initials: 'SP', accent: '#fecdd3', applied: 'Yesterday', tags: ['B2B', 'Growth'] },
  { id: 'noah', name: 'Noah Williams', role: 'Frontend Engineer', location: 'Seattle, WA', stage: 'Screening', initials: 'NW', accent: '#bbf7d0', applied: 'Yesterday', tags: ['React', 'GraphQL'] },
  { id: 'mia', name: 'Mia Thompson', role: 'Product Designer', location: 'Chicago, IL', stage: 'Interview', initials: 'MT', accent: '#fed7aa', applied: 'Mon, Jun 17', tags: ['Research', 'Figma'] },
  { id: 'ethan', name: 'Ethan Brown', role: 'Frontend Engineer', location: 'Boston, MA', stage: 'Offer', initials: 'EB', accent: '#fde68a', applied: 'Mon, Jun 17', tags: ['React', 'Testing'] },
]
