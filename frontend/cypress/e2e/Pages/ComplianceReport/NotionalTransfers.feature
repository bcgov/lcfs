Feature: Notional transfers schedule

  Rule: Supplier manages notional transfer records

    Background: Supplier starts a new draft compliance report
      Given the compliance schedule test user is logged in with a new draft report

    @compliance-report
    Scenario Outline: creating a notional transfer record
      When the supplier adds a notional transfer with legal name "<legalName>", address "<addressForService>", fuel category "<fuelCategory>", transfer type "<receivedOrTransferred>", and quantity "<quantity>"
      Then the notional transfer summary includes legal name "<legalName>"

      Examples:
        | legalName       | addressForService  | fuelCategory | receivedOrTransferred | quantity |
        | Partner Cypress | 123 Cypress Street | Diesel       | Received             | 100000   |

    @compliance-report
    Scenario Outline: editing an existing notional transfer record
      When the supplier adds a notional transfer with legal name "<legalName>", address "<addressForService>", fuel category "<fuelCategory>", transfer type "<receivedOrTransferred>", and quantity "<initialQuantity>"
      And the supplier updates the first notional transfer quantity to "<updatedQuantity>"
      Then the notional transfer summary includes quantity "<formattedQuantity>"

      Examples:
        | legalName       | addressForService  | fuelCategory | receivedOrTransferred | initialQuantity | updatedQuantity | formattedQuantity |
        | Partner Cypress | 123 Cypress Street | Diesel       | Received             | 100000          | 120000          | 120,000           |

    @compliance-report
    Scenario Outline: viewing the notional transfer changelog
      When the supplier adds a notional transfer with legal name "<legalName>", address "<addressForService>", fuel category "<fuelCategory>", transfer type "<receivedOrTransferred>", and quantity "<updatedQuantity>"
      And the supplier opens the notional transfer changelog view for "<legalName>" with original quantity "<initialQuantity>" and updated quantity "<updatedQuantity>"
      Then the notional transfer changelog is shown

      Examples:
        | legalName       | addressForService  | fuelCategory | receivedOrTransferred | initialQuantity | updatedQuantity |
        | Partner Cypress | 123 Cypress Street | Diesel       | Received             | 100000          | 120000          |
