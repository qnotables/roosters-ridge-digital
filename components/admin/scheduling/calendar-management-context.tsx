'use client'
import { createContext,useContext } from 'react'
import { manageScheduling } from '@/app/admin/scheduling/actions'
export const CalendarManagementContext=createContext<typeof manageScheduling>(manageScheduling)
export function useCalendarManagement() { return useContext(CalendarManagementContext) }
