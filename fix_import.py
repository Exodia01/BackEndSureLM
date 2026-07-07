content = open('lib/pdf/batchProcess.ts', 'r').read()
old_import = 'import { ensureCollection, upsertPoints } from "./qdrantStorage";'
new_import = 'import { ensureCollection, upsertPoints } from "../vector/qdrantStorage";'
content = content.replace(old_import, new_import)
open('lib/pdf/batchProcess.ts', 'w').write(content)
print('Fixed import path')
