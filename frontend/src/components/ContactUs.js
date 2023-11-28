import React from 'react';

/**
 * ContactUs Component
 *
 * This component renders the contact information for various departments
 * with enhanced accessibility features.
 */
const ContactUs = () => {
  return (
    <div
      className="contact-us-container"
      role="main"
      data-test="contact-us-container"
    >
      <h2>Contact Us</h2>

      <section aria-labelledby="lcfs-heading" data-test="contact-lcfs-section">
        <h3 id="lcfs-heading">Low Carbon Fuel Standard</h3>
        <p>
          For feedback and questions related to the Low Carbon Fuel Standard,
          please contact the Low Carbon Fuels Branch.
        </p>
        <ul className="contact-details">
          <li>
            Visit the LCFS{' '}
            <a
              href="https://www2.gov.bc.ca/gov/content/industry/electricity-alternative-energy/transportation-energies/renewable-low-carbon-fuels"
              aria-label="Visit the LCFS Website"
            >
              Website
            </a>
          </li>
          <li>
            Email:
            <a
              href="mailto:lcfs@gov.bc.ca"
              aria-label="Email the Low Carbon Fuels Branch at lcfs@gov.bc.ca"
            >
              lcfs@gov.bc.ca
            </a>
          </li>
        </ul>
      </section>

      <section
        aria-labelledby="bceid-heading"
        data-test="contact-bceid-section"
      >
        <h3 id="bceid-heading">BCeID</h3>
        <p>
          For questions related to BCeID, such as registering for a BCeID,
          resetting your password, or a locked account, please contact the BCeID
          Help Desk.
        </p>
        <ul className="contact-details">
          <li>
            Visit the BCeID{' '}
            <a
              href="https://www.bceid.ca/aboutbceid/contact_us.aspx"
              aria-label="Visit the BCeID Help Desk"
            >
              Help Desk
            </a>
          </li>
          <li>Phone: 1-888-356-2741</li>
        </ul>
      </section>

      <section aria-labelledby="idir-heading" data-test="contact-idir-section">
        <h3 id="idir-heading">IDIR</h3>
        <p>
          For questions related to IDIR, such as resetting your password or a
          locked account, please contact the OCIO Service Desk.
        </p>
        <ul className="contact-details">
          <li>
            Visit the Service Desk{' '}
            <a
              href="https://myservicecentre.gov.bc.ca/sp?id=kb_article&sys_id=31e6913c2fc1f150bef2811df699b61b"
              aria-label="Visit the Service Desk Website"
            >
              Website
            </a>
          </li>
          <li>Phone: 250-387-7000</li>
          <li>
            Email:
            <a
              href="mailto:77000@gov.bc.ca"
              aria-label="Email the OCIO Service Desk at 77000@gov.bc.ca"
            >
              77000@gov.bc.ca
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
};

export default ContactUs;
