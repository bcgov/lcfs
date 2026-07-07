import { useEffect, useState } from 'react'

export const useTypewriter = (text: string, delay = 18) => {
  const [displayText, setDisplayText] = useState('')

  useEffect(() => {
    if (!text) {
      setDisplayText('')
      return undefined
    }

    let index = 0
    setDisplayText('')
    const interval = window.setInterval(() => {
      index = Math.min(index + 2, text.length)
      setDisplayText(text.slice(0, index))
      if (index >= text.length) {
        window.clearInterval(interval)
      }
    }, delay)

    return () => window.clearInterval(interval)
  }, [text, delay])

  return displayText
}
