export function chunkText(pages: string[], chunkSize: number = 500, overlap: number = 50): { content: string; metadata: { page?: number }[] }[] {
  const chunks: { content: string; metadata: { page?: number }[] }[] = [];
  
  for (const pageText of pages) {
    const matches = pageText.match(/^\[Page (\d+)\]/m);
    const pageNum = matches ? parseInt(matches[1], 10) : undefined;
    
    const words = pageText.split(/\s+/);
    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const chunkWords = words.slice(i, i + chunkSize);
      if (chunkWords.length === 0) continue;
      
      chunks.push({
        content: chunkWords.join(" "),
        metadata: [{ page: pageNum }],
      });
    }
  }
  
  return chunks;
}
