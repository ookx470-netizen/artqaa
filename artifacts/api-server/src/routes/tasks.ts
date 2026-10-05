import { Router, type IRouter } from "express";
import * as V from "@workspace/api-zod";
import { prisma } from "../lib/prisma";
import { requireAdmin, requireMember } from "../lib/auth";
import { HttpError, input } from "../lib/http";
import { DAY, FREE_PLAN_ID, cents, lockMember, money } from "../lib/platform";

const router: IRouter = Router();
const TASKS_PER_CYCLE = 2;

const taskView = (task: {
  id: string; title: string; instructions: string; rewardCents: number; active: boolean; createdAt: Date; updatedAt: Date;
}) => ({
  id: task.id, title: task.title, instructions: task.instructions, reward: money(task.rewardCents),
  active: task.active, createdAt: task.createdAt.toISOString(), updatedAt: task.updatedAt.toISOString(),
});

const assignmentView = (assignment: {
  id: string; taskTitle: string; instructions: string; rewardCents: number; status: string;
  evidence: string; reviewNote: string; assignedAt: Date; submittedAt: Date | null; reviewedAt: Date | null;
}) => ({
  id: assignment.id, taskTitle: assignment.taskTitle, instructions: assignment.instructions,
  reward: money(assignment.rewardCents), status: assignment.status, evidence: assignment.evidence,
  reviewNote: assignment.reviewNote, assignedAt: assignment.assignedAt.toISOString(),
  submittedAt: assignment.submittedAt?.toISOString() ?? null, reviewedAt: assignment.reviewedAt?.toISOString() ?? null,
});

const adminSubmissionView = (assignment: {
  id: string; memberId: string; taskTitle: string; instructions: string; rewardCents: number; status: string;
  evidence: string; reviewNote: string; assignedAt: Date; submittedAt: Date | null; reviewedAt: Date | null;
  member: {name: string; memberId: string};
}) => ({
  id: assignment.id, memberId: assignment.memberId, memberName: assignment.member.name,
  memberNumber: assignment.member.memberId, taskTitle: assignment.taskTitle, instructions: assignment.instructions,
  reward: money(assignment.rewardCents), status: assignment.status, evidence: assignment.evidence,
  reviewNote: assignment.reviewNote, assignedAt: assignment.assignedAt.toISOString(),
  submittedAt: assignment.submittedAt?.toISOString() ?? null, reviewedAt: assignment.reviewedAt?.toISOString() ?? null,
});

router.get("/tasks", requireMember, async (req, res): Promise<void> => {
  const board = await prisma.$transaction(async tx => {
    await lockMember(tx, req.member!.id);
    const now = new Date();
    const subscription = await tx.subscription.findFirst({
      where: {
        memberId: req.member!.id, mode: "live", planId: {not: FREE_PLAN_ID}, annualPriceCents: {gt: 0},
        startsAt: {lte: now}, expiresAt: {gt: now},
      },
      orderBy: {startsAt: "desc"},
    });
    if (!subscription) {
      return {eligible: false, message: "تظهر المهام لأصحاب الخطط المدفوعة النشطة فقط.", cycleStartAt: null, nextCycleAt: null, tasks: []};
    }

    const cycle = Math.floor((now.getTime() - subscription.startsAt.getTime()) / DAY);
    const cycleStartAt = new Date(subscription.startsAt.getTime() + cycle * DAY);
    const nextCycleAt = new Date(subscription.startsAt.getTime() + (cycle + 1) * DAY);
    const definitions = await tx.taskDefinition.findMany({where: {active: true}, orderBy: [{createdAt: "asc"}, {id: "asc"}]});
    if (definitions.length < TASKS_PER_CYCLE) {
      return {eligible: true, message: "لم تُجهّز الإدارة مهمتين نشطتين لهذه الفترة بعد.", cycleStartAt, nextCycleAt, tasks: []};
    }

    for (let slot = 0; slot < TASKS_PER_CYCLE; slot += 1) {
      const exists = await tx.taskAssignment.findUnique({
        where: {subscriptionId_cycle_slot: {subscriptionId: subscription.id, cycle, slot}},
        select: {id: true},
      });
      if (exists) continue;
      const definition = definitions[(cycle * TASKS_PER_CYCLE + slot) % definitions.length]!;
      await tx.taskAssignment.create({data: {
        memberId: req.member!.id, subscriptionId: subscription.id, taskId: definition.id, cycle, slot,
        taskTitle: definition.title, instructions: definition.instructions, rewardCents: definition.rewardCents,
        assignedAt: cycleStartAt,
      }});
    }
    const assignments = await tx.taskAssignment.findMany({
      where: {subscriptionId: subscription.id, cycle}, orderBy: {slot: "asc"},
    });
    return {eligible: true, message: "", cycleStartAt, nextCycleAt, tasks: assignments};
  });
  res.json(V.GetTaskBoardResponse.parse({
    ...board, cycleStartAt: board.cycleStartAt?.toISOString() ?? null,
    nextCycleAt: board.nextCycleAt?.toISOString() ?? null, tasks: board.tasks.map(assignmentView),
  }));
});

router.post("/tasks/:id/submit", requireMember, async (req, res): Promise<void> => {
  const {id} = input(V.SubmitTaskParams, req.params);
  const {evidence} = input(V.SubmitTaskBody, req.body);
  const cleanEvidence = evidence.trim();
  if (cleanEvidence.length < 5) throw new HttpError(400, "أضف وصفًا أو رابطًا يوضح إنجاز المهمة.");

  const assignment = await prisma.$transaction(async tx => {
    await lockMember(tx, req.member!.id);
    const row = await tx.taskAssignment.findFirst({where: {id, memberId: req.member!.id}});
    if (!row) throw new HttpError(404, "المهمة غير موجودة.");
    if (row.status !== "available" && row.status !== "rejected") throw new HttpError(409, "هذه المهمة أُرسلت أو اعتُمدت بالفعل.");
    const subscription = await tx.subscription.findFirst({
      where: {
        id: row.subscriptionId, memberId: req.member!.id, mode: "live", planId: {not: FREE_PLAN_ID},
        annualPriceCents: {gt: 0}, expiresAt: {gt: new Date()},
      },
    });
    if (!subscription) throw new HttpError(403, "لا يوجد اشتراك مدفوع نشط يسمح بإرسال هذه المهمة.");
    const currentCycle = Math.floor((Date.now() - subscription.startsAt.getTime()) / DAY);
    if (currentCycle !== row.cycle) throw new HttpError(409, "انتهت فترة هذه المهمة ذات الـ24 ساعة.");
    const updated = await tx.taskAssignment.update({where: {id}, data: {
      status: "submitted", evidence: cleanEvidence, reviewNote: "", submittedAt: new Date(), reviewedAt: null, reviewerId: null,
    }});
    await tx.audit.create({data: {
      actorId: req.member!.id, action: "task_submission", targetId: id,
      detail: JSON.stringify({cycle: row.cycle, resubmitted: row.status === "rejected", evidenceLength: cleanEvidence.length}),
    }});
    return updated;
  });
  res.json(V.SubmitTaskResponse.parse(assignmentView(assignment)));
});

router.use("/admin", requireMember, requireAdmin);

router.get("/admin/tasks", async (_req, res): Promise<void> => {
  const tasks = await prisma.taskDefinition.findMany({orderBy: [{active: "desc"}, {createdAt: "desc"}]});
  res.json(V.ListAdminTasksResponse.parse(tasks.map(taskView)));
});

const normalizeTaskInput = (data: ReturnType<typeof V.CreateAdminTaskBody.parse>) => {
  const title = data.title.trim();
  const instructions = data.instructions.trim();
  const rewardCents = cents(data.reward);
  if (title.length < 3 || instructions.length < 3) throw new HttpError(400, "أدخل عنوانًا وتعليمات واضحة للمهمة.");
  if (rewardCents <= 0) throw new HttpError(400, "يجب أن تكون مكافأة المهمة أكبر من صفر.");
  return {title, instructions, rewardCents, active: data.active};
};

router.post("/admin/tasks", async (req, res): Promise<void> => {
  const data = normalizeTaskInput(input(V.CreateAdminTaskBody, req.body));
  const task = await prisma.$transaction(async tx => {
    const created = await tx.taskDefinition.create({data});
    await tx.audit.create({data: {actorId: req.member!.id, action: "task_create", targetId: created.id, detail: JSON.stringify(data)}});
    return created;
  });
  res.json(V.CreateAdminTaskResponse.parse(taskView(task)));
});

router.put("/admin/tasks/:id", async (req, res): Promise<void> => {
  const {id} = input(V.UpdateAdminTaskParams, req.params);
  const data = normalizeTaskInput(input(V.UpdateAdminTaskBody, req.body));
  const task = await prisma.$transaction(async tx => {
    const existing = await tx.taskDefinition.findUnique({where: {id}});
    if (!existing) throw new HttpError(404, "المهمة غير موجودة.");
    const updated = await tx.taskDefinition.update({where: {id}, data});
    await tx.audit.create({data: {actorId: req.member!.id, action: "task_update", targetId: id, detail: JSON.stringify(data)}});
    return updated;
  });
  res.json(V.UpdateAdminTaskResponse.parse(taskView(task)));
});

router.get("/admin/task-submissions", async (_req, res): Promise<void> => {
  const assignments = await prisma.taskAssignment.findMany({
    where: {status: {in: ["submitted", "approved", "rejected"]}},
    include: {member: {select: {name: true, memberId: true}}},
    orderBy: [{status: "desc"}, {submittedAt: "asc"}],
    take: 1000,
  });
  res.json(V.ListAdminTaskSubmissionsResponse.parse(assignments.map(adminSubmissionView)));
});

router.post("/admin/task-submissions/:id/review", async (req, res): Promise<void> => {
  const {id} = input(V.ReviewAdminTaskSubmissionParams, req.params);
  const data = input(V.ReviewAdminTaskSubmissionBody, req.body);
  const note = data.note.trim();
  if (data.decision === "rejected" && note.length < 3) throw new HttpError(400, "اذكر سبب رفض المهمة.");

  const assignment = await prisma.$transaction(async tx => {
    const existing = await tx.taskAssignment.findUnique({where: {id}});
    if (!existing) throw new HttpError(404, "المهمة المرسلة غير موجودة.");
    await tx.$queryRaw`SELECT id FROM "Member" WHERE id = ${existing.memberId} FOR UPDATE`;
    const row = await tx.taskAssignment.findUniqueOrThrow({where: {id}, include: {member: true}});
    if (row.status !== "submitted") throw new HttpError(409, "تمت مراجعة هذه المهمة مسبقًا.");
    if (data.decision === "approved") {
      if (!row.member.active) throw new HttpError(409, "لا يمكن إضافة مكافأة إلى حساب موقوف.");
      await tx.member.update({where: {id: row.memberId}, data: {
        realBalanceCents: {increment: row.rewardCents}, realEarnedCents: {increment: row.rewardCents},
      }});
      await tx.activity.create({data: {
        memberId: row.memberId, mode: "live", kind: "task_reward",
        title: `مكافأة مهمة: ${row.taskTitle}`, amountCents: row.rewardCents,
      }});
    }
    const updated = await tx.taskAssignment.update({where: {id}, data: {
      status: data.decision, reviewNote: note, reviewedAt: new Date(), reviewerId: req.member!.id,
    }, include: {member: {select: {name: true, memberId: true}}}});
    await tx.audit.create({data: {
      actorId: req.member!.id, action: "task_submission_review", targetId: id,
      detail: JSON.stringify({decision: data.decision, rewardCents: data.decision === "approved" ? row.rewardCents : 0, note}),
    }});
    return updated;
  });
  res.json(V.ReviewAdminTaskSubmissionResponse.parse(adminSubmissionView(assignment)));
});

export default router;
