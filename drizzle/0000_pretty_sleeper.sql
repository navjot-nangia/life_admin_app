CREATE TABLE `dismissals` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `dismissals_user` ON `dismissals` (`user`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`item` text DEFAULT '' NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`size` integer NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `documents_user` ON `documents` (`user`);--> statement-breakpoint
CREATE TABLE `history` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`item` text NOT NULL,
	`cycle` integer NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `history_user` ON `history` (`user`);--> statement-breakpoint
CREATE UNIQUE INDEX `history_cycle` ON `history` (`item`,`cycle`);--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`data` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `items_user` ON `items` (`user`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`item` text NOT NULL,
	`data` text NOT NULL,
	`read` integer DEFAULT 0 NOT NULL,
	`pushed` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notifications_user` ON `notifications` (`user`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`user` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `subscriptions_user` ON `subscriptions` (`user`);--> statement-breakpoint
CREATE TABLE `system` (
	`id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
