#!/bin/bash
# max_attempts=3
# wait_time=15
# url=https://lcfs-dev.apps.silver.devops.gov.bc.ca/login
# code=200
if [ $(curl --output /dev/null --silent --head -X GET --retry ${max_attempts} --fail --retry-all-errors --retry-delay ${wait_time} --retry-max-time 240 -w "%{response_code}\n" ${url}) -eq ${code} ]; then
	echo "Connection Success!"
else
	echo "Failed Connection!"
        exit 1
fi