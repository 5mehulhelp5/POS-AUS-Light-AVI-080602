-- Fix password hashes for all users
-- This hash is for password: password123
UPDATE users SET password_hash = '$2b$10$uya6Zm.lj96sWebFnnWEjO9OAaxcgrsYoSlVZPlKazFS2LOvuXEz2';
