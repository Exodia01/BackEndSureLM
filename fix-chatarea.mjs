import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('components/dashboard/ChatArea.tsx', 'utf-8');
const lines = content.split('\n');

// Find loadAll definitions and textareaRef
const loadAllLines = [];
lines.forEach((l, i) => {
    if (l.trim().startsWith('const loadAll')) {
        loadAllLines.push(i);
    }
});

console.log('loadAll at lines:', loadAllLines.map(l => l+1));

// We want to keep the SECOND loadAll (line 210-based index = 211)
// And add useEffect before it

// Keep first part up to textareaRef line (178, so keep 0-179)
const newLines = lines.slice(0, 179);

// Add useEffect
newLines.push('');
newLines.push('  useEffect(() => {');
newLines.push('    setMessages([]);');
newLines.push('    setInput("");');
newLines.push('    setLoadingHistory(true);');
newLines.push('    setIssuedPolicies(new Set());');
newLines.push('    setStreamingId(null);');
newLines.push('    loadAll();');
newLines.push('  }, [lead.id]);');

// Add the SECOND loadAll function (starting from line 210, index 210)
newLines.push(lines[210]);
newLines.push(...lines.slice(211));

const newContent = newLines.join('\n');

writeFileSync('components/dashboard/ChatArea.tsx', newContent);
console.log('Fixed ChatArea!');
