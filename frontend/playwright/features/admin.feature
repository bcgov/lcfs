Feature: Authenticated administration

  Background:
    Given I am signed in as an administrator

  Scenario: An administrator can open the add user form
    When I open the admin user list and choose to add a user
    Then the add user form is shown

  Scenario: An administrator can switch tabs and see each admin grid
    When I visit the user activity, login history, and audit log tabs
    Then each selected admin tab shows its grid
