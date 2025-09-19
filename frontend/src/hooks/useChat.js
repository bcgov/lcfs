import { useState, useCallback, useRef } from 'react'
import { useKeycloak } from '@react-keycloak/web'
import { useSnackbar } from 'notistack'
import { CONFIG } from '@/constants/config'

export const useChat = () => {
  const [messages, setMessages] = useState([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState(null)
  const { keycloak } = useKeycloak()
  const { enqueueSnackbar } = useSnackbar()
  const abortControllerRef = useRef(null)

  const addMessage = useCallback((message) => {
    setMessages(prev => [...prev, message])
  }, [])

  const updateLastMessage = useCallback((content) => {
    setMessages(prev => {
      const newMessages = [...prev]
      const lastMessage = newMessages[newMessages.length - 1]
      if (lastMessage && lastMessage.role === 'assistant') {
        lastMessage.content = content
      }
      return newMessages
    })
  }, [])

  const streamChat = useCallback(async (userMessage) => {
    if (!keycloak.authenticated) {
      enqueueSnackbar('Please log in to use the chat feature', { variant: 'error' })
      return
    }

    setError(null)
    setIsStreaming(true)

    // Add user message
    const userMsg = { role: 'user', content: userMessage }
    addMessage(userMsg)

    // Add placeholder assistant message
    const assistantMsg = { role: 'assistant', content: '' }
    addMessage(assistantMsg)

    // Create abort controller for this request
    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch(`${CONFIG.API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${keycloak.token}`,
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          model: 'lcfs-rag',
          temperature: 0.7,
          max_tokens: 500,
          stream: true
        }),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(line => line.trim() !== '')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)

            if (data === '[DONE]') {
              setIsStreaming(false)
              return
            }

            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content

              if (content) {
                assistantContent += content
                updateLastMessage(assistantContent)
              }

              // Check for finish reason
              if (parsed.choices?.[0]?.finish_reason) {
                setIsStreaming(false)
                return
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE data:', data, parseError)
            }
          }
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        // Stream was intentionally stopped
        setIsStreaming(false)
        return
      }

      console.error('Chat stream error:', error)
      setError(error.message || 'Failed to get response')
      enqueueSnackbar('Failed to get response from chat service', { variant: 'error' })

      // Remove the empty assistant message on error
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setIsStreaming(false)
      abortControllerRef.current = null
    }
  }, [messages, keycloak, addMessage, updateLastMessage, enqueueSnackbar])

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsStreaming(false)
    }
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  const sendMessage = useCallback(async (content) => {
    if (!content.trim() || isStreaming) return
    await streamChat(content.trim())
  }, [streamChat, isStreaming])

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearMessages,
    addMessage
  }
}