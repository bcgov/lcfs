Feature: Return Supplemental Report to Supplier

  Scenario: Analyst returns a supplemental report to the supplier
    Given the user is on the login page
    And the analyst logs in with valid credentials
    And they navigate to the compliance reports page
    And they see a submitted supplemental report
    And they click the report to view it
    When the analyst clicks the "Return report to the supplier" button
    And the analyst confirms the return action
    Then the supplemental report is set to Draft status
    And a success message is displayed

  Scenario: Supplier sees the returned supplemental report
    Given the user is on the login page, while retaining previous data
    And the supplier logs in with valid credentials
    And they navigate to the compliance reports page
    Then they see the previously returned supplemental report with Draft status
    And they can edit and resubmit the report
