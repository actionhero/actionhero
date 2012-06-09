#!/bin/bash
# I am an example curl command to query the API for the list of actions
echo "Starting Request..."
echo ""
curl "http://127.0.0.1:8080/api/" -d "action=actionsView" | python -mjson.tool
echo ""