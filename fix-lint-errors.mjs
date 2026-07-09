import { readFileSync, writeFileSync } from 'fs';

// Fix Sidebar.tsx - move function before useEffect
let sidebar = readFileSync('components/dashboard/Sidebar.tsx', 'utf-8');
const sLines = sidebar.split('\n');

const newSLines = [];
for (let i = 0; i < sLines.length; i++) {
    // Remove the first useEffect that calls fetchLeads
    if (i >= 65 && i <= 70) continue;
    // Insert before line 66
    if (i === 65) {
        newSLines.push('');
        newSLines.push('  const fetchLeads = async () => {');
        newSLines.push('    try {');
        newSLines.push('      const res = await fetch("/api/leads");');
        newSLines.push('      const json = await res.json();');
        newSLines.push('      if (json.success) {');
        newSLines.push('        setLeads(');
        newSLines.push('          json.data.map((l: any) => ({');
        newSLines.push('            id: l.id,');
        newSLines.push('            householdName: l.householdName,');
        newSLines.push('            lastMessage: l.notes ?? "New conversation",');
        newSLines.push('            time: new Date(l.createdAt).toLocaleTimeString("en-IN", {');
        newSLines.push('              hour: "2-digit",');
        newSLines.push('              minute: "2-digit",');
        newSLines.push('            }),');
        newSLines.push('            unread: 0,');
        newSLines.push('          }))');
        newSLines.push('        );');
        newSLines.push('      }');
        newSLines.push('    } catch { console.error("Failed to fetch leads"); }');
        newSLines.push('    finally { setLoading(false); }');
        newSLines.push('  };');
        newSLines.push('');
        newSLines.push('  useEffect(() => { fetchLeads(); }, []);');
        continue;
    }
    // Skip the old useEffect block
    if (i === 65) {
        i = 74; // skip to line after useEffect
        continue;
    }
    newSLines.push(sLines[i]);
}

writeFileSync('components/dashboard/Sidebar.tsx', newSLines.join('\n'));
console.log('Fixed Sidebar!');
