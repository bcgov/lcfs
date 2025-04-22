# Performance

## Load Testing - Locust

We are using Locust for out load testing, their is currently one set of tests in
locustfile.py.

## Setup

* Install Locust `pip install locust`
* Generate a Token and set in Testing File
* Run locust from inside the performance directory
  `locust --host https://lcfs-backend-dev.apps.silver.devops.gov.bc.ca/api`
* Set Number of Desired Users
* Run
