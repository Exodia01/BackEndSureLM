#!/usr/bin/env python
"""Seed chunks into DB for FTS testing"""
import sys
sys.path.insert(0, r"S:\BackEndSureLM")

from pathlib import Path

# Read extracted content
extracted_file = Path(r"S:\BackEndSureLM\pdf_extracted_content.txt")
if not extracted_file.exists():
    print("Extract PDFs first: python extract_pdfs.py")
    sys.exit(1)

content = extracted_file.read_text(encoding="utf-8")

# Split by PDF markers  
pdf_sections = content.split("=" * 80)[1:]

chunks_to_insert = []

for section in pdf_sections[:3]:
    if not section.strip():
        continue
    
    lines = section.strip().split("\n")
    filename = lines[0].strip() if lines else "Unknown"
    
    text = "\n".join(lines[2:])[:15000]
    
    words = text.split()
    chunk_size = 800
    overlap = 100
    
    i = 0
    while i < len(words):
        chunk_words = words[i:i + chunk_size]
        if not chunk_words:
            break
        
        chunk_text = " ".join(chunk_words)
        
        chunks_to_insert.append({
            "content": chunk_text,
            "chunkOrder": len(chunks_to_insert),
            "pageNumber": (i // chunk_size) + 1
        })
        
        i += chunk_size - overlap

print(f"准备插入 {len(chunks_to_insert)} 个 chunks")

import asyncio
from lib.db import db

async def seed():
    # Create a brochure
    brochure = await db.brochure.create({
        "data": {
            "basename": "test_fts_seed",
            "originalName": "seed.pdf",
            "currentPage": 0,
            "totalPages": len(chunks_to_insert),
            "status": "READY"
        }
    })
    
    print(f"Created brochure: {brochure.id[:8]}...")
    
    inserted_count = 0
    for chunk_data in chunks_to_insert:
        try:
            await db.chunk.create({
                "data": {
                    **chunk_data,
                    "brochureId": brochure.id
                }
            })
            inserted_count += 1
            
            if inserted_count % 5 == 0:
                print(f"  Inserted {inserted_count}/{len(chunks_to_insert)}...")
        except Exception as e:
            print(f"    Error: {e}")
    
    print(f"\n✓ Successfully inserted {inserted_count} chunks")
    
    # Test FTS
    print("\n" + "="*60)
    print("Testing FTS with 'waiting period'...")
    print("="*60)
    
    results = await db.$queryRaw("""
        SELECT 
            c.id as chunk_id,
            c.content,
            ts_rank(
                to_tsvector('english', coalesce(c.content, '')),
                plainto_tsquery('english', 'waiting period')
            ) as score
        FROM "Chunk" c
        WHERE to_tsvector('english', coalesce(c.content, '')) @@ plainto_tsquery('english', 'waiting period')
        ORDER BY score DESC
        LIMIT 5
    """)
    
    if results and len(results) > 0:
        print(f"\n✓ FTS FOUND {len(results)} RESULTS!")
        for row in results[:3]:
            print(f"Score: {row['score']:.4f}")
            preview = str(row.get('content', ''))[:200]
            print(f"Content: {preview}...")
    else:
        print("\n✗ No FTS results found")

asyncio.run(seed())
