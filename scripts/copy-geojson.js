const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const src = path.join(rootDir, 'data', 'Sanyi_villages.geojson');
const destDir = path.join(rootDir, 'public', 'data');
const dest = path.join(destDir, 'Sanyi_villages.geojson');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

fs.copyFileSync(src, dest);
console.log('File copied successfully to: ' + dest);
