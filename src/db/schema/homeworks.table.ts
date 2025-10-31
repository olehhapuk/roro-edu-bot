import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { classroomsTable } from './classrooms.table';

export const homeworksTable = pgTable('homeworks', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  dueDate: timestamp('due_date', {
    withTimezone: true,
  }).notNull(),
  createdAt: timestamp('created_at', {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
  classroomId: uuid('classroom_id')
    .references(() => classroomsTable.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    })
    .notNull(),
  githubLink: text('github_link').notNull(),
});
