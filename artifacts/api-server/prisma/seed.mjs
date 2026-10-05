import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
try {
  const plans = [
    {id: "starter", name: "الخطة المجانية", description: "مدة العقد 180 يومًا وربح يومي 0.50 USDT. يتطلب توثيق الحساب إيداع 4 USDT لمنع إنشاء أكثر من حساب، مع مراجعة الإيصال.", annualPriceCents: 0, dailyTasks: 0, taskRewardCents: 0, dailyProfitCents: 50, active: true, configured: true},
    {id: "professional", name: "طموح", description: "خطة عضوية سنوية بقيمة أساسية.", annualPriceCents: 2400, dailyTasks: 0, taskRewardCents: 0, dailyProfitCents: 100, active: true, configured: true},
    {id: "elite", name: "تميّز", description: "تجربة عضوية سنوية بمستوى أعلى.", annualPriceCents: 4900, dailyTasks: 0, taskRewardCents: 0, dailyProfitCents: 200, active: true, configured: true},
    {id: "advanced", name: "احتراف", description: "مستوى عضوية سنوي متقدم.", annualPriceCents: 10000, dailyTasks: 0, taskRewardCents: 0, dailyProfitCents: 400, active: true, configured: true},
    {id: "leadership", name: "ريادة", description: "خطة عضوية سنوية بقيمة أعلى.", annualPriceCents: 24500, dailyTasks: 0, taskRewardCents: 0, dailyProfitCents: 900, active: true, configured: true},
    {id: "premium", name: "نخبة", description: "خطة عضوية سنوية بمزايا مالية أعلى.", annualPriceCents: 45000, dailyTasks: 0, taskRewardCents: 0, dailyProfitCents: 1800, active: true, configured: true},
    {id: "summit", name: "قمة", description: "أعلى مستويات العضوية السنوية.", annualPriceCents: 95000, dailyTasks: 0, taskRewardCents: 0, dailyProfitCents: 3500, active: true, configured: true},
  ];
  for (const plan of plans) await prisma.plan.upsert({where: {id: plan.id}, create: plan, update: plan.id === "starter" ? {
    name: plan.name, description: plan.description, annualPriceCents: plan.annualPriceCents,
    dailyProfitCents: plan.dailyProfitCents, active: plan.active, configured: plan.configured,
  } : {}});
  await prisma.setting.upsert({where: {id: "main"}, create: {id: "main"}, update: {}});
} finally {
  await prisma.$disconnect();
}