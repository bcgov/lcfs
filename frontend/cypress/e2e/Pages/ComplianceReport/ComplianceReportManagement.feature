Feature: Compliance Report Management

  Scenario: Supplier saves a draft compliance report
    Given the supplier is on the login page
    When the supplier logs in with valid credentials
    And the supplier navigates to the compliance reports page
    And the supplier creates a new compliance report
    Then the compliance report introduction is shown
    When the supplier navigates to the fuel supply page
    And the supplier enters a valid fuel supply row
    And saves and returns to the report
    Then the compliance report summary includes the quantity
