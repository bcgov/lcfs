Feature: Other uses schedule

  Rule: Supplier manages other uses records

    Background: Supplier starts a new draft compliance report
      Given the compliance schedule test user is logged in with a new draft report

    @compliance-report
    Scenario Outline: creating an other uses record
      When the supplier adds an other uses record with fuel type "<fuelType>", fuel category "<fuelCategory>", provision "<provisionOfTheAct>", quantity "<quantitySupplied>", units "<units>", and expected use "<expectedUse>"
      Then the other uses summary includes fuel type "<fuelType>"

      Examples:
        | fuelType | fuelCategory | provisionOfTheAct                              | quantitySupplied | units | expectedUse |
        | Ethanol  | Gasoline     | Default carbon intensity - section 19 (b) (ii) | 100000           | L     | Heating oil |

    @compliance-report
    Scenario Outline: editing an existing other uses record
      When the supplier adds an other uses record with fuel type "<fuelType>", fuel category "<fuelCategory>", provision "<provisionOfTheAct>", quantity "<initialQuantity>", units "<units>", and expected use "<expectedUse>"
      And the supplier updates the first other uses quantity to "<updatedQuantity>"
      Then the other uses summary includes quantity "<formattedQuantity>"

      Examples:
        | fuelType | fuelCategory | provisionOfTheAct                              | initialQuantity | updatedQuantity | formattedQuantity | units | expectedUse |
        | Ethanol  | Gasoline     | Default carbon intensity - section 19 (b) (ii) | 100000          | 120000          | 120,000           | L     | Heating oil |

    @compliance-report
    Scenario Outline: viewing the other uses changelog
      When the supplier adds an other uses record with fuel type "<fuelType>", fuel category "<fuelCategory>", provision "<provisionOfTheAct>", quantity "<updatedQuantity>", units "<units>", and expected use "<expectedUse>"
      And the supplier opens the other uses changelog view for fuel type "<fuelType>" with original quantity "<initialQuantity>" and updated quantity "<updatedQuantity>"
      Then the other uses changelog is shown

      Examples:
        | fuelType | fuelCategory | provisionOfTheAct                              | initialQuantity | updatedQuantity | units | expectedUse |
        | Ethanol  | Gasoline     | Default carbon intensity - section 19 (b) (ii) | 100000          | 120000          | L     | Heating oil |
