import fs from 'fs';

let content = fs.readFileSync('eslint.config.mjs', 'utf8');

const newIgnores = `globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "__mocks__/**",
    "test_e2e_simple.mjs",
    "logs/temp/*",
    "scripts/*-test.cjs",
    "test-extract.js",
    "test/**/*.js",
  ])`;

content = content.replace(/globalIgnores\(\[[^\]]+\]\)/s, newIgnores);

fs.writeFileSync('eslint.config.mjs', content);
console.log('Done');
