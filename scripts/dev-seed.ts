import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    // Create a test workspace
    const workspace = await prisma.workspace.upsert({
      where: { teamId: 'T_TEST123' },
      create: {
        teamId: 'T_TEST123',
        defaultChannelId: 'C_GENERAL',
        timezone: 'Asia/Kolkata',
        cron: '30 9 * * *',
        summaryEnabled: true,
      },
      update: {},
    });

    console.log('✅ Created workspace:', workspace.id);

    // Create test members
    const userIds = ['U_ALICE', 'U_BOB', 'U_CHARLIE'];

    for (const userId of userIds) {
      await prisma.member.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: workspace.id,
            userId,
          },
        },
        create: {
          workspaceId: workspace.id,
          userId,
          optedIn: true,
        },
        update: {},
      });
    }

    console.log(`✅ Created ${userIds.length} members`);

    // Create a test standup
    const today = new Date().toISOString().split('T')[0];
    const standup = await prisma.standup.upsert({
      where: {
        workspaceId_date: {
          workspaceId: workspace.id,
          date: today,
        },
      },
      create: {
        workspaceId: workspace.id,
        channelId: workspace.defaultChannelId,
        date: today,
        startedAt: new Date(),
      },
      update: {},
    });

    console.log('✅ Created standup:', standup.id);

    // Create test entries
    const entries = [
      {
        userId: 'U_ALICE',
        yesterday: 'Implemented user authentication',
        today: 'Working on API endpoints',
        blockers: null,
      },
      {
        userId: 'U_BOB',
        yesterday: 'Fixed database migrations',
        today: 'Setting up CI/CD pipeline',
        blockers: 'Need AWS credentials',
      },
      {
        userId: 'U_CHARLIE',
        yesterday: 'Designed new landing page',
        today: 'Implementing responsive layout',
        blockers: null,
      },
    ];

    for (const entry of entries) {
      await prisma.entry.upsert({
        where: {
          standupId_userId: {
            standupId: standup.id,
            userId: entry.userId,
          },
        },
        create: {
          standupId: standup.id,
          userId: entry.userId,
          yesterday: entry.yesterday,
          today: entry.today,
          blockers: entry.blockers,
        },
        update: {},
      });
    }

    console.log(`✅ Created ${entries.length} entries`);

    console.log('🎉 Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seed();

