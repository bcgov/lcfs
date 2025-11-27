import { useState, useCallback } from 'react'
import { useKeycloak } from '@react-keycloak/web'
import { CONFIG } from '@/constants/config'

export const useChatAssistant = () => {
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const { keycloak } = useKeycloak()

  /**
   * Send a message to the chat assistant
   */
  const sendMessage = useCallback(
    async (content) => {
      if (!content.trim()) return

      // Add user message to local state with unique ID
      const userMessage = {
        role: 'user',
        content: content.trim(),
        id: Date.now() + Math.random() // Simple unique ID
      }

      setMessages((prev) => [...prev, userMessage])
      setIsLoading(true)
      setError(null)

      try {
        // Send full conversation history to backend
        const conversationMessages = [...messages, userMessage]

        // Use streaming endpoint
        const response = await fetch(`${CONFIG.API_BASE}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${keycloak.token}`
          },
          body: JSON.stringify({
            messages: conversationMessages,
            model: 'lcfs-rag',
            stream: true
          })
        })

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`)
        }

        // Handle streaming response
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let assistantMessage = {
          role: 'assistant',
          content: '',
          id: Date.now() + Math.random() // Unique ID for assistant message
        }

        // Add empty assistant message that we'll update
        setMessages((prev) => [...prev, assistantMessage])

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') break

              try {
                const parsed = JSON.parse(data)
                const content = parsed.choices[0]?.delta?.content

                if (content) {
                  assistantMessage.content += content
                  // Update the last message
                  setMessages((prev) => {
                    const newMessages = [...prev]
                    newMessages[newMessages.length - 1] = {
                      ...assistantMessage
                    }
                    return newMessages
                  })
                }
              } catch (e) {
                // Skip invalid JSON
                console.debug('Failed to parse chunk:', e)
              }
            }
          }
        }
      } catch (err) {
        console.error('Chat error:', err)
        setError(err.message || 'Failed to send message. Please try again.')

        // Remove the failed assistant message if it exists
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1]
          if (lastMsg?.role === 'assistant' && !lastMsg.content) {
            return prev.slice(0, -1)
          }
          return prev
        })
      } finally {
        setIsLoading(false)
      }
    },
    [messages, keycloak.token]
  )

  /**
   * Edit a user message and optionally resend
   */
  const editMessage = useCallback(
    async (messageId, newContent) => {
      if (!newContent.trim()) return

      // Find the message index
      const messageIndex = messages.findIndex((m) => m.id === messageId)
      if (messageIndex === -1) return

      // Update the message and remove all messages after it
      const updatedMessages = messages.slice(0, messageIndex + 1)
      updatedMessages[messageIndex] = {
        ...updatedMessages[messageIndex],
        content: newContent.trim()
      }

      setMessages(updatedMessages)
      setIsLoading(true)
      setError(null)

      try {
        // Resend to get new assistant response
        const response = await fetch(`${CONFIG.API_BASE}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${keycloak.token}`
          },
          body: JSON.stringify({
            messages: updatedMessages,
            model: 'lcfs-rag',
            stream: true
          })
        })

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`)
        }

        // Handle streaming response
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let assistantMessage = {
          role: 'assistant',
          content: '',
          id: Date.now() + Math.random() // Unique ID for assistant message
        }

        // Add empty assistant message
        setMessages((prev) => [...prev, assistantMessage])

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') break

              try {
                const parsed = JSON.parse(data)
                const content = parsed.choices[0]?.delta?.content

                if (content) {
                  assistantMessage.content += content
                  setMessages((prev) => {
                    const newMessages = [...prev]
                    newMessages[newMessages.length - 1] = {
                      ...assistantMessage
                    }
                    return newMessages
                  })
                }
              } catch (e) {
                console.debug('Failed to parse chunk:', e)
              }
            }
          }
        }
      } catch (err) {
        console.error('Edit message error:', err)
        setError(err.message || 'Failed to resend message. Please try again.')

        // Remove the failed assistant message if it exists
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1]
          if (lastMsg?.role === 'assistant' && !lastMsg.content) {
            return prev.slice(0, -1)
          }
          return prev
        })
      } finally {
        setIsLoading(false)
      }
    },
    [messages, keycloak.token]
  )

  /**
   * Regenerate the last assistant response
   */
  const regenerateResponse = useCallback(
    async (assistantMessageId) => {
      // Find the assistant message
      const messageIndex = messages.findIndex(
        (m) => m.id === assistantMessageId
      )
      if (messageIndex === -1) return

      // Remove this assistant message and everything after it
      const messagesBeforeAssistant = messages.slice(0, messageIndex)
      setMessages(messagesBeforeAssistant)
      setIsLoading(true)
      setError(null)

      try {
        // Resend with the conversation up to the user's question
        const response = await fetch(`${CONFIG.API_BASE}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${keycloak.token}`
          },
          body: JSON.stringify({
            messages: messagesBeforeAssistant,
            model: 'lcfs-rag',
            stream: true
          })
        })

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`)
        }

        // Handle streaming response
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let assistantMessage = {
          role: 'assistant',
          content: '',
          id: Date.now() + Math.random() // Unique ID for regenerated message
        }

        setMessages((prev) => [...prev, assistantMessage])

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') break

              try {
                const parsed = JSON.parse(data)
                const content = parsed.choices[0]?.delta?.content

                if (content) {
                  assistantMessage.content += content
                  setMessages((prev) => {
                    const newMessages = [...prev]
                    newMessages[newMessages.length - 1] = {
                      ...assistantMessage
                    }
                    return newMessages
                  })
                }
              } catch (e) {
                console.debug('Failed to parse chunk:', e)
              }
            }
          }
        }
      } catch (err) {
        console.error('Regenerate error:', err)
        setError(err.message || 'Failed to regenerate response.')

        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1]
          if (lastMsg?.role === 'assistant' && !lastMsg.content) {
            return prev.slice(0, -1)
          }
          return prev
        })
      } finally {
        setIsLoading(false)
      }
    },
    [messages, keycloak.token]
  )

  /**
   * Clear all messages (privacy-first: nothing stored server-side)
   */
  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    editMessage,
    regenerateResponse,
    clearMessages
  }
}

export default useChatAssistant
