-- 修复 semantic_nodes 表中的重复数据
-- 这个脚本会保留每组重复数据中最新的一条，删除其他的

-- Step 1: 查看重复数据（可选）
SELECT "userId", title, type, COUNT(*) as count
FROM semantic_nodes
GROUP BY "userId", title, type
HAVING COUNT(*) > 1;

-- Step 2: 删除重复数据，保留最新的
WITH duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "userId", title, type
      ORDER BY "createdAt" DESC
    ) as rn
  FROM semantic_nodes
)
DELETE FROM semantic_nodes
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Step 3: 验证没有重复了
SELECT "userId", title, type, COUNT(*) as count
FROM semantic_nodes
GROUP BY "userId", title, type
HAVING COUNT(*) > 1;
