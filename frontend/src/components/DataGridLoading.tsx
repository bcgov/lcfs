interface DataGridLoadingProps {
  loadingMessage?: string | null
}

const DataGridLoading = ({ loadingMessage }: DataGridLoadingProps) => {
  return (
    <div className="ag-overlay-loading-center" style={{ position: 'fixed' }}>
      <div
        className="ag-overlay-loading-center-box"
        aria-label={loadingMessage || undefined}
      ></div>
      <div className="ag-overlay-loading-center-text">
        {loadingMessage}
      </div>
    </div>
  )
}

export default DataGridLoading