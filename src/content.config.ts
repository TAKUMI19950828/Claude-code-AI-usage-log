import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

export const TOOLS = ['Claude Code', 'ChatGPT', 'GitHub Copilot', 'Other'] as const;
export const CATEGORIES = [
  'コード生成',
  'リファキナリング',
  'デバッグ',
  'コードレビュー',
  '文章作成',
  'その他',
] as const;

const cases = defineCollection({
  loader: glob({ base: './src/content/cases', pattern: '**/*.md' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      // 'YYYY-MM-DD' 文字列で保持し、表示時にフォーマットする（タイムゾーンずれ回避）
      date: z.string().date(),
      tools: z.array(z.enum(TOOLS)).min(1),
      category: z.enum(CATEGORIES),
      tags: z.array(z.string()).default([]),
      summary: z.string(),
      result: z.string().optional(),
      links: z
        .array(
          z.object({
            label: z.string(),
            url: z.string(),
          }),
        )
        .default([]),
      coverImage: image().optional(),
      coverImageAlt: z.string().optional(),
      featured: z.boolean().default(false),
      draft: z.boolean().default(false),
    }),
});

export const collections = { cases };
