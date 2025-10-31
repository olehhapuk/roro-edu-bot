import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { classroomsTable } from './classrooms.table';

export const lessonReportsTable = pgTable('lesson_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
  title: varchar('title').notNull(),
  videoUrl: varchar('video_url').notNull(),
  codeUrl: varchar('code_url').notNull(),
  classroomId: uuid('classroom_id')
    .references(() => classroomsTable.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    })
    .notNull(),
});
