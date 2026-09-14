export type Stage = 'Applied' | 'Screening' | 'Interview' | 'Offer'
export type FinalOutcome = 'passed' | 'failed' | null

export type Applicant = {
  id: string
  name: string
  role: string
  location: string
  stage: Stage
  initials: string
  accent: string
  applied: string
  updatedAt: number
  finalOutcome: FinalOutcome
  tags: string[]
}

export const stages: Stage[] = ['Applied', 'Screening', 'Interview', 'Offer']

const firstNames = ['Ava', 'Liam', 'Sophia', 'Noah', 'Mia', 'Ethan', 'Olivia', 'Lucas', 'Emma', 'Mateo']
const lastNames = ['Rodriguez', 'Chen', 'Patel', 'Williams', 'Thompson', 'Brown', 'Garcia', 'Wilson', 'Kim', 'Davis']
const roles = ['Product Designer', 'Frontend Engineer', 'Product Manager', 'UX Researcher']
const locations = ['New York, NY', 'Austin, TX', 'San Francisco, CA', 'Seattle, WA', 'Chicago, IL', 'Boston, MA']
const featuredNames = ['Ava Rodriguez', 'Liam Chen', 'Sophia Patel', 'Noah Williams', 'Mia Thompson', 'Ethan Brown']
const featuredRoles = ['Product Designer', 'Frontend Engineer', 'Product Manager', 'Frontend Engineer', 'Product Designer', 'Frontend Engineer']

export const applicants: Applicant[] = Array.from({ length: 200 }, (_, index) => {
  const name = featuredNames[index] ?? `${firstNames[index % firstNames.length]} ${lastNames[Math.floor(index / firstNames.length) % lastNames.length]} ${index + 1}`
  const role = featuredRoles[index] ?? roles[index % roles.length]
  const initials = name.split(' ').map((part) => part[0]).join('')
  return {
    id: `applicant-${index + 1}`,
    name,
    role,
    location: locations[index % locations.length],
    stage: stages[index % stages.length],
    initials,
    accent: '#f1f5f9',
    applied: `${(index % 28) + 1} days ago`,
    updatedAt: Date.now() - index * 60_000,
    finalOutcome: stages[index % stages.length] === 'Offer' ? (index % 2 === 0 ? 'passed' : 'failed') : null,
    tags: role === 'Frontend Engineer' ? ['React', 'TypeScript'] : role === 'Product Designer' ? ['Figma', 'Systems'] : role === 'Product Manager' ? ['B2B', 'Growth'] : ['Research', 'UX'],
  }
})
