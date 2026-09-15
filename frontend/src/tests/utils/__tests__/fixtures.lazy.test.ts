import { expect, vi } from 'vitest'
import { test } from '../fixtures'

const loaded = vi.hoisted(() => ({
  msw: 0,
  query: 0,
  material: 0,
  pickers: 0,
  router: 0,
  i18n: 0,
  reactI18next: 0,
  themes: 0
}))

vi.mock('msw/node', () => {
  loaded.msw += 1
  return {}
})
vi.mock('@tanstack/react-query', () => {
  loaded.query += 1
  return {}
})
vi.mock('@mui/material', () => {
  loaded.material += 1
  return {}
})
vi.mock('@mui/x-date-pickers', () => {
  loaded.pickers += 1
  return {}
})
vi.mock('@mui/x-date-pickers/AdapterDateFnsV3', () => ({}))
vi.mock('react-router-dom', () => {
  loaded.router += 1
  return {}
})
vi.mock('react-router', () => {
  loaded.router += 1
  return {}
})
vi.mock('i18next', () => {
  loaded.i18n += 1
  return {}
})
vi.mock('react-i18next', () => {
  loaded.reactI18next += 1
  return {}
})
vi.mock('@/themes', () => {
  loaded.themes += 1
  return {}
})

test('does not import heavy fixture implementations until requested', () => {
  expect(loaded).toEqual({
    msw: 0,
    query: 0,
    material: 0,
    pickers: 0,
    router: 0,
    i18n: 0,
    reactI18next: 0,
    themes: 0
  })
})
