-- GarmaxAi MySQL initialization script
-- This runs automatically when the MySQL container starts for the first time

USE garmaxai;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON garmaxai.* TO 'garmaxuser'@'%';
FLUSH PRIVILEGES;

-- Note: Actual schema will be created by Drizzle migrations
-- This file ensures the database and user are ready
