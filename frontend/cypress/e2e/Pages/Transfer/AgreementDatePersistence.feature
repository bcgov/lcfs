Feature: Draft transfer agreement date

  @transfer
  Scenario: updating the agreement date persists when a draft is reopened
    Given the seeded org1 transfer user is logged in
    And a new draft transfer is open
    When I change the agreement date from "2024-04-06" to "2024-04-07" and save the draft
    Then the updated agreement date should persist after reopening the draft
