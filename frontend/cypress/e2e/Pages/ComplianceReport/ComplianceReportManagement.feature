Feature: Compliance Report Management

  Scenario: Supplier creates a draft report and submits it
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
    Given the user is on the login page, while retaining previous data
    And the analyst logs in with valid credentials
    And they navigate to the compliance reports page
    Then they see the previously submitted report

  Scenario: Supplier enters data & submits an annual compliance report
    Given the user is on the login page
    And the supplier logs in with valid credentials
    And they navigate to the compliance reports page
    And the supplier creates a new compliance report
    Then the compliance report introduction is shown
    When the supplier starts entering data into each schedules
      | scheduleLabel         | dataFilePath                       |
      | Supply of fuel        | report-data/fuel-supply-data       |
      | FSE                   | report-data/fse-data               |
      | Allocation agreements | report-data/allocation-agrmt-data  |
      | Notional transfers    | report-data/notional-transfer-data |
      | Fuels for other use   | report-data/fuels-other-use-data   |
      # | Exporting fuel        | report-data/exporting-fuel-data    |
    When the supplier accepts the agreement
    And the supplier submits the report
    Then the banner shows success