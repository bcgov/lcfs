declare module '*.svg' {
  const content: string
  export default content
}

declare module 'country-list' {
  export function getCode(name: string): string | undefined
  export function getName(code: string): string | undefined
  export function getNames(): string[]
  export function getCodes(): string[]
  export function getNameList(): Record<string, string>
  export function getCodeList(): Record<string, string>
  export function overwrite(
    entries: Array<{ code: string; name: string }>
  ): void
}
