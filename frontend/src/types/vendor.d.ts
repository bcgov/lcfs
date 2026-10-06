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
    options?: Record<string, any>
  ): Array<[number, number]>
}

declare module 'papaparse' {
  const Papa: any
  export default Papa
}

declare module 'lodash/startCase' {
  export default function startCase(value?: string): string
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
