Feature: Compliance Report Management

  Scenario: Supplier saves a draft compliance report
    Given the user is on the login page
    And the supplier logs in with valid credentials
    And they navigate to the compliance reports page
    And the supplier creates a new compliance report
    Then the compliance report introduction is shown
    When the supplier navigates to the fuel supply page
    And the supplier enters a valid fuel supply row
    And saves and returns to the report
    Then the compliance report summary includes the quantity
    When the supplier fills out line 6
    Then it should round the amount to 25
    When the supplier accepts the agreement
    And the supplier submits the report
    Then the banner shows success

  Scenario: Analyst logs in to review a compliance report
    Given the user is on the login page
    And the analyst logs in with valid credentials
    And they navigate to the compliance reports page
    Then they see the previously submitted report

  Scenario: Supplier creates a compliance report with multiple schedule types
      Given the user is on the login page
      And the supplier logs in with valid credentials
      And they navigate to the compliance reports page
      When the supplier creates a new compliance report
      Then the compliance report introduction is shown

      # Add Fuel Supply record
      When the supplier navigates to the "Fuel Supply" page
      And the supplier enters a valid "Fuel Supply" record
      And the supplier returns to the compliance report summary

      # Add Fuel Export record
      When the supplier navigates to the "Fuel Export" page
      And the supplier enters a valid "Fuel Export" record
      And the supplier returns to the compliance report summary

      # Add Other Uses record
      When the supplier navigates to the "Other Uses" page
      And the supplier enters a valid "Other Uses" record
      And the supplier returns to the compliance report summary

      # Add Notional Transfer record
      When the supplier navigates to the "Notional Transfer" page
      And the supplier enters a valid "Notional Transfer" record
      And the supplier returns to the compliance report summary

      # Add Allocation Agreement record
      When the supplier navigates to the "Allocation Agreement" page
      And the supplier enters a valid "Allocation Agreement" record
      And the supplier returns to the compliance report summary

      # Add Fuel Supply Equipment record
      When the supplier navigates to the "Fuel Supply Equipment" page
      And the supplier enters a valid "Fuel Supply Equipment" record
      And the supplier returns to the compliance report summary

      Then the compliance report summary should display expandable sections for:
      | Section               |
      | Fuel Supply           |
      | Fuel Export           |
      | Other Uses            |
      | Notional Transfer     |
      | Allocation Agreement  |
      | Fuel Supply Equipment |