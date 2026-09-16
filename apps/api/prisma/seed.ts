import { PrismaClient, JobStatus } from '@prisma/client';

const prisma = new PrismaClient();

const jobs = [
  { title: 'Export user report CSV', type: 'export', status: JobStatus.pending },
  { title: 'Send weekly newsletter', type: 'email', status: JobStatus.pending },
  { title: 'Resize uploaded images', type: 'media', status: JobStatus.running },
  { title: 'Sync CRM contacts', type: 'sync', status: JobStatus.running },
  { title: 'Generate monthly invoice PDF', type: 'billing', status: JobStatus.completed },
  { title: 'Archive old logs', type: 'maintenance', status: JobStatus.completed },
  { title: 'Payment webhook delivery', type: 'webhook', status: JobStatus.failed },
  { title: 'Backup database snapshot', type: 'backup', status: JobStatus.failed },
];

async function main() {
  await prisma.job.deleteMany();
  for (const job of jobs) {
    await prisma.job.create({ data: job });
  }
  console.log(`Seeded ${jobs.length} jobs.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
