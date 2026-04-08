-- 無界茶台客服系统数据库初始化脚本

-- 创建数据库
CREATE DATABASE IF NOT EXISTS wujie_chat 
  DEFAULT CHARACTER SET utf8mb4 
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE wujie_chat;

-- 创建用户（生产环境请修改密码）
CREATE USER IF NOT EXISTS 'wujie_kefu'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON wujie_chat.* TO 'wujie_kefu'@'localhost';
FLUSH PRIVILEGES;

-- 聊天记录表
CREATE TABLE IF NOT EXISTS chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL COMMENT '用户ID',
  conversation_id VARCHAR(100) COMMENT '会话ID',
  role ENUM('user', 'bot', 'system') NOT NULL COMMENT '消息角色',
  content TEXT NOT NULL COMMENT '消息内容',
  intent VARCHAR(50) COMMENT '用户意图',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_user_id (user_id),
  INDEX idx_conversation_id (conversation_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='聊天记录表';

-- 转人工记录表
CREATE TABLE IF NOT EXISTS transfer_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL COMMENT '用户ID',
  conversation_id VARCHAR(100) COMMENT '会话ID',
  reason TEXT COMMENT '转人工原因',
  chat_summary TEXT COMMENT '聊天记录摘要',
  status ENUM('pending', 'processing', 'completed') DEFAULT 'pending' COMMENT '状态',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='转人工记录表';

-- 用户信息表
CREATE TABLE IF NOT EXISTS user_info (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL UNIQUE COMMENT '用户ID',
  collected_info JSON COMMENT '收集的用户信息（预算、城市等）',
  first_visit TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '首次访问时间',
  last_visit TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后访问时间',
  visit_count INT DEFAULT 1 COMMENT '访问次数',
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户信息表';

-- 插入测试数据（可选）
-- INSERT INTO chat_messages (user_id, role, content) VALUES 
--   ('test_user', 'user', '你好'),
--   ('test_user', 'bot', '您好！我是小珍，無界茶台的智能客服助手');

SELECT '数据库初始化完成！' AS message;
