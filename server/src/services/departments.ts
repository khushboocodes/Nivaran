import { prisma } from '../db';

const DEFAULTS = [
  'Municipal Corporation',
  'Water Supply Board',
  'Electricity Department',
  'Public Works Department',
  'Sanitation Department',
  'Healthcare Department',
];

/**
 * Ensure the canonical departments exist. Called lazily on the first
 * write that needs a department FK; idempotent.
 */
export async function ensureDepartmentsSeeded(): Promise<void> {
  const count = await prisma.department.count();
  if (count > 0) return;
  await prisma.department.createMany({ data: DEFAULTS.map((name) => ({ name })) });
}

/**
 * Map a free-text category to a department name. Falls through to a
 * keyword router when no AI provider is configured.
 */
export function categoryToDepartment(category: string): string {
  const c = category.toLowerCase();
  if (c.includes('water') || c.includes('drainage') || c.includes('sewage')) return 'Water Supply Board';
  if (c.includes('electric') || c.includes('light')) return 'Electricity Department';
  if (c.includes('road') || c.includes('infrastructure') || c.includes('pothole')) return 'Public Works Department';
  if (c.includes('sanitation') || c.includes('garbage') || c.includes('waste')) return 'Sanitation Department';
  if (c.includes('health')) return 'Healthcare Department';
  return 'Municipal Corporation';
}

export async function resolveDepartmentByCategory(category: string): Promise<string> {
  await ensureDepartmentsSeeded();
  const name = categoryToDepartment(category);
  const dept = await prisma.department.findUnique({ where: { name } });
  if (dept) return dept.id;
  // Fall back to creating the matched department if for any reason it's
  // missing (e.g. the seed list shrunk in a future migration).
  const created = await prisma.department.upsert({
    where: { name },
    create: { name },
    update: {},
  });
  return created.id;
}
