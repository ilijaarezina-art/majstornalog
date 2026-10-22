const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const expoDir = path.join(rootDir, '_expo');

if (!fs.existsSync(distDir)) {
  console.error('Dist folder does not exist.');
  process.exit(1);
}

// 1. Copy files recursively from dist to root
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Remove old web JS bundles in root _expo/static/js/web
const oldJsDir = path.join(expoDir, 'static', 'js', 'web');
if (fs.existsSync(oldJsDir)) {
  fs.readdirSync(oldJsDir).forEach((file) => {
    if (file.endsWith('.js')) {
      fs.unlinkSync(path.join(oldJsDir, file));
    }
  });
}

copyRecursiveSync(distDir, rootDir);

// 2. Patch index.html for relative base href & relative script src
const indexPath = path.join(rootDir, 'index.html');
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');
  if (!html.includes('<base href="/majstornalog/" />')) {
    html = html.replace('<title>MajstorNalog</title>', '<title>MajstorNalog</title>\n    <base href="/majstornalog/" />');
  }
  html = html.replace(/src="\/_expo\//g, 'src="./_expo/');
  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('Successfully synced web distribution and patched index.html for cPanel deployment.');
}
