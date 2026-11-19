Feature: Public sign-in and route protection

  Scenario: The login page shows the available sign-in options
    Given I open the LCFS login page
    Then I see the BCeID and IDIR sign-in options

  Scenario: An unauthenticated user is redirected from a protected route
    When I open a protected organization route
    Then I am redirected to the login page
