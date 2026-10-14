declare module 'autosuggest-highlight/parse' {
  export interface ParsedMatch {
    text: string
    highlight: boolean
  }

  export default function parse(
    text: string,
    matches: Array<[number, number]>
  ): ParsedMatch[]
}

declare module 'autosuggest-highlight/match' {
  export default function match(
    text: string,
    query: string,
    options?: Record<string, unknown>
  ): Array<[number, number]>
}

declare module 'papaparse' {
  interface ParseResult<T> {
    data: T[]
    errors: { type: string; code: string; message: string; row?: number }[]
    meta: Record<string, unknown>
  }
  const Papa: {
    parse<T = Record<string, unknown>>(
      input: string | File,
      config?: {
        header?: boolean
        skipEmptyLines?: boolean | 'greedy'
        complete?: (results: ParseResult<T>) => void
        error?: (error: Error) => void
        [key: string]: unknown
      }
    ): ParseResult<T> | void
    unparse(data: readonly unknown[], options?: Record<string, unknown>): string
  }
  export default Papa
}

declare module 'lodash/startCase' {
  export default function startCase(value?: string): string
}

declare module 'lodash' {
  export function debounce<TArgs extends unknown[], TResult>(
    func: (...args: TArgs) => TResult,
    wait?: number
  ): (...args: TArgs) => void
}

declare module 'react-input-mask' {
  import type { ComponentType, InputHTMLAttributes, ReactNode } from 'react'

  interface InputMaskProps
    extends Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> {
    mask?: string | Array<string | RegExp>
    maskChar?: string | null
    formatChars?: Record<string, string>
    children?: (props: InputHTMLAttributes<HTMLInputElement>) => ReactNode
  }

  const InputMask: ComponentType<InputMaskProps>
  export default InputMask
}
