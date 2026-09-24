import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { expect, it } from 'vitest';

it('keeps client prototype imports outside transaction, wallet, receipt, and portfolio services', () => {
  const directory = fileURLToPath(new URL('.', import.meta.url));
  const allowed = new Set([
    'react',
    'next/navigation',
    'next/image',
    'react-responsive',
    'recharts',
    '@/components/info-section',
    '@/app/(dashboard)/vaults/[slug]/deposit-info/deposit-about',
    '@/app/(dashboard)/vaults/[slug]/deposit-info/deposit-contact',
    '@/app/(dashboard)/vaults/[slug]/deposit-info/deposit-documents',
    'zod',
    '@/components/container',
    '@/components/page'
  ]);
  for (const file of readdirSync(directory)) {
    if (!/\.tsx?$/.test(file) || file.includes('.test.') || file === 'enabled.ts') continue;
    const source = ts.createSourceFile(
      file,
      readFileSync(`${directory}/${file}`, 'utf8'),
      ts.ScriptTarget.Latest,
      true
    );
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const importPath = statement.moduleSpecifier.text;
      expect(
        importPath.startsWith('./') || importPath.startsWith('@zivoe/ui/') || allowed.has(importPath),
        `${file} imports ${importPath}`
      ).toBe(true);
    }
  }
});
