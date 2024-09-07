#!/bin/bash

# Check if jq is installed
if ! [ -x "$(command -v jq)" ]; then
  echo 'Error: jq is not installed. Please install jq (https://stedolan.github.io/jq/download/).' >&2
  exit 1
fi

# Check if a filename is provided as an argument
if [ $# -eq 0 ]; then
  echo "Usage: $0 <json_file>"
  exit 1
fi

json_file=$1
temp_file=$(mktemp)

# Use jq to parse the JSON and replace `\\` with `\`
jq . $json_file &> /dev/null
if [ $? -ne 0 ]; then
  echo "Error: Failed to parse the JSON file. Please check the JSON syntax."
  exit 1
fi

jq . $json_file | sed 's/\\\\/\\/g' > $temp_file

# Replace the original JSON file with the modified content
mv $temp_file $json_file

echo "Successfully fixed $json_file"
