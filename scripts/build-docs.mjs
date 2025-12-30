import { promises as fs } from 'fs';
import path from 'path';

const root = process.cwd();
const docsDir = path.join(root, 'docs');
const distDir = path.join(root, 'dist');

async function rmrf(dir) {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function copyDir(src, dest) {
  const entries = await fs.readdir(src, { withFileTypes: true });
  await ensureDir(dest);
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function main() {
  // Clean docs dir
  await rmrf(docsDir);
  await ensureDir(docsDir);

  // Copy static entry files
  await fs.copyFile(path.join(root, 'index.html'), path.join(docsDir, 'index.html'));
  await fs.copyFile(path.join(root, 'styles.css'), path.join(docsDir, 'styles.css'));

  // Copy build output
  await copyDir(distDir, path.join(docsDir, 'dist'));

  // Add .nojekyll marker
  await fs.writeFile(path.join(docsDir, '.nojekyll'), '');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
