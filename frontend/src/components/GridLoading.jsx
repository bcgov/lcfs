import PropTypes from 'prop-types'

const GridLoading = (props) => {
  return (
    <div className="ag-overlay-loading">
      <div
        className="ag-overlay-loading-center-box"
        aria-label={props.loadingMessage}
      ></div>
      {/* <div className="ag-overlay-loading-center-text">
        {props.loadingMessage}
      </div> */}
    </div>
  )
}

GridLoading.propTypes = {
  loadingMessage: PropTypes.string
}

export default GridLoading
