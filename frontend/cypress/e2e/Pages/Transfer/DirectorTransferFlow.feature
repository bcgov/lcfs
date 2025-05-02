Feature: Director Transfer Flow

  Background: BCeID users have necessary roles
    Given bceid transfer accounts are setup with roles

  @transfer
  Scenario: Director Records transfer
    When I transfer "<units>" units to organization "<orgId>" of value "<pricePerUnit>" with agreement date "<agreementDate>"
    And sign and send the transfer
    And I logout
    And I login as receiving org and submit
    And I logout
    And I login as analyst and recommend
    And I logout
    And I login as director and records transfer
    Then I should be redirected to transactions page and transfer should have status "Recorded".

    Examples:
      | units | orgId | pricePerUnit | agreementDate | comment      |
      |   100 |     2 |        40.99 |    2024-04-06 | test comment |

  @transfer
  Scenario: Director Refuses transfer
    When I transfer "<units>" units to organization "<orgId>" of value "<pricePerUnit>" with agreement date "<agreementDate>"
    And sign and send the transfer
    And I logout
    And I login as receiving org and submit
    And I logout
    And I login as analyst and recommend
    And I logout
    And I login as director and refuse transfer
    Then I should be redirected to transactions page and transfer should have status "Refused".

    Examples:
      | units | orgId | pricePerUnit | agreementDate | comment      |
      |   100 |     2 |        40.99 |    2024-04-06 | test comment |
