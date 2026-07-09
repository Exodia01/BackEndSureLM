import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const tempDir = path.join(__dirname, '..', 'logs', 'temp');
const today = new Date().toISOString().split('T')[0];
const validationReportDir = path.join(__dirname, '..', 'test', today);

console.log(`Cleanup started at ${new Date().toISOString()}`);
console.log(`Moving files from: ${tempDir}`);

if (fs.existsSync(tempDir)) {
  const files = fs.readdirSync(tempDir);
  console.log(`Found ${files.length} files in temp`);
  
  if (!fs.existsSync(validationReportDir)) {
    fs.mkdirSync(validationReportDir, { recursive: true });
    console.log(`Created validation report directory: ${validationReportDir}`);
  }

  if (files.length > 0) {
    let movedCount = 0;
    files.forEach((file) => {
      try {
        const sourcePath = path.join(tempDir, file);
        const destPath = path.join(validationReportDir, `${file.replace('.txt', '.md')}`);
        fs.renameSync(sourcePath, destPath);
        console.log(`Moved: ${file} -> ${path.basename(destPath)}`);
        movedCount++;
      } catch (err) {
        console.error(`Failed to move ${file}:`, err.message);
      }
    });
    console.log(`Successfully moved ${movedCount}/${files.length} files`);
  } else {
    console.log('No files in temp directory');
  }
} else {
  console.log('Temp directory does not exist - nothing to clean');
}

console.log('Cleanup completed');
