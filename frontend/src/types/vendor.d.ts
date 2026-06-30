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
