// TODO: Example view! Replace with actual business logic.

import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Container
} from '@mui/material'
import axios from 'axios'
import { useKeycloak } from '@react-keycloak/web'
import { CONFIG } from '@/constants/config'

const FormView = () => {
  const { formSlug, linkKey } = useParams()
  const { keycloak } = useKeycloak()
  const [formData, setFormData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Determine if this is an authenticated or anonymous access
  const isAnonymousAccess = Boolean(linkKey)

  const getErrorMessage = (err, isAnonymousAccess) => {
    if (err.response?.data?.detail) return err.response.data.detail

    const statusMessages = {
      404: 'Form not found or link key is invalid',
      401: isAnonymousAccess
        ? 'Authentication required - please check your link key'
        : 'Please log in to access this form'
    }

    const status = err.response?.status
    if (statusMessages[status]) return statusMessages[status]

    if (err.code === 'ECONNREFUSED') return 'Backend server is not running'

    return err.message || 'Failed to load form'
  }

  useEffect(() => {
    const fetchFormData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Use different API endpoints based on access type
        const apiUrl = isAnonymousAccess
          ? `${CONFIG.API_BASE}/forms/${formSlug}/${linkKey}`
          : `${CONFIG.API_BASE}/forms/${formSlug}`

        const axiosConfig = {
          timeout: 10000 // 10 second timeout
        }

        // For authenticated access, we need to include auth headers
        if (!isAnonymousAccess && keycloak.authenticated) {
          axiosConfig.headers = {
            Authorization: `Bearer ${keycloak.token}`
          }
        }

        const response = await axios.get(apiUrl, axiosConfig)

        setFormData(response.data)
      } catch (err) {
        setError(getErrorMessage(err, isAnonymousAccess))
      } finally {
        setLoading(false)
      }
    }

    if (formSlug) {
      fetchFormData()
    }
  }, [formSlug, linkKey, keycloak.authenticated, keycloak.token])

  if (loading) {
    return (
      <Container maxWidth="md">
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="60vh"
        >
          <CircularProgress />
        </Box>
      </Container>
    )
  }

  if (error) {
    return (
      <Container maxWidth="md">
        <Box mt={4}>
          <Alert severity="error">
            <Typography variant="h6" gutterBottom>
              Form Access Error
            </Typography>
            <Typography>{error}</Typography>
          </Alert>
        </Box>
      </Container>
    )
  }

  return (
    <Container maxWidth="md">
      <Box mt={4} mb={4}>
        <Paper elevation={2} sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom color="primary">
            {formData?.name}
          </Typography>

          {formData?.description && (
            <Typography variant="body1" color="text.secondary" paragraph>
              {formData.description}
            </Typography>
          )}

          {formData?.organization_name && (
            <Typography variant="h6" gutterBottom>
              Organization: {formData.organization_name}
            </Typography>
          )}

          <Alert severity="success" sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Status: {formData?.status}
            </Typography>
            <Typography>{formData?.message}</Typography>
          </Alert>

          <Box mt={4}>
            <Typography variant="body2" color="text.secondary">
              <strong>Form ID:</strong> {formData?.form_id}
              <br />
              <strong>Form Slug:</strong> {formData?.slug}
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Container>
  )
}

export default FormView
