import { useState, useEffect, useRef, useCallback } from 'react'

export const useVoice = () => {
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState(null)
  const [isSupported, setIsSupported] = useState(true)
  const [confidence, setConfidence] = useState(0)

  const recognitionRef = useRef(null)
  const synthesisRef = useRef(null)
  const silenceTimerRef = useRef(null)

  // Initialize speech recognition and synthesis
  useEffect(() => {
    // Check for Speech Recognition support
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setIsSupported(false)
      setError('Speech recognition is not supported in this browser')
      return
    }

    // Initialize recognition with professional settings
    const recognition = new SpeechRecognition()
    recognition.continuous = true // Keep listening
    recognition.interimResults = true // Show real-time results
    recognition.lang = 'en-US'
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setIsListening(true)
      setError(null)
      setTranscript('')
      setInterimTranscript('')
      setConfidence(0)
    }

    recognition.onresult = (event) => {
      let interimText = ''
      let finalText = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcriptPart = result[0].transcript

        if (result.isFinal) {
          finalText += transcriptPart + ' '
          setConfidence(result[0].confidence)

          // Auto-stop after getting final result (professional UX)
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current)
          }
          silenceTimerRef.current = setTimeout(() => {
            if (recognitionRef.current) {
              recognition.stop()
            }
          }, 1500) // Stop after 1.5 seconds of silence
        } else {
          interimText += transcriptPart
        }
      }

      if (finalText) {
        setTranscript((prev) => (prev + finalText).trim())
      }
      setInterimTranscript(interimText)
    }

    recognition.onerror = (event) => {
      // Only show user-friendly errors
      if (event.error === 'no-speech') {
        setError('No speech detected. Please try again.')
      } else if (event.error === 'audio-capture') {
        setError('Microphone not available')
      } else if (event.error === 'not-allowed') {
        setError('Microphone permission denied')
      }
      setIsListening(false)
      setInterimTranscript('')
    }

    recognition.onend = () => {
      setIsListening(false)
      setInterimTranscript('')
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current)
      }
    }

    recognitionRef.current = recognition

    // Check for Speech Synthesis support
    if (!window.speechSynthesis) {
      setError('Text-to-speech is not supported in this browser')
    } else {
      synthesisRef.current = window.speechSynthesis
    }

    // Cleanup
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if (synthesisRef.current) {
        synthesisRef.current.cancel()
      }
    }
  }, [])

  // Start listening
  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return

    setTranscript('')
    setError(null)

    try {
      recognitionRef.current.start()
    } catch (err) {
      setError('Failed to start speech recognition')
      console.error(err)
    }
  }, [isListening])

  // Stop listening
  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListening) return

    try {
      recognitionRef.current.stop()
    } catch (err) {
      console.error(err)
    }
  }, [isListening])

  // Speak text with natural voice selection
  const speak = useCallback((text) => {
    if (!synthesisRef.current) {
      setError('Text-to-speech is not available')
      return
    }

    // Cancel any ongoing speech
    synthesisRef.current.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.95 // Slightly slower for clarity
    utterance.pitch = 1.0
    utterance.volume = 1.0

    // Select the most natural voice available (prefer neural/premium voices)
    const voices = synthesisRef.current.getVoices()
    const preferredVoice =
      voices.find((v) => v.lang === 'en-US' && v.name.includes('Premium')) ||
      voices.find((v) => v.lang === 'en-US' && v.name.includes('Enhanced')) ||
      voices.find((v) => v.lang === 'en-US' && v.name.includes('Natural')) ||
      voices.find((v) => v.lang === 'en-US' && v.name.includes('Google')) ||
      voices.find((v) => v.lang === 'en-US')

    if (preferredVoice) {
      utterance.voice = preferredVoice
    }

    utterance.onstart = () => {
      setIsSpeaking(true)
      setError(null)
    }

    utterance.onend = () => {
      setIsSpeaking(false)
    }

    utterance.onerror = (event) => {
      // Silently handle interruption (not an error)
      if (event.error !== 'interrupted' && event.error !== 'cancelled') {
        setError('Unable to play audio')
      }
      setIsSpeaking(false)
    }

    try {
      synthesisRef.current.speak(utterance)
    } catch (err) {
      setError('Failed to speak text')
      console.error(err)
      setIsSpeaking(false)
    }
  }, [])

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    if (!synthesisRef.current) return

    try {
      synthesisRef.current.cancel()
      setIsSpeaking(false)
    } catch (err) {
      console.error(err)
    }
  }, [])

  return {
    // State
    isListening,
    isSpeaking,
    transcript,
    interimTranscript,
    confidence,
    error,
    isSupported,

    // Methods
    startListening,
    stopListening,
    speak,
    stopSpeaking
  }
}
