import { SchedulingError } from './types'
import { brandUrl, brandingText } from './branding'
export const intakeKinds = ['short_text', 'long_text', 'email', 'telephone', 'dropdown', 'multiple_choice', 'checkbox', 'url'] as const
export type IntakeQuestion = { id: string; label: string; kind: typeof intakeKinds[number]; required: boolean; options: string[] }
export type IntakeAnswer = { question: IntakeQuestion; answer: string | boolean }
const invalid = (): never => { throw new SchedulingError('invalid', 'Review the intake questions and answers. Do not include sensitive personal information.') }
export function validateQuestions(input: unknown): IntakeQuestion[] {
  if (!Array.isArray(input) || input.length > 10) return invalid()
  const ids = new Set<string>()
  return input.map((raw, index) => {
    const q = typeof raw === 'string' ? { id: `legacy-${index}`, label: raw, kind: 'short_text' as const, required: false, options: [] } : raw as IntakeQuestion
    if (!q || !/^[a-zA-Z0-9_-]{1,64}$/.test(q.id) || ids.has(q.id) || !intakeKinds.includes(q.kind) || typeof q.required !== 'boolean' || q.kind === 'url' && q.required || !Array.isArray(q.options) || q.options.length > 20) return invalid()
    ids.add(q.id)
    const options = q.options.map((value: unknown) => brandingText(value, 120, true))
    if (new Set(options).size !== options.length || ['dropdown', 'multiple_choice'].includes(q.kind) && options.length < 2 || !['dropdown', 'multiple_choice'].includes(q.kind) && options.length) return invalid()
    return { id: q.id, label: brandingText(q.label, 200, true), kind: q.kind, required: q.required, options }
  })
}
export function validateAnswers(questions: IntakeQuestion[], raw: unknown): IntakeAnswer[] {
  const input = (raw ?? {}) as Record<string, unknown>
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !questions.some(q => q.id === key))) return invalid()
  return questions.map(question => {
    const value = input[question.id]
    if (question.kind === 'checkbox') { if (value !== undefined && typeof value !== 'boolean' || question.required && value !== true) return invalid(); return { question, answer: value === true } }
    const answer = brandingText(value ?? '', question.kind === 'long_text' ? 2000 : 500, question.required)
    if (answer && (question.kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer) || question.kind === 'telephone' && !/^[+\d\s().-]{7,40}$/.test(answer) || ['dropdown', 'multiple_choice'].includes(question.kind) && !question.options.includes(answer))) return invalid()
    if (answer && question.kind === 'url') brandUrl(answer)
    return { question, answer }
  })
}
