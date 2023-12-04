import { useKeycloak } from '@react-keycloak/web'
import { useState } from 'react'
import { Link } from 'react-router-dom'

// Constants
import { IDENTITY_PROVIDERS } from '@/constants/auth'
import * as Lang from '@/constants/langEnUs'

// Components
import CallableModal from '@/components/CallableModal'

// Styles
import '@/styles/index.scss'
import 'bootstrap/dist/css/bootstrap.css'

const Login = (props) => {
  const { keycloak } = useKeycloak()
  const [hideModal, setHideModal] = useState(false)
  const userAgent = window.navigator.userAgent
  const redirectUri = window.location.origin

  const _closeModal = () => {
    setHideModal(true)
  }
  let showModal = false

  if (
    !hideModal &&
    (userAgent.indexOf('MSIE ') >= 0 || userAgent.indexOf('Trident/') >= 0)
  ) {
    showModal = true
  }

  return (
    <div id="login" data-test="login-container">
      <div id="header" className="login-lcfs-page-header">
        <div id="header-wrapper" className="login-lcfs-page-header-text">
          Low Carbon Fuel Standard
        </div>
      </div>
      <div className="login-lcfs-page">
        <div className="login-lcfs-brand" />
        <div className="card-lcfs">
          <div className="buttons-section">
            <div className="oidc">
              <button
                type="button"
                onClick={() => {
                  keycloak.login({
                    idpHint: IDENTITY_PROVIDERS.BCEID_BUSINESS,
                    redirectUri
                  })
                }}
                id="link-bceid"
                className="button"
                data-test="link-bceid"
              >
                <span className="text"> Login with </span>
                <span className="display-name"> BCeID </span>
              </button>
            </div>
            <div className="oidc">
              <button
                type="button"
                onClick={() => {
                  keycloak.login({
                    idpHint: IDENTITY_PROVIDERS.IDIR,
                    redirectUri
                  })
                }}
                id="link-idir"
                className="button"
                data-test="link-idir"
              >
                <span className="text">Login with</span>
                <span className="display-name"> IDIR </span>
              </button>
            </div>
          </div>
        </div>
        <div className="login-help">
          <Link
            to="/contact-us"
            data-test="login-help-link"
            aria-label="Trouble logging in? Get assistance here"
            role="link"
          >
            Trouble logging in?
          </Link>
        </div>
      </div>

      <CallableModal
        cancelLabel={Lang.BTN_OK}
        className="login-modal"
        close={() => {
          _closeModal()
        }}
        id="no-ie"
        show={showModal}
      >
        <span className="no-ie-icon">
          {/* <FontAwesomeIcon icon={['fab', 'internet-explorer']} size="4x" />
          <FontAwesomeIcon icon="ban" size="6x" /> */}
        </span>
        <div className="content">
          <p>
            Internet Explorer is not fully supported, certain features within
            LCFS will not work.
          </p>
          <p>
            Please consider using a different browser such as Chrome, Firefox or
            Safari.
          </p>
          <button
            onClick={() => {
              _closeModal()
            }}
            type="button"
          >
            OK
          </button>
        </div>
      </CallableModal>
    </div>
  )
}

export default Login
