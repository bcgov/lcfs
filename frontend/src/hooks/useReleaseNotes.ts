import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import type { ExtMutationOptions, QueryOptions } from './types'

export interface ReleaseSections {
  features: string[]
  fixes: string[]
  security: string[]
  breaking: string[]
  dependencies: string[]
  other: string[]
}

export interface Release {
  version: string
  tag: string
  date: string
  releaseUrl: string
  fullChangelogUrl: string
  summary: string
  sections: ReleaseSections
  contributors: string[]
}

export interface ReleaseNoteOverride {
  version: string
  summary?: string | null
  sections?: ReleaseSections | null
  updateDate?: string | null
  updateUser?: string | null
}

const BASE_QUERY_KEY = 'release-notes-base'
const OVERRIDES_QUERY_KEY = 'release-notes-overrides'

const fetchBaseReleaseNotes = async (): Promise<Release[]> => {
  const res = await fetch('/release-notes.json')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/**
 * Layers System Admin overrides on top of the auto-generated release notes.
 * A `null`/`undefined` field on the override means "use the auto-generated
 * value" — admins can edit just the summary, just the sections, or both.
 */
const mergeOverrides = (
  releases: Release[],
  overrides: ReleaseNoteOverride[]
): Release[] => {
  if (!overrides?.length) return releases
  const overridesByVersion = new Map(overrides.map((o) => [o.version, o]))

  return releases.map((release) => {
    const override = overridesByVersion.get(release.version)
    if (!override) return release
    return {
      ...release,
      summary: override.summary ?? release.summary,
      sections: override.sections ?? release.sections
    }
  })
}

/**
 * Fetches the static, auto-generated release notes and the System Admin
 * overrides for this environment in parallel, then merges them. The
 * auto-generation process and its JSON output are never modified; overrides
 * are stored separately per environment and only supersede content for
 * display purposes.
 */
export const useReleaseNotes = (options: QueryOptions<Release[]> = {}) => {
  const client = useApiService()

  const baseQuery = useQuery({
    queryKey: [BASE_QUERY_KEY],
    queryFn: fetchBaseReleaseNotes,
    staleTime: 5 * 60 * 1000
  })

  const overridesQuery = useQuery({
    queryKey: [OVERRIDES_QUERY_KEY],
    queryFn: async () => {
      const response = await client.get(apiRoutes.releaseNoteOverrides)
      return response.data as ReleaseNoteOverride[]
    },
    staleTime: 5 * 60 * 1000
  })

  const isLoading = baseQuery.isLoading || overridesQuery.isLoading
  // The overrides call failing shouldn't block rendering auto-generated notes
  const isError = baseQuery.isError

  const data = baseQuery.data
    ? mergeOverrides(baseQuery.data, overridesQuery.data ?? [])
    : undefined

  // Lets the UI show a "Reset to default" action only for releases that
  // currently have a System Admin edit stored.
  const overriddenVersions = new Set(
    (overridesQuery.data ?? []).map((o) => o.version)
  )

  // Raw auto-generated values, without any System Admin override applied.
  // Used by the edit form to restore individual fields to the true default.
  const baseReleases = baseQuery.data ?? []

  return { ...baseQuery, data, isLoading, isError, overriddenVersions, baseReleases, ...options }
}

export const useUpdateReleaseNote = (
  options: ExtMutationOptions<ReleaseNoteOverride, { version: string; summary: string; sections: ReleaseSections }> = {}
) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  const { onSuccess, onError, ...rest } = options

  return useMutation({
    mutationFn: async ({ version, summary, sections }) => {
      const path = apiRoutes.updateReleaseNote.replace(':version', version)
      const response = await client.put(path, { summary, sections })
      return response.data
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: [OVERRIDES_QUERY_KEY] })
      onSuccess?.(data, variables, context)
    },
    onError,
    ...rest
  })
}

/**
 * Deletes the System Admin override for a release version, reverting it
 * back to the original auto-generated content. The auto-generated
 * release-notes.json entry is never touched, so this is fully reversible —
 * an admin can simply edit the release again to re-apply a correction.
 */
export const useResetReleaseNote = (
  options: ExtMutationOptions<void, { version: string }> = {}
) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  const { onSuccess, onError, ...rest } = options

  return useMutation({
    mutationFn: async ({ version }: { version: string }) => {
      const path = apiRoutes.resetReleaseNote.replace(':version', version)
      const response = await client.delete(path)
      return response.data
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: [OVERRIDES_QUERY_KEY] })
      onSuccess?.(data, variables, context)
    },
    onError,
    ...rest
  })
}
