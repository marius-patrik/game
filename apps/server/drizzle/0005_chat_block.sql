CREATE TABLE `chat_block` (
  `user_id` text NOT NULL,
  `blocked_user_id` text NOT NULL,
  `created_at` integer NOT NULL,
  PRIMARY KEY(`user_id`, `blocked_user_id`)
);
