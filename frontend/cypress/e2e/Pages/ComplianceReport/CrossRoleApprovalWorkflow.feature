Feature: Cross-role compliance report approval workflow

  The compliance report lifecycle spans four roles. Each scenario carries
  shared state from the previous one (cypress testIsolation is disabled),
  and asserts the visible status to confirm the transition documented in
  wiki/Compliance-Report-State-Matrix.md.

  Scenario: Supplier creates and submits a draft compliance report
    Given the user is on the login page
    And the supplier logs in with valid credentials
    And they navigate to the compliance reports page
    And the supplier creates a new compliance report
    Then the compliance report introduction is shown
    And the compliance report status is "Draft"
    When the supplier navigates to the fuel supply page
    And the supplier enters a valid fuel supply row
    And the supplier accepts the agreement
    And the supplier submits the report
    Then the banner shows success
    And the compliance report status is "Submitted"

  Scenario: Analyst reviews the submitted report and recommends to the manager
    Given the user is on the login page, while retaining previous data
    And the analyst logs in with valid IDIR credentials
    And they navigate to the compliance reports page
    Then they see the previously submitted report
    When they click the report to view it
    Then the compliance report status is "Submitted"
    When the analyst recommends to the compliance manager
    Then the recommended by analyst banner shows success
    And the compliance report status is "Recommended by analyst"

  Scenario: Compliance manager reviews the recommended report and recommends to the director
    Given the user is on the login page, while retaining previous data
    And the compliance manager logs in with valid IDIR credentials
    And they navigate to the compliance reports page
    Then they see the previously submitted report
    When they click the report to view it
    Then the compliance report status is "Recommended by analyst"
    When the compliance manager recommends to the director
    Then the recommended by compliance manager banner shows success
    And the compliance report status is "Recommended by manager"

  Scenario: Director assesses the recommended report
    Given the user is on the login page, while retaining previous data
    And the director logs in with valid IDIR credentials
    And they navigate to the compliance reports page
    Then they see the previously submitted report
    When they click the report to view it
    Then the compliance report status is "Recommended by manager"
    When the director approves the report
    Then the assessed by director banner shows success
    And the compliance report status is "Assessed"

  Scenario: Supplier creates a supplemental report after assessment
    Given the user is on the login page, while retaining previous data
    And the supplier logs in with valid credentials
    And they navigate to the compliance reports page
    Then they see the previously submitted report
    When they click the report to view it
    Then the compliance report status is "Assessed"
    When they create a supplemental report
    Then the compliance report status is "Draft"
