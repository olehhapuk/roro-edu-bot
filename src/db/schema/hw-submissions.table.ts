import { pgEnum, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { homeworksTable } from './homeworks.table';
import { classroomsTable } from './classrooms.table';
import { relations } from 'drizzle-orm';

export enum HwSubmissionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export const hwSubmissionStatusEnum = pgEnum('hw_submission_status', [
  HwSubmissionStatus.PENDING,
  HwSubmissionStatus.APPROVED,
  HwSubmissionStatus.REJECTED,
]);

export const hwSubmissionsTable = pgTable('hw_submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  homeworkId: uuid('homework_id')
    .references(() => homeworksTable.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    })
    .notNull(),
  studentId: varchar('student_id').notNull(),
  submittedAt: timestamp('submitted_at', {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
  approvedAt: timestamp('approved_at', {
    withTimezone: true,
  }),
  rejectedAt: timestamp('rejected_at', {
    withTimezone: true,
  }),
  githubPRLink: varchar('github_pr_link').notNull(),
  classroomId: uuid('classroom_id')
    .references(() => classroomsTable.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    })
    .notNull(),
  status: hwSubmissionStatusEnum('status')
    .default(HwSubmissionStatus.PENDING)
    .notNull(),
});

export const hwSubmissionsRelations = relations(
  hwSubmissionsTable,
  ({ one }) => ({
    homework: one(homeworksTable, {
      fields: [hwSubmissionsTable.homeworkId],
      references: [homeworksTable.id],
    }),
  })
);
