Feature: Fuel export schedule

  Rule: Supplier manages fuel export records

    Background: Supplier starts a new draft compliance report
      Given the compliance schedule test user is logged in with a new draft report

    @compliance-report
    Scenario Outline: creating a fuel export record
      When the supplier adds a fuel export record with fuel type "<fuelType>", fuel category "<fuelCategory>", provision "<provisionOfTheAct>", and quantity "<quantity>"
      Then the fuel export summary includes fuel type "<fuelType>"

      Examples:
        | fuelType | fuelCategory | provisionOfTheAct                              | quantity |
        | Ethanol  | Gasoline     | Default carbon intensity - section 19 (b) (ii) | 100000   |

    @compliance-report
    Scenario Outline: editing an existing fuel export record
      When the supplier adds a fuel export record with fuel type "<fuelType>", fuel category "<fuelCategory>", provision "<provisionOfTheAct>", and quantity "<initialQuantity>"
      And the supplier updates the first fuel export quantity to "<updatedQuantity>"
      Then the fuel export summary includes quantity "<formattedQuantity>"

      Examples:
        | fuelType | fuelCategory | provisionOfTheAct                              | initialQuantity | updatedQuantity | formattedQuantity |
        | Ethanol  | Gasoline     | Default carbon intensity - section 19 (b) (ii) | 100000          | 120000          | 120,000           |

    @compliance-report
    Scenario Outline: viewing the fuel export changelog
      When the supplier adds a fuel export record with fuel type "<fuelType>", fuel category "<fuelCategory>", provision "<provisionOfTheAct>", and quantity "<updatedQuantity>"
      And the supplier opens the fuel export changelog view for fuel type "<fuelType>" with original quantity "<initialQuantity>" and updated quantity "<updatedQuantity>"
      Then the fuel export changelog is shown

      Examples:
        | fuelType | fuelCategory | provisionOfTheAct                              | initialQuantity | updatedQuantity |
        | Ethanol  | Gasoline     | Default carbon intensity - section 19 (b) (ii) | 100000          | 120000          |
