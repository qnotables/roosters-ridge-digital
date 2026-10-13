'use client'
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldSet, FieldLegend } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { IntakeQuestion } from '../intake'
export function IntakeFields({ questions, answers, onChange }: { questions: IntakeQuestion[]; answers: Record<string, string | boolean>; onChange: (answers: Record<string, string | boolean>) => void }) {
  return <FieldGroup>{questions.map(q => {
    const id = `intake-${q.id}`, change = (value: string | boolean) => onChange({ ...answers, [q.id]: value }), value = typeof answers[q.id] === 'string' ? String(answers[q.id]) : ''
    if (q.kind === 'multiple_choice') return <FieldSet key={q.id}><FieldLegend>{q.label}{q.required ? ' *' : ' (optional)'}</FieldLegend>{q.options.map(option => <Field key={option} orientation="horizontal"><input id={`${id}-${q.options.indexOf(option)}`} type="radio" name={id} required={q.required} checked={value === option} onChange={() => change(option)} className="size-5 accent-primary" /><FieldLabel htmlFor={`${id}-${q.options.indexOf(option)}`}>{option}</FieldLabel></Field>)}</FieldSet>
    return <Field key={q.id}><FieldLabel htmlFor={id}>{q.label}{q.required ? ' *' : ' (optional)'}</FieldLabel>{q.kind === 'checkbox' ? <input id={id} type="checkbox" required={q.required} checked={answers[q.id] === true} onChange={e => change(e.target.checked)} className="size-5 accent-primary" /> : q.kind === 'dropdown' ? <select id={id} required={q.required} value={value} onChange={e => change(e.target.value)} className="min-h-11 rounded-md border border-input bg-background p-3"><option value="">Select an option</option>{q.options.map(option => <option key={option}>{option}</option>)}</select> : q.kind === 'long_text' ? <Textarea id={id} required={q.required} maxLength={2000} value={value} onChange={e => change(e.target.value)} /> : <Input id={id} type={q.kind === 'telephone' ? 'tel' : q.kind === 'email' ? 'email' : q.kind === 'url' ? 'url' : 'text'} required={q.required} maxLength={500} value={value} onChange={e => change(e.target.value)} />}{q.kind === 'long_text' && <FieldDescription>Do not include medical, financial, password or other sensitive information.</FieldDescription>}</Field>
  })}</FieldGroup>
}
