#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
RESOURCES_DIR="$ROOT_DIR/resources"

ICON_COLOR="#22C55E"

SOURCE_SVG="$RESOURCES_DIR/icon.svg"
COLORED_SVG="$RESOURCES_DIR/icon-colored.svg"
COLORED_PNG="$RESOURCES_DIR/icon-colored.png"

if [ ! -f "$SOURCE_SVG" ]; then
  echo "Error: $SOURCE_SVG not found"
  exit 1
fi

if command -v rsvg-convert &> /dev/null; then
  CONVERTER="rsvg"
elif command -v magick &> /dev/null; then
  CONVERTER="magick"
elif command -v convert &> /dev/null; then
  CONVERTER="convert"
else
  echo "Error: need rsvg-convert or ImageMagick."
  echo "Install with:"
  echo "  macOS:  brew install librsvg   (or: brew install imagemagick)"
  echo "  Debian: sudo apt install librsvg2-bin"
  exit 1
fi

echo "Generating icon-colored.svg..."
sed "s/currentColor/$ICON_COLOR/g" "$SOURCE_SVG" > "$COLORED_SVG"

echo "Generating icon-colored.png (using $CONVERTER)..."
case "$CONVERTER" in
  rsvg)
    rsvg-convert -w 128 -h 128 "$COLORED_SVG" -o "$COLORED_PNG"
    ;;
  magick)
    magick -background transparent -density 512 -resize 128x128 "$COLORED_SVG" "$COLORED_PNG"
    ;;
  convert)
    convert -background transparent -density 512 -resize 128x128 "$COLORED_SVG" "$COLORED_PNG"
    ;;
esac

echo "Done:"
ls -la "$RESOURCES_DIR"/icon*
