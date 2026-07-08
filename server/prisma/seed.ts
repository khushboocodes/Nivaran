import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password';
import { ensureDepartmentsSeeded } from '../src/services/departments';

const prisma = new PrismaClient();

const DEMO = {
  citizen: {
    email: 'citizen@demo.nivaran.in',
    password: 'Citizen@2026',
    name: 'Demo Citizen',
    phone: '+91 90000 00001',
    city: 'Pune',
    role: 'citizen' as const,
  },
  admin: {
    email: 'admin@demo.nivaran.in',
    password: 'Admin@2026',
    name: 'Demo Admin',
    phone: null,
    city: null,
    role: 'admin' as const,
  },
};

async function ensureUser(input: typeof DEMO.citizen): Promise<{ created: boolean }> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) return { created: false };
  const passwordHash = await hashPassword(input.password);
  await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      phone: input.phone ?? undefined,
      city: input.city ?? undefined,
      role: input.role,
      passwordHash,
      language: 'en',
    },
  });
  return { created: true };
}

async function main() {
  await ensureDepartmentsSeeded();
  const citizen = await ensureUser(DEMO.citizen);
  const admin = await ensureUser(DEMO.admin);

  console.log('\n=== NIVARAN demo accounts ===');
  console.log(`Citizen: ${DEMO.citizen.email}  password: ${DEMO.citizen.password}  ${citizen.created ? '(created)' : '(already existed)'}`);
  console.log(`Admin:   ${DEMO.admin.email}    password: ${DEMO.admin.password}    ${admin.created ? '(created)' : '(already existed)'}`);
  console.log('=============================\n');
}

main()
  .catch((err) => {
    console.error('[seed] failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
