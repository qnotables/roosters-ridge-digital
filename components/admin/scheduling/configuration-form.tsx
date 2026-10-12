"use client";
import { useId, useState, type ReactNode } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { updateSchedulingConfiguration } from '@/app/admin/scheduling/actions'
import { validateConfiguration, type ConfigurationCommand } from '@/modules/scheduling/configuration'
export function ConfigField({name,label,value,type='text',hint,min,max}:{name:string;label:string;value:string|number;type?:string;hint?:string;min?:number;max?:number}) {
  const id=useId(); return <Field><FieldLabel htmlFor={id}>{label}</FieldLabel><Input id={id} name={name} type={type} defaultValue={value} min={min} max={max} step={type==='number'?1:undefined}/>{hint && <FieldDescription>{hint}</FieldDescription>}</Field>
}
export function ConfigCheck({name,label,value}:{name:string;label:string;value:boolean}) {const id=useId();return <Field orientation="horizontal"><input className="size-4 accent-primary" id={id} name={name} type="checkbox" defaultChecked={value}/><FieldLabel htmlFor={id}>{label}</FieldLabel></Field>}
export function ConfigurationForm({title,description,version,children,command,onSuccess}:{title:string;description:string;version:number;children:ReactNode;command:(data:FormData)=>ConfigurationCommand;onSuccess:()=>void}) {
  const [pending,setPending]=useState(false);const [result,setResult]=useState<{ok:boolean;message:string}|null>(null)
  return <form onSubmit={async event=>{event.preventDefault();const data=new FormData(event.currentTarget);setPending(true);setResult(null);try{const response=await updateSchedulingConfiguration(validateConfiguration(command(data)),version);setResult(response);if(response.ok)onSuccess()}catch(error){setResult({ok:false,message:error instanceof Error?error.message:'Could not save configuration.'})}finally{setPending(false)}}}><Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent><fieldset disabled={pending} className="flex min-w-0 flex-col gap-5">{children}</fieldset></CardContent><CardFooter className="flex flex-col items-start gap-3">{result && <Alert variant={result.ok?'default':'destructive'} role={result.ok?'status':'alert'}><AlertTitle>{result.ok?'Saved':'Review configuration'}</AlertTitle><AlertDescription>{result.message}</AlertDescription></Alert>}<Button disabled={pending} type="submit">{pending?'Saving…':'Save changes'}</Button></CardFooter></Card></form>
}
export const formText=(data:FormData,name:string)=>String(data.get(name)??'')
export const formNumber=(data:FormData,name:string)=>{const value=formText(data,name);return value.trim()?Number(value):NaN}
