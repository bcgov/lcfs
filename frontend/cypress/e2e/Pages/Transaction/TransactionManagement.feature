Feature: Transaction Management

  Scenario: Government Analyst saves a draft initiative agreement
    Given the analyst logs in with valid credentials
    And the analyst navigates to the transactions page
    And the analyst starts a new initiative agreement transaction
    And the analyst enters "<units>" units to organization "<orgId>" with effective date "<effectiveDate>" and comment "<comment>"
    And the analyst saves the draft transaction  
    And a success message for saving draft is displayed
    Then the draft transaction is in edit mode

    Examples:
      | units | orgId | effectiveDate | comment      |
      |   100 |     1 |    2024-04-06 | test comment |

  Scenario: Analyst recommends the draft initiative agreement
    Given the analyst logs in with valid credentials
    When the analyst navigates to the transactions page
    And the analyst selects a transaction
    And the analyst recommends the transaction
    Then a success message for recommendation is displayed

  Scenario Outline: Director approves a recommended initiative agreement
    Given the director is on the login page
    When the director logs in with valid credentials
    And the director selects a recommended transaction
    And the director approves the transaction
    Then a success message for approval is displayed
