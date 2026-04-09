Feature: Fuel supply schedule

  Rule: Supplier manages fuel supply records

    Background: Supplier starts a new draft compliance report
      Given the compliance schedule test user is logged in with a new draft report

    @compliance-report
    Scenario Outline: creating a fuel supply record
      When the supplier adds a fuel supply record with fuel type "<fuelType>", fuel category "<fuelCategory>", provision "<provisionOfTheAct>", and quantity "<quantity>"
      Then the fuel supply summary includes fuel type "<fuelType>"

      Examples:
        | fuelType | fuelCategory | provisionOfTheAct                              | quantity |
        | Ethanol  | Gasoline     | Default carbon intensity - section 19 (b) (ii) | 100000   |

    @compliance-report
    Scenario Outline: editing an existing fuel supply record
      When the supplier adds a fuel supply record with fuel type "<fuelType>", fuel category "<fuelCategory>", provision "<provisionOfTheAct>", and quantity "<initialQuantity>"
      And the supplier updates the first fuel supply quantity to "<updatedQuantity>"
      Then the fuel supply summary includes quantity "<formattedQuantity>"

      Examples:
        | fuelType | fuelCategory | provisionOfTheAct                              | initialQuantity | updatedQuantity | formattedQuantity |
        | Ethanol  | Gasoline     | Default carbon intensity - section 19 (b) (ii) | 100000          | 120000          | 120,000           |

    @compliance-report
    Scenario Outline: viewing the fuel supply changelog
      When the supplier adds a fuel supply record with fuel type "<fuelType>", fuel category "<fuelCategory>", provision "<provisionOfTheAct>", and quantity "<updatedQuantity>"
      And the supplier opens the fuel supply changelog view for fuel type "<fuelType>" with original quantity "<initialQuantity>" and updated quantity "<updatedQuantity>"
      Then the fuel supply changelog is shown

      Examples:
        | fuelType | fuelCategory | provisionOfTheAct                              | initialQuantity | updatedQuantity |
        | Ethanol  | Gasoline     | Default carbon intensity - section 19 (b) (ii) | 100000          | 120000          |
