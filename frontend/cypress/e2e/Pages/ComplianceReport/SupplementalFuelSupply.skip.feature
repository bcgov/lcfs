Feature: Supplemental Report with Fuel Supply

  Scenario: Supplier enters data & submits an annual compliance report
    Given the user is on the login page
    And the supplier logs in with valid credentials
    And they navigate to the compliance reports page
    And the supplier creates a new compliance report
    Then the compliance report introduction is shown
    When the supplier starts entering data into each schedules
      | scheduleLabel  | dataFilePath                 |
      | Supply of fuel | report-data/fuel-supply-data |
    When the supplier accepts the agreement
    And the supplier submits the report
    Then the banner shows success

  Scenario: Analyst logs in to review a compliance report
    Given the user is on the login page, while retaining previous data
    And the analyst logs in with valid credentials
    And they navigate to the compliance reports page
    And they see the previously submitted report
    And they click the report to view it
    Then the report is shown with the fuel supply data entered
    And the analyst recommends to the compliance manager
    Then the recommended by analyst banner shows success

  Scenario: Compliance manager logs in to review a compliance report
    Given the user is on the login page, while retaining previous data
    And the compliance manager logs in with valid IDIR credentials
    And they navigate to the compliance reports page
    And they see the previously submitted report
    And they click the report to view it
    And the compliance manager recommends to the director
    Then the recommended by compliance manager banner shows success

  Scenario: Director logs in to review a compliance report
    Given the user is on the login page, while retaining previous data
    And the director logs in with valid credentials
    And they navigate to the compliance reports page
    And they see the previously submitted report
    And they click the report to view it
    And the director approves the report
    Then the assessed by director banner shows success

  Scenario: The supplier drafts a supplemental report
    Given the user is on the login page, while retaining previous data
    And the supplier logs in with valid credentials
    And they navigate to the compliance reports page
    And they see the previously submitted report
    And they click the report to view it
    Then they create a supplemental report
    And the supplier edits the fuel supply data

  Scenario: The Analyst sees the original report
    Given the user is on the login page, while retaining previous data
    And the analyst logs in with valid credentials
    And they navigate to the compliance reports page
    And they see the previously submitted report
    And they click the report to view it
    Then the report is shown with the fuel supply data entered

  Scenario: The Supplier submits a supplemental report
    Given the user is on the login page, while retaining previous data
    And the supplier logs in with valid credentials
    And they navigate to the compliance reports page
    And they see the previously submitted report
    And they click the report to view it
    When the supplier accepts the agreement
    And the supplier submits the report
    Then the banner shows success

  Scenario: The Analyst sees the supplemental report
    Given the user is on the login page, while retaining previous data
    And the analyst logs in with valid credentials
    And they navigate to the compliance reports page
    And they see the previously submitted report
    And they click the report to view it
    Then the report is shown with the supplemental fuel supply data entered
