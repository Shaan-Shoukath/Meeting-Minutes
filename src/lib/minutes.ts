import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

marked.setOptions({
  mangle: false,
  headerIds: false,
});

const minutesDir = fileURLToPath(new URL('../../minutes', import.meta.url));

type MinuteSummary = {
  slug: string;
  title: string;
  excerpt: string;
  dateLabel: string;
};

type MinuteDetail = MinuteSummary & {
  html: string;
};

const toSlug = (filename: string) => filename.replace(/\.md$/i, '');

const toDateLabel = (slug: string) => slug;

const extractTitle = (content: string, slug: string) => {
  const match = content.match(/^#\s+(.+)$/m);
  if (match?.[1]) {
    return match[1].trim();
  }

  return slug.replace(/-/g, ' ');
};

const extractExcerpt = (content: string) => {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (line.startsWith('#')) continue;
    return line.replace(/\[(.*?)\]\(.*?\)/g, '$1').slice(0, 160);
  }

  return 'Meeting minutes.';
};

const getMarkdownFiles = async () => {
  const entries = await fs.readdir(minutesDir, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith('.md'));
};

export const getMinutesList = async (): Promise<MinuteSummary[]> => {
  const files = await getMarkdownFiles();
  const minutes = await Promise.all(
    files.map(async (file) => {
      const slug = toSlug(file.name);
      const content = await fs.readFile(path.join(minutesDir, file.name), 'utf8');
      return {
        slug,
        title: extractTitle(content, slug),
        excerpt: extractExcerpt(content),
        dateLabel: toDateLabel(slug),
      };
    })
  );

  return minutes.sort((a, b) => b.slug.localeCompare(a.slug));
};

export const getMinuteBySlug = async (slug: string): Promise<MinuteDetail | null> => {
  try {
    const content = await fs.readFile(path.join(minutesDir, `${slug}.md`), 'utf8');
    return {
      slug,
      title: extractTitle(content, slug),
      excerpt: extractExcerpt(content),
      dateLabel: toDateLabel(slug),
      html: marked.parse(content),
    };
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const code = (error as { code?: string }).code;
      if (code === 'ENOENT') {
        return null;
      }
    }
    throw error;
  }
};
