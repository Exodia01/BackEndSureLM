content = open('lib/pdf/batchProcess.ts', 'r').read()

old_code = '''    await db.brochure.updateMany({
      where: { basename, id: { ne: prevVersion.id } },
      data: { status: "ARCHIVED" },
    });'''

new_code = '''    // Archive all other brochures with same basename except current
    const brochuresToArchive = await db.brochure.findMany({
      where: { basename, id: { not: prevVersion.id } },
    });
    
    if (brochuresToArchive.length > 0) {
      await db.brochure.updateMany({
        where: { id: { in: brochuresToArchive.map(b => b.id) } },
        data: { status: "ARCHIVED" },
      });
    }'''

content = content.replace(old_code, new_code)

open('lib/pdf/batchProcess.ts', 'w').write(content)
print('Fixed Prisma query')
