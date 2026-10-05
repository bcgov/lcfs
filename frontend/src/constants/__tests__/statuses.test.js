import { describe, expect, it } from 'vitest'
import { CO_PROCESSED_OPTIONS } from '../statuses'

describe('CO_PROCESSED_OPTIONS', () => {
  it('lists exactly the four approved values, "No" first, in backend enum order', () => {
    // Must stay in sync with CoProcessedEnumSchema in the backend; a value
    // the backend cannot serialise breaks the fuel code detail view.
    expect(CO_PROCESSED_OPTIONS).toEqual([
      'No',
      'Yes - DHT',
      'Yes - FCC',
      'Yes - Other'
    ])
  })
})
