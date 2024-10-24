Feature: Create transfer functionality with transfer only role

  Rule: Paths for Transferer Organization

    Background: BCeID user logged in
      Given I am on home page logged in as "org1_bceid" user having roles
        | Transfer | Manage Users |

    @transfer
    Scenario: creating a draft transfer
      When I transfer "<units>" units to organization "<orgId>" of value "<pricePerUnit>" with agreement date "<agreementDate>"
      And add the "<comment>" and save as draft
      Then I should see a draft transfer with "<units>" units having cost of "<pricePerUnit>" per unit sent to organization "<orgId>".

      Examples: 
        | units | orgId | pricePerUnit | agreementDate | comment      |
        |   100 |     2 |        40.99 |    2024-04-06 | test comment |

    @transfer
    Scenario: delete a draft transfer
      When I transfer "<units>" units to organization "<orgId>" of value "<pricePerUnit>" with agreement date "<agreementDate>"
      And add the "<comment>" and save as draft
      And delete the transfer
      Then I should be redirected to transactions page.

      Examples: 
        | units | orgId | pricePerUnit | agreementDate | comment      |
        |   100 |     2 |        40.99 |    2024-04-06 | test comment |
