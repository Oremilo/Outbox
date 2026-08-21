/**
 * Seed script: creates initial Ethereal test senders.
 *
 * Run with: npm run db:seed
 */

import { prisma } from './lib/prisma';
import { createEtherealAccount } from './lib/email-sender';

async function seed() {
  console.log('🌱 Seeding database...\n');

  // Create 2 test senders with Ethereal accounts
  const senderNames = ['Alice Outbox', 'Bob Scheduler'];

  for (const name of senderNames) {
    // Check if a sender with this name already exists
    const existing = await prisma.sender.findFirst({
      where: { name },
    });

    if (existing) {
      console.log(`  ✓ Sender "${name}" already exists (${existing.email})`);
      continue;
    }

    try {
      const ethereal = await createEtherealAccount();

      const sender = await prisma.sender.create({
        data: {
          name,
          email: ethereal.email,
          smtpUser: ethereal.smtpUser,
          smtpPass: ethereal.smtpPass,
          smtpHost: ethereal.smtpHost,
          smtpPort: ethereal.smtpPort,
        },
      });

      console.log(`  ✓ Created sender "${name}" → ${sender.email}`);
    } catch (error) {
      console.error(`  ✗ Failed to create sender "${name}":`, error);
    }
  }

  console.log('\n✅ Seeding complete');
}

seed()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
