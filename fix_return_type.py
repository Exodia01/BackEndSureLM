content = open('lib/pdf/batchProcess.ts', 'r').read()

# Fix the return type to include optional chunksCreated and totalPages
old_sig = '''processImmediately: boolean = true
): Promise<{ brochureId: string; status: "NEW" | "VERSION"; message?: string }> {'''

new_sig = ''': ProcessImmediately: boolean = true
): Promise<{ brochureId: string; status: "NEW" | "VERSION"; message?: string; chunksCreated?: number; totalPages?: number }> {'''

content = content.replace(old_sig, new_sig)

open('lib/pdf/batchProcess.ts', 'w').write(content)
print('Fixed return type')
