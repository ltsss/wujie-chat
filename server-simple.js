// 简化版客服服务 - 不依赖外部模块
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

// 内存存储
const memoryStorage = {
  messages: [],
  transfers: [],
  users: new Map()
};

// 企业微信配置
const WECHAT_CORPID = 'ww78c04bb69d7d7a8c';
const WECHAT_AGENTID = '1000002';
const WECHAT_SECRET = 'ywB1l8Siky33ryeMicib8g8ElI9KjWRt2nesTpKC5pY';

// 简单的路由处理
const server = http.createServer((req, res) => {
  // 设置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = req.url;
  const method = req.method;

  console.log(`${method} ${url}`);

  // 健康检查
  if (url === '/api/health' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      database: 'memory',
      time: new Date().toISOString() 
    }));
    return;
  }

  // 微信回调验证
  if (url === '/api/wechat/callback' && method === 'GET') {
    const urlObj = new URL(req.url, `http://localhost:${PORT}`);
    const echostr = urlObj.searchParams.get('echostr');
    res.writeHead(200);
    res.end(echostr || 'success');
    return;
  }

  // 微信消息接收
  if (url === '/api/wechat/callback' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      console.log('收到微信消息:', body);
      res.writeHead(200);
      res.end('success');
    });
    return;
  }

  // 获取 AccessToken
  if (url === '/api/wechat/token' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true, 
      corpid: WECHAT_CORPID,
      agentid: WECHAT_AGENTID,
      token: '需要实现获取逻辑'
    }));
    return;
  }

  // 聊天接口
  if (url === '/api/chat' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { message, userId } = data;
        
        // 保存消息
        memoryStorage.messages.push({
          user_id: userId,
          content: message,
          role: 'user',
          created_at: new Date()
        });

        // 模拟 AI 回复
        const answer = `收到您的消息：${message}`;
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          answer: answer,
          conversationId: Date.now().toString()
        }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // 默认 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║     無界茶台客服系统已启动            ║
╠══════════════════════════════════════╣
║  端口: ${PORT}                          ║
║  模式: 内存存储（无数据库）            ║
╚══════════════════════════════════════╝
  `);
});
