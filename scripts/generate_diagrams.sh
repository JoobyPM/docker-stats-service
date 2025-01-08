#!/usr/bin/env bash
set -e

DIR="docs/architecture/diagrams"

# Create the output directory if it doesn't exist
mkdir -p "$DIR"

# Loop through each .puml file in docs/architecture
for puml_file in docs/architecture/diagrams/*.puml; do
  # Extract base filename without extension (e.g., "components" from "components.puml")
  base_name="$(basename "$puml_file" .puml)"
  
  echo "Generating $base_name.svg from $puml_file ..."
  
  # Use -pipe to read from stdin and write to stdout
  docker run --rm -i \
    -v "$PWD":/data \
    plantuml/plantuml \
    -tsvg -pipe < "$puml_file" > "$DIR/$base_name.svg"
done

echo "Done generating PlantUML diagrams!"
