import { prisma } from './prisma';

/** Numatytosios kategorijos — pasėjamos kiekvienam vartotojui pirmo užklausimo metu */
export const DEFAULT_CATEGORIES = [
  { code: 'MAISTAS',   label: 'Maistas',     emoji: '🍽️', color: '#a04d2e', soft: '#ecd0bf', sortOrder: 0 },
  { code: 'KURAS',     label: 'Kuras',       emoji: '⛽', color: '#4a6a8a', soft: '#d4dde6', sortOrder: 1 },
  { code: 'RUBAI',     label: 'Rūbai',       emoji: '👗', color: '#8a5258', soft: '#e8d2d4', sortOrder: 2 },
  { code: 'NEBUTINOS', label: 'Nebūtinos',   emoji: '🛍️', color: '#5b5a8c', soft: '#dadae6', sortOrder: 3 },
  { code: 'BOLT_WOLT', label: 'Bolt / Wolt', emoji: '🛵', color: '#2e6a7a', soft: '#d2e2e6', sortOrder: 4 },
  { code: 'KITOS',     label: 'Kitos',       emoji: '📦', color: '#a07d2e', soft: '#eddfbc', sortOrder: 5 },
];

/** Užtikrina, kad vartotojas turi kategorijas (lazy seed) ir grąžina jas */
export async function ensureCategories(userId: string) {
  const count = await prisma.category.count({ where: { userId } });
  if (count === 0) {
    await prisma.category.createMany({
      data: DEFAULT_CATEGORIES.map(c => ({ ...c, userId, isDefault: true })),
    });
  }
  return prisma.category.findMany({
    where: { userId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
}

/** Ar kategorijos kodas galioja šiam vartotojui (aktyvi, nearchyvuota) */
export async function isValidCategory(userId: string, code: string): Promise<boolean> {
  await ensureCategories(userId);
  const cat = await prisma.category.findUnique({
    where: { userId_code: { userId, code } },
  });
  return !!cat && !cat.archived;
}

/** Sugeneruoja unikalų kodą iš pavadinimo (lietuviškos raidės → ASCII) */
export async function generateCode(userId: string, label: string): Promise<string> {
  const map: Record<string, string> = {
    ą: 'a', č: 'c', ę: 'e', ė: 'e', į: 'i', š: 's', ų: 'u', ū: 'u', ž: 'z',
  };
  let base = label
    .toLowerCase()
    .replace(/[ąčęėįšųūž]/g, ch => map[ch] || ch)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
    .slice(0, 20);
  if (!base) base = 'CAT';

  let code = base;
  let i = 2;
  while (await prisma.category.findUnique({ where: { userId_code: { userId, code } } })) {
    code = `${base}_${i}`;
    i++;
  }
  return code;
}
