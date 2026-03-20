import { useMemo, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import BCTypography from '@/components/BCTypography'
import { useApiService } from '@/services/useApiService'
import {
  getAiAnalyticsCatalog,
  planAiAnalyticsQuestion,
  runAiAnalyticsFollowUp,
  runAiAnalyticsQuestion
} from './api'
import { AssistantResponse, QueryPlan, SchemaCatalog } from './types'
import { ChartRenderer } from './ChartRenderer'
import { SqlPreview } from './SqlPreview'
import BCButton from '@/components/BCButton'

const createSessionId = () =>
  `ai-analytics-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

const CHART_FOLLOW_UPS = [
  { label: 'Auto', value: '' },
  { label: 'Line', value: 'line chart' },
  { label: 'Bar', value: 'bar chart' },
  { label: 'Pie', value: 'pie chart' },
  { label: 'Table', value: 'table' }
]

const EXAMPLE_QUESTIONS = [
  'Show total credits by compliance period',
  'Compare organizations by total credits in 2023',
  'Show trend of report processing time by year'
]

export const AiAnalyticsPanel = () => {
  const DEFAULT_VISIBLE_ROWS = 10
  const client = useApiService()
  const [sessionId] = useState(createSessionId)
  const [question, setQuestion] = useState(EXAMPLE_QUESTIONS[0])
  const [followUp, setFollowUp] = useState('')
  const [catalog, setCatalog] = useState<SchemaCatalog | null>(null)
  const [plan, setPlan] = useState<QueryPlan | null>(null)
  const [response, setResponse] = useState<AssistantResponse | null>(null)
  const [chartMode, setChartMode] = useState('')
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [planning, setPlanning] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAllRows, setShowAllRows] = useState(false)

  const entityLabels = useMemo(
    () =>
      response?.entitiesUsed.map(
        (entity) => `${entity.schemaName}.${entity.name} (${entity.entityType})`
      ) || [],
    [response]
  )

  const visibleRows = useMemo(() => {
    if (!response) return []
    return showAllRows
      ? response.result.rows
      : response.result.rows.slice(0, DEFAULT_VISIBLE_ROWS)
  }, [response, showAllRows])

  const loadCatalog = async () => {
    setLoadingCatalog(true)
    setError(null)
    try {
      const nextCatalog = await getAiAnalyticsCatalog(client)
      setCatalog(nextCatalog)
    } catch (err) {
      setError('Unable to load the analytics schema catalog.')
    } finally {
      setLoadingCatalog(false)
    }
  }

  const handlePlan = async () => {
    setPlanning(true)
    setError(null)
    try {
      const nextPlan = await planAiAnalyticsQuestion(
        client,
        question,
        sessionId
      )
      setPlan(nextPlan)
    } catch (err) {
      setError('Unable to interpret that question.')
    } finally {
      setPlanning(false)
    }
  }

  const handleRun = async () => {
    setRunning(true)
    setError(null)
    try {
      const nextResponse = await runAiAnalyticsQuestion(
        client,
        question,
        sessionId
      )
      setResponse(nextResponse)
      setPlan(nextResponse.queryPlan)
      setFollowUp('')
      setChartMode('')
      setShowAllRows(false)
    } catch (err) {
      setError('The analytics assistant could not run that query safely.')
    } finally {
      setRunning(false)
    }
  }

  const handleFollowUp = async (followUpText?: string) => {
    const prompt = followUpText || followUp || chartMode
    if (!prompt) return

    setRunning(true)
    setError(null)
    try {
      const nextResponse = await runAiAnalyticsFollowUp(
        client,
        prompt,
        sessionId
      )
      setResponse(nextResponse)
      setPlan(nextResponse.queryPlan)
      setShowAllRows(false)
      if (!followUpText) {
        setFollowUp('')
      }
    } catch (err) {
      setError('The follow-up request could not be applied safely.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <BCTypography variant="h6" color="primary" fontWeight="bold">
            AI Analytical Assistant
          </BCTypography>
          <BCTypography variant="body2">
            Ask grounded analytics questions against the live schema catalog.
            The assistant plans first, generates read-only SQL, and explains
            which entities it used.
          </BCTypography>
          <Box pt={2}>
            <TextField
              label="Analytical question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              multiline
              minRows={3}
              fullWidth
            />
          </Box>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <BCButton
              color="primary"
              variant="outlined"
              onClick={loadCatalog}
              disabled={loadingCatalog}
            >
              {loadingCatalog ? 'Loading catalog...' : 'Load Schema Catalog'}
            </BCButton>
            <BCButton
              color="primary"
              variant="outlined"
              onClick={handlePlan}
              disabled={planning || !question}
            >
              {planning ? 'Planning...' : 'Plan Query'}
            </BCButton>
            <BCButton
              color="primary"
              variant="contained"
              onClick={handleRun}
              disabled={running || !question}
            >
              {running ? 'Running...' : 'Run Query'}
            </BCButton>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {EXAMPLE_QUESTIONS.map((example) => (
              <Chip
                key={example}
                label={example}
                onClick={() => setQuestion(example)}
                sx={{ mb: 1 }}
              />
            ))}
          </Stack>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </Paper>

      {catalog && (
        <Paper sx={{ p: 3 }}>
          <Stack spacing={1}>
            <BCTypography variant="h5" color="primary">
              Catalog Snapshot
            </BCTypography>
            <BCTypography variant="body2">
              {catalog.entities.length} entities discovered. Views and
              materialized views are preferred when they already encode business
              logic.
            </BCTypography>
          </Stack>
        </Paper>
      )}

      {plan && (
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <BCTypography variant="h5" color="primary">
              Query Plan
            </BCTypography>
            <BCTypography variant="body2">{plan.explanation}</BCTypography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip
                label={`Confidence ${Math.round(plan.confidence * 100)}%`}
              />
              <Chip label={`Chart ${plan.candidateChartType}`} />
              {plan.metrics.map((metric) => (
                <Chip
                  key={metric.name}
                  label={`${metric.aggregation} ${metric.name}`}
                />
              ))}
              {plan.dimensions.map((dimension) => (
                <Chip key={dimension.name} label={`By ${dimension.name}`} />
              ))}
            </Stack>
            {plan.warnings.length > 0 && (
              <Alert severity="warning">{plan.warnings.join(' ')}</Alert>
            )}
            {plan.ambiguities.length > 0 && (
              <Alert severity="info">{plan.ambiguities.join(' ')}</Alert>
            )}
          </Stack>
        </Paper>
      )}

      {running && (
        <Paper sx={{ p: 4 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <CircularProgress size={24} />
            <BCTypography>Executing grounded analytics query...</BCTypography>
          </Stack>
        </Paper>
      )}

      {response && (
        <Stack spacing={3}>
          <Paper sx={{ p: 3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={7}>
                <Stack spacing={2}>
                  <BCTypography variant="h5" color="primary">
                    Summary
                  </BCTypography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip label={`Mode ${response.executionMode}`} />
                    {response.llmProvider && (
                      <Chip label={`Provider ${response.llmProvider}`} />
                    )}
                    {response.modelName && (
                      <Chip label={`Model ${response.modelName}`} />
                    )}
                    {response.forecastMode && (
                      <Chip color="secondary" label="Forecast" />
                    )}
                    {response.mindsdbModelName && (
                      <Chip label={`MindsDB ${response.mindsdbModelName}`} />
                    )}
                  </Stack>
                  <BCTypography variant="body1">
                    {response.summary}
                  </BCTypography>
                  {response.keyFindings.map((finding) => (
                    <Alert severity="success" key={finding}>
                      {finding}
                    </Alert>
                  ))}
                  {response.caveats.map((caveat) => (
                    <Alert severity="warning" key={caveat}>
                      {caveat}
                    </Alert>
                  ))}
                </Stack>
              </Grid>
              <Grid item xs={12} md={5}>
                <Stack spacing={2}>
                  <BCTypography variant="subtitle1" color="primary">
                    Follow-up
                  </BCTypography>
                  <TextField
                    label="Follow-up question"
                    value={followUp}
                    onChange={(event) => setFollowUp(event.target.value)}
                    placeholder="Show this by year"
                    fullWidth
                  />
                  <Stack direction="row" spacing={2}>
                    <Select
                      displayEmpty
                      value={chartMode}
                      onChange={(event) =>
                        setChartMode(event.target.value as string)
                      }
                      fullWidth
                    >
                      {CHART_FOLLOW_UPS.map((option) => (
                        <MenuItem key={option.label} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                    <BCButton
                      variant="outlined"
                      onClick={() => handleFollowUp()}
                      disabled={running || (!followUp && !chartMode)}
                    >
                      Apply
                    </BCButton>
                  </Stack>
                </Stack>
              </Grid>
            </Grid>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Stack spacing={2}>
              <BCTypography variant="h5" color="primary">
                Visualization
              </BCTypography>
              <ChartRenderer chart={response.chart} />
              <BCTypography variant="body2" color="text.secondary">
                {response.chart.rationale}
              </BCTypography>
              {response.forecastMode && (
                <BCTypography variant="body2" color="text.secondary">
                  Horizon: {response.forecastHorizon}{' '}
                  {response.forecastGranularity}
                  {response.modelReused != null &&
                    ` | Model ${response.modelReused ? 'reused' : 'trained'}`}
                </BCTypography>
              )}
            </Stack>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Stack spacing={2}>
              <BCTypography variant="h5" color="primary">
                Result Table
              </BCTypography>
              <BCTypography variant="body2">
                {response.result.rowCount} rows returned in{' '}
                {response.result.executionMs} ms.
              </BCTypography>
              {response.result.rows.length > DEFAULT_VISIBLE_ROWS && (
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <BCTypography variant="body2" color="text.secondary">
                    Showing {visibleRows.length} of{' '}
                    {response.result.rows.length} rows.
                  </BCTypography>
                  <BCButton
                    variant="text"
                    onClick={() => setShowAllRows((current) => !current)}
                  >
                    {showAllRows ? 'Show less' : 'Show all'}
                  </BCButton>
                </Stack>
              )}
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {response.result.columns.map((column) => (
                        <TableCell key={column}>{column}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {visibleRows.map((row, index) => (
                      <TableRow key={index}>
                        {response.result.columns.map((column) => (
                          <TableCell key={`${index}-${column}`}>
                            {String(row[column] ?? '')}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Stack>
          </Paper>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <BCTypography variant="h6">SQL Used</BCTypography>
            </AccordionSummary>
            <AccordionDetails>
              <SqlPreview sql={response.sql} />
              {response.sourceSqlUsed &&
                response.sourceSqlUsed !== response.sql && (
                  <Box mt={2}>
                    <BCTypography variant="subtitle2" color="primary">
                      Forecast Training SQL
                    </BCTypography>
                    <SqlPreview sql={response.sourceSqlUsed} />
                  </Box>
                )}
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <BCTypography variant="h6">Entities Used</BCTypography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                {entityLabels.map((entityLabel) => (
                  <Chip key={entityLabel} label={entityLabel} />
                ))}
                <Divider />
                {response.entitiesUsed.map((entity) => (
                  <Box key={`${entity.schemaName}.${entity.name}`}>
                    <BCTypography variant="subtitle1" color="primary">
                      {entity.schemaName}.{entity.name}
                    </BCTypography>
                    <BCTypography variant="body2">
                      {entity.description || 'No description available.'}
                    </BCTypography>
                  </Box>
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>
        </Stack>
      )}
    </Stack>
  )
}
