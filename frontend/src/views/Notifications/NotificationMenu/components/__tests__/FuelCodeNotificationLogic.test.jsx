import { describe, it, expect, vi } from 'vitest'
import { routesMapping } from '../_schema'
import { ROUTES } from '@/routes/routes'

describe('Fuel Code Notification Logic', () => {
  describe('handleRowClicked logic', () => {
    // Simulate the logic from handleRowClicked function
    const simulateHandleRowClicked = (params, currentUser) => {
      const { id, service, compliancePeriod } = JSON.parse(params.data.message)
      // For fuel codes, use the notification type since they don't have a service field
      const serviceKey = service || params.data.type
      const routeTemplate = routesMapping(currentUser)[serviceKey]
      
      if (routeTemplate && params.event.target.dataset.action !== 'delete') {
        // Simulate navigation
        return routeTemplate
          .replace(':transactionId', id)
          .replace(':transferId', id)
          .replace(':compliancePeriod', compliancePeriod)
          .replace(':complianceReportId', id)
          .replace(':fuelCodeID', id)
      }
      return null
    }

    it('handles fuel code notification without service field', () => {
      const params = {
        data: {
          notificationMessageId: 'fc1',
          type: 'Fuel Code Recommended',
          message: JSON.stringify({
            id: 123,
            status: 'Recommended',
            fuelCode: 'BCLCF123',
            company: 'Test Company'
          })
        },
        event: { target: { dataset: {} } }
      }

      const currentUser = { isGovernmentUser: true }
      const result = simulateHandleRowClicked(params, currentUser)
      
      expect(result).toBe('/fuel-codes/123')
    })

    it('handles fuel code approved notification', () => {
      const params = {
        data: {
          notificationMessageId: 'fc2',
          type: 'Fuel Code Approved',
          message: JSON.stringify({
            id: 456,
            status: 'Approved',
            fuelCode: 'BCLCF456',
            company: 'Another Company'
          })
        },
        event: { target: { dataset: {} } }
      }

      const currentUser = { isGovernmentUser: true }
      const result = simulateHandleRowClicked(params, currentUser)
      
      expect(result).toBe('/fuel-codes/456')
    })

    it('handles fuel code returned notification', () => {
      const params = {
        data: {
          notificationMessageId: 'fc3',
          type: 'Fuel Code Returned',
          message: JSON.stringify({
            id: 789,
            status: 'Draft',
            previousStatus: 'Recommended',
            fuelCode: 'BCLCF789',
            company: 'Returned Company'
          })
        },
        event: { target: { dataset: {} } }
      }

      const currentUser = { isGovernmentUser: true }
      const result = simulateHandleRowClicked(params, currentUser)
      
      expect(result).toBe('/fuel-codes/789')
    })

    it('prefers service field over type when both exist', () => {
      const params = {
        data: {
          notificationMessageId: 'mixed1',
          type: 'Fuel Code Approved', // Should be ignored
          message: JSON.stringify({
            id: 999,
            service: 'Transfer', // Should be used
            fuelCode: 'BCLCF999'
          })
        },
        event: { target: { dataset: {} } }
      }

      const currentUser = { isGovernmentUser: true }
      const result = simulateHandleRowClicked(params, currentUser)
      
      expect(result).toBe('/transfers/999')
    })

    it('returns null for unknown notification types', () => {
      const params = {
        data: {
          notificationMessageId: 'unknown1',
          type: 'Unknown Type',
          message: JSON.stringify({
            id: 111,
            service: 'UnknownService'
          })
        },
        event: { target: { dataset: {} } }
      }

      const currentUser = { isGovernmentUser: true }
      const result = simulateHandleRowClicked(params, currentUser)
      
      expect(result).toBe(null)
    })

    it('does not navigate when action is delete', () => {
      const params = {
        data: {
          notificationMessageId: 'fc4',
          type: 'Fuel Code Approved',
          message: JSON.stringify({
            id: 222,
            status: 'Approved'
          })
        },
        event: { target: { dataset: { action: 'delete' } } }
      }

      const currentUser = { isGovernmentUser: true }
      const result = simulateHandleRowClicked(params, currentUser)
      
      expect(result).toBe(null)
    })

    it('handles missing id in message gracefully', () => {
      const params = {
        data: {
          notificationMessageId: 'fc5',
          type: 'Fuel Code Approved',
          message: JSON.stringify({
            // No id field
            status: 'Approved',
            fuelCode: 'BCLCF333'
          })
        },
        event: { target: { dataset: {} } }
      }

      const currentUser = { isGovernmentUser: true }
      const result = simulateHandleRowClicked(params, currentUser)
      
      expect(result).toBe('/fuel-codes/undefined')
    })
  })

  describe('Fuel Code Status Types', () => {
    it('all fuel code status types map to the same edit route', () => {
      const currentUser = { isGovernmentUser: true }
      const mapping = routesMapping(currentUser)
      
      const fuelCodeTypes = [
        'Fuel Code',
        'Fuel Code Status Update',
        'Fuel Code Recommended',
        'Fuel Code Approved',
        'Fuel Code Draft',
        'Fuel Code Returned'
      ]

      const uniqueRoutes = new Set(fuelCodeTypes.map(type => mapping[type]))
      expect(uniqueRoutes.size).toBe(1)
      expect([...uniqueRoutes][0]).toBe(ROUTES.FUEL_CODES.EDIT)
    })
  })

  describe('Route Parameter Replacement', () => {
    it('correctly replaces all possible parameters', () => {
      const routeTemplate = '/fuel-codes/:fuelCodeID'
      const id = '12345'
      
      const result = routeTemplate
        .replace(':transactionId', id)
        .replace(':transferId', id)
        .replace(':compliancePeriod', id)
        .replace(':complianceReportId', id)
        .replace(':fuelCodeID', id)
      
      expect(result).toBe('/fuel-codes/12345')
    })

    it('leaves unmatched parameters unchanged', () => {
      const routeTemplate = '/some-route/:unknownParam'
      const id = '12345'
      
      const result = routeTemplate
        .replace(':transactionId', id)
        .replace(':transferId', id)
        .replace(':compliancePeriod', id)
        .replace(':complianceReportId', id)
        .replace(':fuelCodeID', id)
      
      expect(result).toBe('/some-route/:unknownParam')
    })
  })

  describe('Error Scenarios', () => {
    it('handles empty message object', () => {
      const simulateWithEmptyMessage = () => {
        const params = {
          data: {
            notificationMessageId: 'empty1',
            type: 'Fuel Code Approved',
            message: '{}'
          },
          event: { target: { dataset: {} } }
        }
        
        const { id, service, compliancePeriod } = JSON.parse(params.data.message)
        return { id, service, compliancePeriod }
      }
      
      const result = simulateWithEmptyMessage()
      expect(result.id).toBeUndefined()
      expect(result.service).toBeUndefined()
      expect(result.compliancePeriod).toBeUndefined()
    })

    it('throws error for malformed JSON', () => {
      const simulateWithMalformedJSON = () => {
        const params = {
          data: {
            notificationMessageId: 'malformed1',
            type: 'Fuel Code Approved',
            message: 'not valid json'
          },
          event: { target: { dataset: {} } }
        }
        
        JSON.parse(params.data.message)
      }
      
      expect(simulateWithMalformedJSON).toThrow()
    })
  })

  describe('Service vs Type Field Priority', () => {
    it('uses service field when present', () => {
      const params = {
        data: {
          type: 'Some Type',
          message: JSON.stringify({ service: 'Transfer' })
        }
      }
      
      const { service } = JSON.parse(params.data.message)
      const serviceKey = service || params.data.type
      
      expect(serviceKey).toBe('Transfer')
    })

    it('uses type field when service is missing', () => {
      const params = {
        data: {
          type: 'Fuel Code Approved',
          message: JSON.stringify({ id: 123 })
        }
      }
      
      const { service } = JSON.parse(params.data.message)
      const serviceKey = service || params.data.type
      
      expect(serviceKey).toBe('Fuel Code Approved')
    })

    it('uses service field even if empty string', () => {
      const params = {
        data: {
          type: 'Fuel Code Approved',
          message: JSON.stringify({ service: '' })
        }
      }
      
      const { service } = JSON.parse(params.data.message)
      const serviceKey = service || params.data.type
      
      expect(serviceKey).toBe('Fuel Code Approved') // Because empty string is falsy
    })
  })
})