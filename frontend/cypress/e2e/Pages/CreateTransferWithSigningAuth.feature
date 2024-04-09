Feature: Create transfer functionality with "Signing authority" role

  Rule: Paths for Transferer Organization

    Background: BCeID user logged in
      Given I am on home page logged in as "org1_bceid" user having roles
        | Transfer | Signing authority |

    @transfer
    Scenario: sign and send the draft transfer
      When I transfer "<units>" units to organization "<orgId>" of value "<pricePerUnit>" with agreement date "<agreementDate>"
      And add the "<comment>" and save as draft
      And sign and send the draft transfer
      Then I should be redirected to transactions page.

      Examples: 
        | units | orgId | pricePerUnit | agreementDate | comment      |
        |   100 |     2 |        40.00 |    2024-04-06 | test comment |

    @transfer
    Scenario: sign and send the transfer
      When I transfer "<units>" units to organization "<orgId>" of value "<pricePerUnit>" with agreement date "<agreementDate>"
      And sign and send the transfer
      Then I should be redirected to transactions page.

      Examples: 
        | units | orgId | pricePerUnit | agreementDate | comment      |
        |   150 |     2 |        80.00 |    2024-04-06 | test comment |
