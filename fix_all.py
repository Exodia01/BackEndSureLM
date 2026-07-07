import re

with open('lib/pdf/batchProcess.ts', 'r') as f:
    content = f.read()

# Fix 1: Replace all chunksWithCategories with chunksWithMetadata
content = content.replace('chunksWithCategories', 'chunksWithMetadata')

# Fix 2: Update upsertPoints to include category in vector payload (it's used for filtering)
vector_payload_old = '''payload: {
      chunk_id: `${brochureId}-chunk-${index}`,
      brochure_id: brochureId,
      document_id: metadata?.document_id,
      page_number: chunk.page || null,
      category: chunk.category,'''
# Keep this as is since it's fine

# Fix 3: Remove metadata from uploadBrochure return type - use separate response for progress
# Actually, let's keep it simple and just remove the metadata field from uploadBrochure return
old_return = '''return { 
          brochureId, 
          status: "NEW", 
          chunksCreated: result.chunksCreated,
          totalPages: result.totalPages,
          metadata: result.metadata,'''
new_return = '''return { 
          brochureId, 
          status: "NEW", 
          chunksCreated: result.chunksCreated,
          totalPages: result.totalPages,'''

content = content.replace(old_return, new_return)

with open('lib/pdf/batchProcess.ts', 'w') as f:
    f.write(content)

print('Fixed remaining issues')
