#!/bin/bash

# Test runner for UserPravah
# This script should be executed from the 'graphgeneratorts' directory.

# Ensure execution stops on first error
set -e

# Define directories and files
TESTS_DIR="./tests"
MOCK_PROJECTS_DIR="${TESTS_DIR}/mock-projects"
EXPECTED_OUTPUTS_DIR="${TESTS_DIR}/expected-outputs"
GENERATED_DOT_FILE="./user-flows.dot" # Output location of the analyze script
GENERATED_PNG_FILE="./user-flows.png"

# Function to run a single test case
run_test_case() {
  local project_name="$1"
  local project_path="${MOCK_PROJECTS_DIR}/${project_name}"
  local expected_dot_file="${EXPECTED_OUTPUTS_DIR}/${project_name}.dot"

  echo "-------------------------------------"
  echo "▶️ Running test for: ${project_name}"
  echo "-------------------------------------"

  # Check if mock project exists
  if [ ! -d "${project_path}" ]; then
    echo "❌ ERROR: Mock project directory not found: ${project_path}"
    return 1
  fi
  # Check if expected output exists
  if [ ! -f "${expected_dot_file}" ]; then
    echo "❌ ERROR: Expected output file not found: ${expected_dot_file}"
    echo "         Please create it first."
    return 1
  fi

  # Run the analyzer
  echo "  ⚙️ Analyzing mock project at: ${project_path}"
  if npm run analyze -- "${project_path}"; then
    echo "  ✅ Analyzer script completed."
  else
    echo "  ❌ ERROR: Analyzer script failed for ${project_name}."
    return 1
  fi

  # Check if dot file was generated
  if [ ! -f "${GENERATED_DOT_FILE}" ]; then
    echo "  ❌ ERROR: ${GENERATED_DOT_FILE} was not generated for ${project_name}."
    return 1
  fi
  echo "  📄 Generated DOT file: ${GENERATED_DOT_FILE}"

  # Compare the generated .dot file with the expected .dot file
  echo "  🔍 Comparing generated DOT with expected: ${expected_dot_file}"
  if diff -u "${GENERATED_DOT_FILE}" "${expected_dot_file}"; then
    echo "  🎉 SUCCESS: Output for ${project_name} matches expected."
  else
    echo "  ❌ FAILURE: Output for ${project_name} does not match expected."
    echo "     To update the expected output, run:"
    echo "     cp ${GENERATED_DOT_FILE} ${expected_dot_file}"
    # return 1 # Optionally, make the script exit on first test failure
  fi

  # Clean up generated files for the next test
  echo "  🧹 Cleaning up generated files..."
  rm -f "${GENERATED_DOT_FILE}"
  if [ -f "${GENERATED_PNG_FILE}" ]; then
    rm -f "${GENERATED_PNG_FILE}"
  fi
  echo ""
}

# --- Define Test Cases Here ---
# Add project names to this array to run them
TEST_PROJECTS=("simple-app" "lazy-load-app")
# TEST_PROJECTS=("simple-app" "lazy-load-app" "redirect-app") # Example for more tests

# --- Run Tests ---
total_tests=${#TEST_PROJECTS[@]}
if [ "$total_tests" -eq 0 ]; then
  echo "🤷 No test cases defined in TEST_PROJECTS array. Exiting."
  exit 0
fi

echo "🚀 Starting UserPravah Test Suite..."
echo "Found ${total_tests} test case(s) to run."

for project in "${TEST_PROJECTS[@]}"; do
  run_test_case "${project}"
done

echo "-------------------------------------"
echo "✅ All defined tests completed."
echo "-------------------------------------"

exit 0 