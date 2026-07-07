import re

with open('lib/pdf/batchProcess.ts', 'r') as f:
    content = f.read()

# Fix 1: Keep metadata during mapping for database storage
old_map = '''const chunksWithCategories = chunks.map(chunk => ({
    content: chunk.content,
    category: detectCategory(chunk.content) || "general",
  }));'''

new_map = '''const chunksWithMetadata = chunks.map(chunk => ({
    content: chunk.content,
    category: detectCategory(chunk.content) || "general",
    page: chunk.metadata?.[0]?.page,
  }));'''

content = content.replace(old_map, new_map)

# Fix 2: Use chunksWithMetadata in DB storage
old_db = '''   await db.$transaction(
     chunksWithCategories.map((chunk, index) =>
       db.chunk.create({
         data: {
           brochureId,
           content: chunk.content,
           chunkOrder: index,
           pageNumber: (chunk.metadata?.[0]?.page as number) || null,
           category: chunk.category,
           metadata: { original_page: chunk.metadata?.[0]?.page },
         },
       })
     )
   );'''

new_db = '''   await db.$transaction(
     chunksWithMetadata.map((chunk, index) =>
       db.chunk.create({
         data: {
           brochureId,
           content: chunk.content,
           chunkOrder: index,
           pageNumber: chunk.page || null,
           category: chunk.category,
           metadata: { original_page: chunk.page },
         },
       })
     )
   );'''

content = content.replace(old_db, new_db)

# Fix 3: Update vector storage to use chunksWithMetadata
old_vector = '''const vectorPoints: VectorPoint[] = chunksWithCategories.map((chunk, index) => ({'''
new_vector = '''const vectorPoints: VectorPoint[] = chunksWithMetadata.map((chunk, index) => ({'''

content = content.replace(old_vector, new_vector)

# Fix 4: Update metadata references in vector payload
old_payload = '''      page_number: chunk.metadata?.[0]?.page || null,'''
new_payload = '''      page_number: chunk.page || null,'''

content = content.replace(old_payload, new_payload)

with open('lib/pdf/batchProcess.ts', 'w') as f:
    f.write(content)

print("Fixed metadata references")
