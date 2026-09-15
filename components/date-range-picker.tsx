'use client'

import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import type { DateRange } from 'react-day-picker'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Field, FieldLabel } from '@/components/ui/field'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface DateRangePickerProps {
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
  label?: string
  className?: string
}

export function DateRangePicker({ value, onChange, label = 'Date range', className }: DateRangePickerProps) {
  return (
    <Field className={cn('w-auto', className)}>
      <FieldLabel htmlFor="date-range-picker">{label}</FieldLabel>
      <Popover>
        <PopoverTrigger
          render={
            <Button variant="outline" id="date-range-picker" className="w-64 justify-start px-2.5 font-normal">
              <CalendarIcon data-icon="inline-start" />
              {value?.from ? (
                value.to ? (
                  <>
                    {format(value.from, 'LLL dd, y')} – {format(value.to, 'LLL dd, y')}
                  </>
                ) : (
                  format(value.from, 'LLL dd, y')
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="range" defaultMonth={value?.from} selected={value} onSelect={onChange} numberOfMonths={2} />
        </PopoverContent>
      </Popover>
    </Field>
  )
}
