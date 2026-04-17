ALTER TABLE `player_progress` ADD `skill_cooldowns_json` text DEFAULT '{}' NOT NULL;

CREATE TABLE `chat_message` (
  `id` text PRIMARY KEY NOT NULL,
  `channel` text NOT NULL,
  `from_user_id` text NOT NULL,
  `from_name` text NOT NULL,
  `text` text NOT NULL,
  `created_at` integer NOT NULL
);
CREATE INDEX `idx_chat_created` ON `chat_message` (`created_at`);
