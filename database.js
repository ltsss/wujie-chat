let mysql;
try {
  mysql = require('mysql2/promise');
} catch (e) {
  console.warn('⚠️ mysql2 模块未安装，将使用内存存储');
  mysql = null;
}

require('dotenv').config();

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'wujie_kefu',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'wujie_chat',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// 创建连接池
let pool = null;
if (mysql) {
  try {
    pool = mysql.createPool(dbConfig);
  } catch (e) {
    console.warn('⚠️ 数据库连接池创建失败:', e.message);
  }
}

// 内存存储（数据库不可用时的备用）
const memoryStorage = {
  messages: [],
  transfers: [],
  users: new Map()
};

// 数据库操作类
class Database {
  constructor() {
    this.useMemory = !pool;
  }

  // 初始化数据库表
  async init() {
    if (this.useMemory) {
      console.log('✅ 使用内存存储模式');
      return false;
    }
    try {
      const connection = await pool.getConnection();
      
      // 创建聊天记录表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(100) NOT NULL,
          conversation_id VARCHAR(100),
          role ENUM('user', 'bot', 'system') NOT NULL,
          content TEXT NOT NULL,
          intent VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_user_id (user_id),
          INDEX idx_conversation_id (conversation_id),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      
      // 创建转人工记录表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS transfer_requests (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(100) NOT NULL,
          conversation_id VARCHAR(100),
          reason TEXT,
          chat_summary TEXT,
          status ENUM('pending', 'processing', 'completed') DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_user_id (user_id),
          INDEX idx_status (status),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      
      // 创建用户信息表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS user_info (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(100) NOT NULL UNIQUE,
          collected_info JSON,
          first_visit TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_visit TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          visit_count INT DEFAULT 1,
          INDEX idx_user_id (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      
      connection.release();
      console.log('✅ 数据库表初始化完成');
      return true;
    } catch (error) {
      console.error('❌ 数据库初始化失败:', error.message);
      this.useMemory = true;
      return false;
    }
  }
  
  // 保存聊天记录
  async saveMessage(userId, conversationId, role, content, intent = null) {
    if (this.useMemory) {
      memoryStorage.messages.push({
        id: Date.now(),
        user_id: userId,
        conversation_id: conversationId,
        role,
        content,
        intent,
        created_at: new Date()
      });
      return Date.now();
    }
    try {
      const [result] = await pool.execute(
        'INSERT INTO chat_messages (user_id, conversation_id, role, content, intent) VALUES (?, ?, ?, ?, ?)',
        [userId, conversationId, role, content, intent]
      );
      return result.insertId;
    } catch (error) {
      console.error('保存消息失败:', error.message);
      return null;
    }
  }
  
  // 获取用户聊天记录
  async getUserMessages(userId, limit = 50) {
    if (this.useMemory) {
      return memoryStorage.messages
        .filter(m => m.user_id === userId)
        .slice(-limit);
    }
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
        [userId, limit]
      );
      return rows.reverse();
    } catch (error) {
      console.error('获取消息失败:', error.message);
      return [];
    }
  }
  
  // 获取会话聊天记录
  async getConversationMessages(conversationId, limit = 100) {
    if (this.useMemory) {
      return memoryStorage.messages
        .filter(m => m.conversation_id === conversationId)
        .slice(-limit);
    }
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?',
        [conversationId, limit]
      );
      return rows.reverse();
    } catch (error) {
      console.error('获取会话消息失败:', error.message);
      return [];
    }
  }
  
  // 保存转人工请求
  async saveTransferRequest(userId, conversationId, reason, chatSummary) {
    if (this.useMemory) {
      const id = Date.now().toString();
      memoryStorage.transfers.push({
        id,
        user_id: userId,
        conversation_id: conversationId,
        reason,
        chat_summary: chatSummary,
        status: 'pending',
        created_at: new Date()
      });
      return id;
    }
    try {
      const [result] = await pool.execute(
        'INSERT INTO transfer_requests (user_id, conversation_id, reason, chat_summary, status) VALUES (?, ?, ?, ?, ?)',
        [userId, conversationId, reason, chatSummary, 'pending']
      );
      return result.insertId;
    } catch (error) {
      console.error('保存转人工请求失败:', error.message);
      return null;
    }
  }
  
  // 更新转人工状态
  async updateTransferStatus(id, status) {
    if (this.useMemory) {
      const transfer = memoryStorage.transfers.find(t => t.id == id);
      if (transfer) {
        transfer.status = status;
        return true;
      }
      return false;
    }
    try {
      await pool.execute(
        'UPDATE transfer_requests SET status = ? WHERE id = ?',
        [status, id]
      );
      return true;
    } catch (error) {
      console.error('更新状态失败:', error.message);
      return false;
    }
  }
  
  // 获取转人工列表
  async getTransferRequests(status = null, limit = 50) {
    if (this.useMemory) {
      let transfers = memoryStorage.transfers;
      if (status) {
        transfers = transfers.filter(t => t.status === status);
      }
      return transfers.slice(-limit);
    }
    try {
      let query = 'SELECT * FROM transfer_requests';
      let params = [];
      
      if (status) {
        query += ' WHERE status = ?';
        params.push(status);
      }
      
      query += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);
      
      const [rows] = await pool.execute(query, params);
      return rows;
    } catch (error) {
      console.error('获取转人工列表失败:', error.message);
      return [];
    }
  }
  
  // 保存或更新用户信息
  async saveUserInfo(userId, collectedInfo = null) {
    if (this.useMemory) {
      const existing = memoryStorage.users.get(userId);
      if (existing) {
        existing.collected_info = collectedInfo;
        existing.visit_count = (existing.visit_count || 0) + 1;
        existing.last_visit = new Date();
      } else {
        memoryStorage.users.set(userId, {
          user_id: userId,
          collected_info: collectedInfo,
          first_visit: new Date(),
          last_visit: new Date(),
          visit_count: 1
        });
      }
      return true;
    }
    try {
      const [existing] = await pool.execute(
        'SELECT id FROM user_info WHERE user_id = ?',
        [userId]
      );
      
      if (existing.length > 0) {
        await pool.execute(
          'UPDATE user_info SET collected_info = ?, visit_count = visit_count + 1 WHERE user_id = ?',
          [JSON.stringify(collectedInfo), userId]
        );
      } else {
        await pool.execute(
          'INSERT INTO user_info (user_id, collected_info) VALUES (?, ?)',
          [userId, JSON.stringify(collectedInfo)]
        );
      }
      return true;
    } catch (error) {
      console.error('保存用户信息失败:', error.message);
      return false;
    }
  }
  
  // 获取用户信息
  async getUserInfo(userId) {
    if (this.useMemory) {
      return memoryStorage.users.get(userId) || null;
    }
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM user_info WHERE user_id = ?',
        [userId]
      );
      if (rows.length > 0) {
        const user = rows[0];
        user.collected_info = JSON.parse(user.collected_info || '{}');
        return user;
      }
      return null;
    } catch (error) {
      console.error('获取用户信息失败:', error.message);
      return null;
    }
  }
  
  // 获取统计信息
  async getStats() {
    if (this.useMemory) {
      return {
        messageCount: memoryStorage.messages.length,
        userCount: memoryStorage.users.size,
        transferCount: memoryStorage.transfers.length,
        pendingTransfer: memoryStorage.transfers.filter(t => t.status === 'pending').length
      };
    }
    try {
      const [[messageCount]] = await pool.execute('SELECT COUNT(*) as count FROM chat_messages');
      const [[userCount]] = await pool.execute('SELECT COUNT(*) as count FROM user_info');
      const [[transferCount]] = await pool.execute('SELECT COUNT(*) as count FROM transfer_requests');
      const [[pendingTransfer]] = await pool.execute("SELECT COUNT(*) as count FROM transfer_requests WHERE status = 'pending'");
      
      return {
        messageCount: messageCount.count,
        userCount: userCount.count,
        transferCount: transferCount.count,
        pendingTransfer: pendingTransfer.count
      };
    } catch (error) {
      console.error('获取统计失败:', error.message);
      return null;
    }
  }
}

module.exports = new Database();
