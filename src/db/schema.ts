import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const profiles = pgTable('profiles', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  userId: text('user_id').references(() => profiles.uid).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('pending'), // pending, in_progress, completed, postponed
  estimatedDuration: integer('estimated_duration'), // in minutes
  actualDuration: integer('actual_duration').default(0), // in minutes
  priority: text('priority').default('medium'),
  dueDate: timestamp('due_date'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const taskSteps = pgTable('task_steps', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').references(() => tasks.id).notNull(),
  title: text('title').notNull(),
  isCompleted: boolean('is_completed').default(false),
  estimatedDuration: integer('estimated_duration'),
  orderIndex: integer('order_index').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const brainDumps = pgTable('brain_dumps', {
  id: serial('id').primaryKey(),
  userId: text('user_id').references(() => profiles.uid).notNull(),
  rawText: text('raw_text').notNull(),
  organizedData: jsonb('organized_data'),
  isProcessed: boolean('is_processed').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const memoryItems = pgTable('memory_items', {
  id: serial('id').primaryKey(),
  userId: text('user_id').references(() => profiles.uid).notNull(),
  content: text('content').notNull(),
  type: text('type').default('note'), // note, reminder, idea
  isParked: boolean('is_parked').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const focusSessions = pgTable('focus_sessions', {
  id: serial('id').primaryKey(),
  userId: text('user_id').references(() => profiles.uid).notNull(),
  taskId: integer('task_id').references(() => tasks.id),
  duration: integer('duration').notNull(), // planned duration in minutes
  actualDuration: integer('actual_duration').notNull(), // actual completed minutes
  completed: boolean('completed').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const aiInteractions = pgTable('ai_interactions', {
  id: serial('id').primaryKey(),
  userId: text('user_id').references(() => profiles.uid).notNull(),
  interactionType: text('interaction_type').notNull(), // coach, decompose, stuck
  prompt: text('prompt').notNull(),
  response: text('response').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relationships
export const profilesRelations = relations(profiles, ({ many, one }) => ({
  tasks: many(tasks),
  brainDumps: many(brainDumps),
  memoryItems: many(memoryItems),
  focusSessions: many(focusSessions),
  aiInteractions: many(aiInteractions),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [tasks.userId],
    references: [profiles.uid],
  }),
  steps: many(taskSteps),
  focusSessions: many(focusSessions),
}));

export const taskStepsRelations = relations(taskSteps, ({ one }) => ({
  task: one(tasks, {
    fields: [taskSteps.taskId],
    references: [tasks.id],
  }),
}));

export const focusSessionsRelations = relations(focusSessions, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [focusSessions.userId],
    references: [profiles.uid],
  }),
  task: one(tasks, {
    fields: [focusSessions.taskId],
    references: [tasks.id],
  }),
}));
