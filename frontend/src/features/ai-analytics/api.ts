import { apiRoutes } from '@/constants/routes'
import { ApiServiceInstance } from '@/services/useApiService'
import { AssistantResponse, QueryPlan, SchemaCatalog, SchemaEntity } from './types'

export const getAiAnalyticsCatalog = async (
  client: ApiServiceInstance,
  forceRefresh = false
): Promise<SchemaCatalog> => {
  const response = await client.post(apiRoutes.aiAnalytics.catalog, {
    forceRefresh
  })
  return response.data
}

export const planAiAnalyticsQuestion = async (
  client: ApiServiceInstance,
  question: string,
  sessionId: string
): Promise<QueryPlan> => {
  const response = await client.post(apiRoutes.aiAnalytics.plan, {
    question,
    sessionId
  })
  return response.data
}

export const runAiAnalyticsQuestion = async (
  client: ApiServiceInstance,
  question: string,
  sessionId: string
): Promise<AssistantResponse> => {
  const response = await client.post(apiRoutes.aiAnalytics.run, {
    question,
    sessionId
  })
  return response.data
}

export const runAiAnalyticsFollowUp = async (
  client: ApiServiceInstance,
  followUpQuestion: string,
  sessionId: string
): Promise<AssistantResponse> => {
  const response = await client.post(apiRoutes.aiAnalytics.followUp, {
    followUpQuestion,
    sessionId
  })
  return response.data
}

export const getAiAnalyticsViews = async (
  client: ApiServiceInstance
): Promise<SchemaEntity[]> => {
  const response = await client.get(apiRoutes.aiAnalytics.views)
  return response.data
}
