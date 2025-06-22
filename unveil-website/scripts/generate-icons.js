// Simple script to create placeholder PWA icons
// In production, replace with actual brand icons

const fs = require('fs');
const path = require('path');

const sizes = [16, 32, 72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, '../public/icons');

// Create icons directory if it doesn't exist
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Create SVG template for Unveil icon
const createSVGIcon = (size) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#fb7185;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#a855f7;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#gradient)"/>
  <g transform="translate(${size * 0.25}, ${size * 0.25})">
    <path d="M${size * 0.125} ${size * 0.25} C${size * 0.125} ${size * 0.1} ${size * 0.225} 0 ${size * 0.375} 0 C${size * 0.525} 0 ${size * 0.625} ${size * 0.1} ${size * 0.625} ${size * 0.25} C${size * 0.625} ${size * 0.35} ${size * 0.55} ${size * 0.425} ${size * 0.45} ${size * 0.45} L${size * 0.375} ${size * 0.5} L${size * 0.3} ${size * 0.45} C${size * 0.2} ${size * 0.425} ${size * 0.125} ${size * 0.35} ${size * 0.125} ${size * 0.25} Z" fill="white"/>
  </g>
</svg>`;
};

// Generate all icon sizes
sizes.forEach(size => {
  const svg = createSVGIcon(size);
  const filename = `icon-${size}x${size}.png`;
  const svgFilename = `icon-${size}x${size}.svg`;
  
  // Write SVG file (can be converted to PNG later)
  fs.writeFileSync(path.join(iconsDir, svgFilename), svg);
  
  console.log(`Generated ${svgFilename}`);
});

console.log('Icon generation complete!');
console.log('Note: SVG files created. For production, convert to PNG using an image processor.'); 