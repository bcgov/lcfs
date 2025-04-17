export const NotFound = () => (
  <div
    className="alert alert-danger error-alert"
    role="alert"
    data-test="not-found"
  >
    <p>The requested page could not be found.</p>
    <p>
      To trade this page for a valid one click{' '}
      <a href="/" data-test="link-home">
        here
      </a>{' '}
      or learn more about the Renewable and Low Carbon Fuel Requirements
      Regulation{' '}
      <a
        href="http://www.gov.bc.ca/lowcarbonfuels/"
        rel="noopener noreferrer"
        target="_blank"
        data-test="link-learn-more"
      >
        here
      </a>
    </p>
  </div>
)
