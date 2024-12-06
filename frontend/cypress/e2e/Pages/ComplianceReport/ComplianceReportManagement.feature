Feature: Compliance Report Management

  Scenario: Supplier saves a draft compliance report
    Given the supplier is on the login page
    When the supplier logs in with valid credentials
    And the supplier navigates to the compliance reports page
    And the supplier creates a new compliance report
    Then the compliance report introduction is shown
