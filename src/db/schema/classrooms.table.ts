import { pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const classroomsTable = pgTable('classrooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
  ownerId: varchar('owner_id').notNull(),
  name: text('name').notNull(),
  channelId: varchar('channel_id').notNull().unique(),
  roleId: varchar('role_id').notNull(),
});
