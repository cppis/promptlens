#!/bin/bash
# PromptLens — Chrome Extension Build Script
# Builds Svelte app into extension-dist/ ready for chrome://extensions load

set -e

echo "🔨 Building PromptLens Chrome Extension..."

# 1. Build with extension config
npx vite build --config vite.extension.config.js

# 2. Copy static extension files
cp src/extension/manifest.json extension-dist/
cp src/extension/background.js extension-dist/

# 3. Copy icons (reuse from chrome-extension prototype)
mkdir -p extension-dist/icons
if [ -d "../chrome-extension/icons" ]; then
  cp ../chrome-extension/icons/*.png extension-dist/icons/
  echo "✅ Icons copied from chrome-extension"
else
  # Generate placeholder icons
  echo "⚠ No icons found, generating placeholders..."
  python3 -c "
from PIL import Image, ImageDraw
for size in [16, 48, 128]:
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([1,1,size-2,size-2], radius=size//6, fill='#7c3aed')
    cx, cy = size//2, size//2
    r = size//4
    draw.polygon([(cx,cy-r),(cx+r,cy),(cx,cy+r),(cx-r,cy)], fill='white')
    img.save(f'extension-dist/icons/icon{size}.png')
  "
fi

echo ""
echo "✅ Extension built to extension-dist/"
echo ""
echo "📦 Contents:"
ls -la extension-dist/
echo ""
echo "🚀 To install:"
echo "   1. Open chrome://extensions"
echo "   2. Enable 'Developer mode'"
echo "   3. Click 'Load unpacked'"
echo "   4. Select the extension-dist/ folder"
