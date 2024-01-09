import PropTypes from 'prop-types'

const DataGridLoading = (props) => {
  return (
    <div className="ag-overlay-loading-center">
      <div
        className="ag-overlay-loading-center-box"
        aria-label={props.loadingMessage}
      ></div>
      <div className="ag-overlay-loading-center-text">
        {props.loadingMessage}
      </div>
    </div>
  )
}

DataGridLoading.propTypes = {
  loadingMessage: PropTypes.string
}

export default DataGridLoading
