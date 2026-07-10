import BCBox from '@/components/BCBox'
import { useTypewriter } from './useTypewriter'

interface TypewriterTextProps {
  text: string
  active?: boolean
  delay?: number
}

export const TypewriterText = ({
  text,
  active = true,
  delay = 18
}: TypewriterTextProps) => {
  const displayText = useTypewriter(active ? text : '', delay)

  if (!active) {
    return text
  }

  return (
    <>
      {displayText}
      {displayText !== text && (
        <BCBox
          component="span"
          sx={{
            display: 'inline-block',
            width: '0.55em',
            ml: 0.25,
            borderRight: '2px solid currentColor',
            animation: 'cursorBlink 0.8s steps(2, start) infinite',
            '@keyframes cursorBlink': {
              '0%, 45%': { opacity: 1 },
              '46%, 100%': { opacity: 0 }
            }
          }}
        >
          &nbsp;
        </BCBox>
      )}
    </>
  )
}
