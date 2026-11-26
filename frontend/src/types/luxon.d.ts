declare module 'luxon' {
  interface DateTimeValue {
    valueOf(): number
  }

  export const DateTime: {
    now(): DateTimeValue
    fromObject(values: {
      year: number
      month: number
      day: number
    }): DateTimeValue
  }
}
