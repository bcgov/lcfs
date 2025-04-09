Feature: Fuel Supply Schedule

  Scenario: Supplier enters a complex fuel supply scenario
    Given the user is on the login page
    And the supplier logs in with valid credentials
    And they navigate to the compliance reports page
    And the supplier creates a new compliance report
    Then the compliance report introduction is shown
    When the supplier starts entering data into each schedules
      | scheduleLabel  | dataFilePath                         | asTestCase |
      | Supply of fuel | report-data/fuel-supply-complex-data | true       |
    When the supplier accepts the agreement
    And the supplier submits the report
    Then the banner shows success