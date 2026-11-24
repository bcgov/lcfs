export const pdfFitBlockEnd = (
  start: number,
  pageEnd: number,
  block: { top: number; bottom: number },
  maxLead: number,
  strictFit = false
) =>
  (strictFit && block.bottom <= pageEnd) ||
  block.top - start <= (strictFit ? 1 : maxLead)
    ? block.bottom
    : block.top

export const groupStatisticsAndTrendsForPdf = (root: HTMLElement) => {
  const statistics = root.querySelector<HTMLElement>(
    '.pdf-market-statistics-section'
  )
  const trends = root.querySelector<HTMLElement>('.pdf-market-trends-section')
  if (!statistics || !trends || statistics.nextElementSibling !== trends) {
    throw new Error('Unable to group market statistics and trends for PDF')
  }
  const group = root.ownerDocument.createElement('div')
  group.className = 'pdf-fit-page'
  statistics.before(group)
  group.append(statistics, trends)
}
