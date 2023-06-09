import React, { useState } from 'react'
// import FontAwesomeIcon from '@fortawesome/react-fontawesome'
import { useKeycloak } from '@react-keycloak/web';
import CallableModal from '../components/CallableModal'
import * as Lang from '../constants/langEnUs'
import { IDENTITY_PROVIDERS } from '../constants/auth'

const Login = (props) => {
  const { keycloak } = useKeycloak()
  const [hideModal, setHideModal] = useState(false)
  const userAgent = window.navigator.userAgent
  const redirectUri = window.location.origin

  const _closeModal = () => {
    setHideModal(true)
  }
  
  let showModal = false

  if (!hideModal && (userAgent.indexOf('MSIE ') >= 0 || userAgent.indexOf('Trident/') >= 0)) {
    showModal = true
  }

  return (
    <div id="login">
      <div id="header" className="login-tfrs-page-header">
        <div id="header-wrapper" className="login-tfrs-page-header-text">Transportation Fuels Reporting System</div>
      </div>
      <div className="login-tfrs-page">
        <div className="login-tfrs-brand" />
        <div className="card-tfrs">
          <div className="buttons-section">
            <div className="oidc">
              <button
                type="button"
                onClick={() => {
                  keycloak.login({
                    idpHint: IDENTITY_PROVIDERS.BCEID_BUSINESS,
                    redirectUri: redirectUri
                  })
                }}
                id="link-bceid"
                className="button"
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
                    redirectUri: redirectUri
                  })
                }}
                id="link-idir"
                className="button"
              >
                <span className="text">Login with</span>
                <span className="display-name"> IDIR </span>
              </button>
            </div>
          </div>
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
            Internet Explorer is not fully supported,
            certain features within TFRS will not work.
          </p>
          <p>Please consider using a different browser such as Chrome, Firefox or Safari.</p>
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

export default Login;
