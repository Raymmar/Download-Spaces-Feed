#!/bin/bash

# Script to import active user data from CSV
# Usage: ./scripts/import_users.sh path/to/csv/file.csv

if [ -z "$1" ]; then
  echo "Error: Please provide a path to the CSV file"
  echo "Usage: ./scripts/import_users.sh path/to/csv/file.csv"
  exit 1
fi

# Run the import script with the provided CSV file
npx tsx scripts/import_active_users.ts "$1"