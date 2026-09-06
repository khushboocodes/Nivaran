/**
 * Create one officer per department, and attach any pre-existing officer
 * account that has no department.
 *
 * WHY THIS EXISTS
 * ---------------
 * Two problems, one cause. No staff account in the database carried a
 * `departmentId` — not even the demo officer — which meant:
 *
 *   - the admin Users page, scoped to a department, correctly returned zero
 *     rows for every department, because `departmentId` is null for citizens by
 *     definition and was null for staff by accident. A filter that is right and
 *     always empty reads as a broken page.
 *
 *   - the officer department firewall was unexercised. `scopedWhere` confines an
 *     officer to their own department, and an officer with no department is
 *     deliberately shown nothing. With no departmental officer to sign in as,
 *     that behaviour could not be demonstrated at all.
 *
 * Idempotent: existing accounts keep their password and are only given a
 * department if they lack one, so re-running never resets a credential someone
 * is already using.
 *
 *   npm --prefix server run seed:staff
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password';
import { ensureDepartmentsSeeded } from '../src/services/departments';

const prisma = new PrismaClient();

/** Shared password for the departmental demo officers. */
const OFFICER_PASSWORD = 'Officer@2026';

/**
 * Local part of the login for each department.
 *
 * Keyed by department *name* because that is what `ensureDepartmentsSeeded`
 * guarantees; ids are generated and differ between databases.
 */
const OFFICER_BY_DEPARTMENT: Record<string, { local: string; name: string }> = {
  'Water Supply Board': { local: 'officer.water', name: 'Water Supply Officer' },
  'Electricity Department': { local: 'officer.electricity', name: 'Electricity Officer' },
  'Public Works Department': { local: 'officer.works', name: 'Public Works Officer' },
  'Sanitation Department': { local: 'officer.sanitation', name: 'Sanitation Officer' },
  'Healthcare Department': { local: 'officer.health', name: 'Healthcare Officer' },
  'Municipal Corporation': { local: 'officer.municipal', name: 'Municipal Officer' },
};

async function main() {
  await ensureDepartmentsSeeded();
  const departments = await prisma.department.findMany({ select: { id: true, name: true } });

  const rows: string[] = [];

  for (const dept of departments) {
    const spec = OFFICER_BY_DEPARTMENT[dept.name];
    if (!spec) {
      rows.push(`  (skipped) ${dept.name} — no officer defined for this department`);
      continue;
    }
    const email = `${spec.local}@demo.nivaran.in`;
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, departmentId: true },
    });

    if (!existing) {
      await prisma.user.create({
        data: {
          email,
          name: spec.name,
          role: 'officer',
          passwordHash: await hashPassword(OFFICER_PASSWORD),
          language: 'en',
          department: { connect: { id: dept.id } },
        },
      });
      rows.push(`  created  ${email.padEnd(38)} ${dept.name}`);
      continue;
    }

    if (existing.departmentId === dept.id) {
      rows.push(`  ok       ${email.padEnd(38)} ${dept.name}`);
    } else {
      // Only the department is corrected. The password is left untouched.
      await prisma.user.update({
        where: { id: existing.id },
        data: { department: { connect: { id: dept.id } } },
      });
      rows.push(`  attached ${email.padEnd(38)} ${dept.name}`);
    }
  }

  // Any other officer left without a department would see nothing at all, which
  // looks like a bug rather than a policy. Park them in Municipal Corporation,
  // the catch-all that `categoryToDepartment` already routes to.
  const orphans = await prisma.user.findMany({
    where: { role: 'officer', departmentId: null },
    select: { id: true, email: true },
  });
  if (orphans.length > 0) {
    const fallback = departments.find((d) => d.name === 'Municipal Corporation');
    if (fallback) {
      for (const o of orphans) {
        await prisma.user.update({
          where: { id: o.id },
          data: { department: { connect: { id: fallback.id } } },
        });
        rows.push(`  attached ${o.email.padEnd(38)} ${fallback.name} (was unassigned)`);
      }
    }
  }

  console.log('\n=== NIVARAN departmental officers ===');
  rows.forEach((r) => console.log(r));
  console.log(`\n  password for all created officers: ${OFFICER_PASSWORD}`);
  console.log('  Each officer sees only their own department, everywhere in the console.');
  console.log('=====================================\n');
}

main()
  .catch((err) => {
    console.error('[seed:staff] failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
