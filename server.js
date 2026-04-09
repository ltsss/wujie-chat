require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const db = require('./database');
const WechatWorkService = require('./wechat-service');

const app = express();
const PORT = process.env.PORT || 3000;

// 企业微信服务
const wechatService = new WechatWorkService();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Dify 配置
const DIFY_API_KEY = process.env.DIFY_API_KEY;
const DIFY_API_URL = process.env.DIFY_API_URL || 'https://api.dify.ai/v1';

// 初始化数据库
let dbInitialized = false;

async function initDatabase() {
  if (!dbInitialized) {
    dbInitialized = await db.init();
    if (!dbInitialized) {
      console.warn('⚠️ 数据库未连接，使用内存存储');
    }
  }
}

// 内存存储（数据库不可用时的备用）
const memoryStorage = {
  messages: [],
  transfers: [],
  users: new Map()
};

// 健康检查
app.get('/api/health', async (req, res) => {
  const dbStatus = dbInitialized ? 'connected' : 'disconnected';
  res.json({ 
    status: 'ok', 
    database: dbStatus,
    time: new Date().toISOString() 
  });
});

// ========== 企业微信客服接口 ==========

// 企业微信消息回调验证（用于配置回调URL时验证）
app.get('/api/wechat/callback', (req, res) => {
  const { msg_signature, timestamp, nonce, echostr } = req.query;
  console.log('微信回调验证:', { msg_signature, timestamp, nonce, echostr });
  // 返回 echostr 表示验证通过
  res.send(echostr);
});

// 企业微信消息接收
app.post('/api/wechat/callback', async (req, res) => {
  try {
    console.log('收到微信消息:', req.body);
    const { ToUserName, FromUserName, CreateTime, MsgType, Content } = req.body;
    
    if (MsgType === 'text' && Content) {
      // 调用 Dify AI 回复
      const difyResponse = await fetch(`${DIFY_API_URL}/chat-messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DIFY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: {},
          query: Content,
          response_mode: 'blocking',
          conversation_id: '',
          user: FromUserName
        })
      });

      if (difyResponse.ok) {
        const data = await difyResponse.json();
        // 发送回复给用户
        await wechatService.sendMessage(FromUserName, 'text', data.answer);
      }
    }
    
    res.send('success');
  } catch (error) {
    console.error('微信回调处理错误:', error);
    res.send('success'); // 微信要求必须返回 success
  }
});

// 主动发送消息给微信用户
app.post('/api/wechat/send', async (req, res) => {
  try {
    const { userId, content } = req.body;
    const result = await wechatService.sendMessage(userId, 'text', content);
    res.json({ success: true, result });
  } catch (error) {
    console.error('发送微信消息错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取客服账号列表
app.get('/api/wechat/kf-accounts', async (req, res) => {
  try {
    const accounts = await wechatService.getKfAccountList();
    res.json({ success: true, accounts });
  } catch (error) {
    console.error('获取客服账号错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取 AccessToken（调试用）
app.get('/api/wechat/token', async (req, res) => {
  try {
    const token = await wechatService.getAccessToken();
    res.json({ success: true, token: token.substring(0, 10) + '...' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 发送消息给 Dify
app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversationId, userId, intent } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: '消息不能为空' });
    }

    // 保存用户消息到数据库
    if (dbInitialized) {
      await db.saveMessage(userId, conversationId, 'user', message, intent);
    } else {
      memoryStorage.messages.push({
        user_id: userId,
        conversation_id: conversationId,
        role: 'user',
        content: message,
        intent,
        created_at: new Date()
      });
    }

    const response = await fetch(`${DIFY_API_URL}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: {},
        query: message,
        response_mode: 'blocking',
        conversation_id: conversationId || '',
        user: userId || 'anonymous'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Dify API 错误: ${error}`);
    }

    const data = await response.json();
    
    // 保存 AI 回复到数据库
    if (dbInitialized) {
      await db.saveMessage(userId, data.conversation_id, 'bot', data.answer, null);
    } else {
      memoryStorage.messages.push({
        user_id: userId,
        conversation_id: data.conversation_id,
        role: 'bot',
        content: data.answer,
        created_at: new Date()
      });
    }

    res.json({
      success: true,
      answer: data.answer,
      conversationId: data.conversation_id,
      messageId: data.id
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 获取用户聊天记录
app.get('/api/messages/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;
    
    let messages;
    if (dbInitialized) {
      messages = await db.getUserMessages(userId, parseInt(limit));
    } else {
      messages = memoryStorage.messages
        .filter(m => m.user_id === userId)
        .slice(-parseInt(limit));
    }
    
    res.json({ success: true, messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取会话聊天记录
app.get('/api/conversations/:conversationId/messages', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 100 } = req.query;
    
    let messages;
    if (dbInitialized) {
      messages = await db.getConversationMessages(conversationId, parseInt(limit));
    } else {
      messages = memoryStorage.messages
        .filter(m => m.conversation_id === conversationId)
        .slice(-parseInt(limit));
    }
    
    res.json({ success: true, messages });
  } catch (error) {
    console.error('Get conversation messages error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 转人工请求
app.post('/api/transfer', async (req, res) => {
  try {
    const { userId, conversationId, reason, chatSummary } = req.body;
    
    // 获取聊天记录摘要
    let summary = chatSummary;
    if (!summary && dbInitialized) {
      const messages = await db.getConversationMessages(conversationId, 20);
      summary = messages.map(m => `${m.role}: ${m.content.substring(0, 100)}`).join(' | ');
    }

    // 保存转接请求
    let transferId;
    if (dbInitialized) {
      transferId = await db.saveTransferRequest(userId, conversationId, reason, summary);
    } else {
      transferId = Date.now().toString();
      memoryStorage.transfers.push({
        id: transferId,
        user_id: userId,
        conversation_id: conversationId,
        reason,
        chat_summary: summary,
        status: 'pending',
        created_at: new Date()
      });
    }
    
    console.log('转人工请求已记录:', { transferId, userId, reason });

    res.json({
      success: true,
      message: '转接请求已提交，客服将尽快为您服务',
      transferId
    });

  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 获取转接请求列表（管理后台用）
app.get('/api/transfers', async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    
    let transfers;
    if (dbInitialized) {
      transfers = await db.getTransferRequests(status, parseInt(limit));
    } else {
      transfers = memoryStorage.transfers
        .filter(t => !status || t.status === status)
        .slice(-parseInt(limit));
    }
    
    res.json({ success: true, transfers });
  } catch (error) {
    console.error('Get transfers error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新转接状态
app.patch('/api/transfers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (dbInitialized) {
      await db.updateTransferStatus(id, status);
    } else {
      const transfer = memoryStorage.transfers.find(t => t.id === id);
      if (transfer) transfer.status = status;
    }
    
    res.json({ success: true, message: '状态已更新' });
  } catch (error) {
    console.error('Update transfer error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 保存用户信息
app.post('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { collectedInfo } = req.body;
    
    if (dbInitialized) {
      await db.saveUserInfo(userId, collectedInfo);
    } else {
      memoryStorage.users.set(userId, {
        user_id: userId,
        collected_info: collectedInfo,
        last_visit: new Date()
      });
    }
    
    res.json({ success: true, message: '用户信息已保存' });
  } catch (error) {
    console.error('Save user error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取用户信息
app.get('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    let user;
    if (dbInitialized) {
      user = await db.getUserInfo(userId);
    } else {
      user = memoryStorage.users.get(userId);
    }
    
    res.json({ success: true, user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取统计信息（管理后台用）
app.get('/api/stats', async (req, res) => {
  try {
    let stats;
    if (dbInitialized) {
      stats = await db.getStats();
    } else {
      stats = {
        messageCount: memoryStorage.messages.length,
        userCount: memoryStorage.users.size,
        transferCount: memoryStorage.transfers.length,
        pendingTransfer: memoryStorage.transfers.filter(t => t.status === 'pending').length
      };
    }
    
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 启动服务器
async function startServer() {
  await initDatabase();
  
  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════╗
║     無界茶台 AI 客服系统已启动        ║
╠══════════════════════════════════════╣
║  访问地址: http://localhost:${PORT}      ║
║  API 地址: http://localhost:${PORT}/api  ║
║  数据库: ${dbInitialized ? '已连接 ✅' : '未连接 ⚠️'}         ║
╚══════════════════════════════════════╝
    `);
  });
}

startServer();
