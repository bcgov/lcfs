Feature: Public credit calculator and calculation data

  Background:
    Given calculator API responses are stubbed

  Scenario: The calculator loads without authentication
    When I open the credit calculator
    Then the calculator page is public and accessible

  Scenario: The calculator description reflows at narrow widths
    When I open the credit calculator
    Then the calculator description fits at zoom-equivalent widths

  Scenario: Calculator selections cascade through fuel details
    When I choose a compliance year, fuel category, and fuel type
    Then the end use and provision are populated

  Scenario: The calculator derives compliance units from quantity
    When I calculate compliance units from the default quantity
    Then the quantity and compliance units are shown

  Scenario: The calculator derives quantity from compliance units
    When I reverse-calculate quantity from compliance units
    Then the calculated quantity is shown

  Scenario: The calculator accepts custom carbon intensity
    When I calculate with a custom carbon intensity
    Then the custom calculation result is shown

  Scenario: Calculation data loads without authentication
    When I open the calculation data page
    Then the public reference data is displayed accessibly

  Scenario: The calculation data description reflows at narrow widths
    When I open the calculation data page
    Then the calculation data description fits at zoom-equivalent widths

  Scenario: The calculation data table shows calculation reference columns
    When I open the calculation data page
    Then the CI, TCI, EER, and energy density columns are visible
