import { useState, useCallback } from 'react'
import { useKeycloak } from '@react-keycloak/web'
import { CONFIG } from '@/constants/config'

const createAssistantMessage = (responseData) => {
  const content =
    responseData?.choices?.[0]?.message?.content?.trim() ||
    'I was unable to generate a response. Please try again.'

  return {
    role: 'assistant',
    content,
    metadata: responseData?.lcfs_metadata,
    id: Date.now() + Math.random()
  }
}

export const useChatAssistant = () => {
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const { keycloak } = useKeycloak()

  const fetchCompletion = useCallback(
    async (conversationMessages) => {
      const response = await fetch(`${CONFIG.API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${keycloak.token}`
        },
        body: JSON.stringify({
          messages: conversationMessages,
          model: 'lcfs-rag',
          stream: false
        })
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`)
      }

      return response.json()
    },
    [keycloak.token]
  )

  /**
   * Send a message to the chat assistant
   */
  const sendMessage = useCallback(
    async (content) => {
      if (!content.trim()) return

      const userMessage = {
        role: 'user',
        content: content.trim(),
        id: Date.now() + Math.random()
      }

      setMessages((prev) => [...prev, userMessage])
      setIsLoading(true)
      setError(null)

      try {
        const conversationMessages = [...messages, userMessage]
        const completion = await fetchCompletion(conversationMessages)
        const assistantMessage = createAssistantMessage(completion)

        setMessages((prev) => [...prev, assistantMessage])
      } catch (err) {
        console.error('Chat error:', err)
        setError(err.message || 'Failed to send message. Please try again.')
      } finally {
        setIsLoading(false)
      }
    },
    [messages, fetchCompletion]
  )

  /**
   * Edit a user message and optionally resend
   */
  const editMessage = useCallback(
    async (messageId, newContent) => {
      if (!newContent.trim()) return

      const messageIndex = messages.findIndex((m) => m.id === messageId)
      if (messageIndex === -1) return

      const updatedMessages = messages.slice(0, messageIndex + 1)
      updatedMessages[messageIndex] = {
        ...updatedMessages[messageIndex],
        content: newContent.trim()
      }

      setMessages(updatedMessages)
      setIsLoading(true)
      setError(null)

      try {
        const completion = await fetchCompletion(updatedMessages)
        const assistantMessage = createAssistantMessage(completion)
        setMessages((prev) => [...prev, assistantMessage])
      } catch (err) {
        console.error('Edit message error:', err)
        setError(err.message || 'Failed to resend message. Please try again.')
      } finally {
        setIsLoading(false)
      }
    },
    [messages, fetchCompletion]
  )

  /**
   * Regenerate the last assistant response
   */
  const regenerateResponse = useCallback(
    async (assistantMessageId) => {
      const messageIndex = messages.findIndex(
        (m) => m.id === assistantMessageId
      )
      if (messageIndex === -1) return

      const messagesBeforeAssistant = messages.slice(0, messageIndex)
      setMessages(messagesBeforeAssistant)
      setIsLoading(true)
      setError(null)

      try {
        const completion = await fetchCompletion(messagesBeforeAssistant)
        const assistantMessage = createAssistantMessage(completion)
        setMessages((prev) => [...prev, assistantMessage])
      } catch (err) {
        console.error('Regenerate error:', err)
        setError(err.message || 'Failed to regenerate response.')
      } finally {
        setIsLoading(false)
      }
    },
    [messages, fetchCompletion]
  )

  /**
   * Clear all messages (privacy-first: nothing stored server-side)
   */
  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
    setIsLoading(false)
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
