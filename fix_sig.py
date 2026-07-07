content = open('lib/pdf/batchProcess.ts', 'r').read()

# Fix the broken signature (remove ": ProcessImmediately" and add parameter name)
old_broken = '''  : ProcessImmediately: boolean = true'''
new_fixed = '''  processImmediately: boolean = true'''

content = content.replace(old_broken, new_fixed)

open('lib/pdf/batchProcess.ts', 'w').write(content)
print('Fixed function signature')
