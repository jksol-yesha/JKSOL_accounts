-- Fix Corrupted org_ids and branch_ids in Users Table
-- This script identifies and fixes corrupted JSON array data

-- Step 1: View all users with potentially corrupted data
SELECT 
    id,
    email,
    org_ids,
    branch_ids,
    CHAR_LENGTH(org_ids) as org_ids_length,
    CHAR_LENGTH(branch_ids) as branch_ids_length
FROM users
WHERE 
    -- Check for corrupted patterns (arrays with empty strings, quotes, etc.)
    org_ids LIKE '%""%' 
    OR org_ids LIKE '%",""%'
    OR branch_ids LIKE '%""%'
    OR branch_ids LIKE '%",""%'
ORDER BY id;

-- Step 2: Fix specific known corrupted users
-- Fix yesharana20@gmail.com (appears to have org IDs: 67, 2, 85)
UPDATE users 
SET org_ids = JSON_ARRAY(67, 2, 85)
WHERE email = 'yesharana20@gmail.com';

-- Fix ranayesha18@gmail.com (appears to have org IDs: 82, 85)
UPDATE users 
SET org_ids = JSON_ARRAY(82, 85)
WHERE email = 'ranayesha18@gmail.com';

-- Step 3: Verify the fixes
SELECT 
    id,
    email,
    org_ids,
    branch_ids
FROM users
WHERE email IN ('yesharana20@gmail.com', 'ranayesha18@gmail.com');

-- Step 4: Check for any remaining corrupted data
SELECT 
    id,
    email,
    org_ids,
    branch_ids
FROM users
WHERE 
    org_ids LIKE '%""%' 
    OR org_ids LIKE '%",""%'
    OR branch_ids LIKE '%""%'
    OR branch_ids LIKE '%",""%';
