CREATE TABLE `player_location` (
	`user_id` text NOT NULL,
	`zone_id` text NOT NULL,
	`x` real NOT NULL,
	`y` real NOT NULL,
	`z` real NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `zone_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
