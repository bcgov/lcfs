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
    Then the status should change to Submitted

  Scenario: Analyst logs in to review a compliance report
    Given the user is on the login page
    And the analyst logs in with valid credentials
    And they navigate to the compliance reports page
    Then they see the previously submitted report