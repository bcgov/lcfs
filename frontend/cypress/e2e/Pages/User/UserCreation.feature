Feature: User Creation

Scenario: IDIR user creates a new user
  Given the IDIR user logs in with valid credentials
  When the IDIR user navigates to the user creation page
  And the IDIR user fills out the form with valid data
  And the IDIR user submits the form
  Then a success message is displayed
  And the new user appears in the user list

Scenario: IDIR user submits invalid data
  Given the IDIR user logs in with valid credentials
  When the IDIR user navigates to the user creation page
  And the IDIR user fills out the form with invalid data
  And the IDIR user submits the form
  Then an error message is displayed for validation
