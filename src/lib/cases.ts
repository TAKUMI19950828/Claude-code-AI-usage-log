import { getCollection, type CollectionEntry } from 'astro:content';

export type CaseEntry = CollectionEntry<'cases'>;

export async function getPublishedCases(): Promise<CaseEntry[]> {
  const cases = await getCollection('cases', ({ data }) => !data.draft || import.meta.env.DEV);
  return cases.sort((a, b) => b.data.date.localeCompare(a.data.date));
}

export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${year}年${month}月${day}日`;
}
