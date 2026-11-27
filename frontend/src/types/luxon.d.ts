declare module 'luxon' {
  interface DateTimeValue {
    valueOf(): number
    plus(duration: { days?: number }): DateTimeValue
    diffNow(unit: 'days'): { days: number }
    toLocaleString(format: number): string
  }

  export const DateTime: {
    now(): DateTimeValue
    fromObject(values: {
      year: number
      month: number
      day: number
    }): DateTimeValue
    fromISO(value: string): DateTimeValue
    DATE_FULL: number
  }
}
