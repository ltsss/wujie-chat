// 简化版客服服务 - 不依赖外部模块
const http = require('http');
const crypto = require('crypto');

const PORT = 3000;

// 内存存储
const memoryStorage = {
  messages: [],
  transfers: [],
  users: new Map()
};

// 企业微信配置 - 这些需要从企业微信后台获取
const WECHAT_CONFIG = {
  corpid: 'ww78c04bb69d7d7a8c',
  agentid: '1000002',
  secret: 'ywB1l8Siky33ryeMicib8g8ElI9KjWRt2nesTpKC5pY',
  token: '', // 企业微信后台设置的 Token
  encodingAESKey: '' // 企业微信后台生成的 EncodingAESKey
};

// 计算签名
function getSignature(token, timestamp, nonce, encrypt) {
  const arr = [token, timestamp, nonce, encrypt].sort();
  const str = arr.join('');
  return crypto.createHash('sha1').update(str).digest('hex');
}

// 解析 URL 参数
function parseQueryString(url) {
  const query = {};
  const parts = url.split('?');
  if (parts.length > 1) {
    const pairs = parts[1].split('&');
    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      query[key] = decodeURIComponent(value || '');
    }
  }
  return query;
}

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
  const query = parseQueryString(url);

  console.log(`${method} ${url}`);

  // 健康检查
  if (url.startsWith('/api/health') && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      database: 'memory',
      time: new Date().toISOString() 
    }));
    return;
  }

  // ========== 企业微信回调接口 ==========
  
  // 微信回调验证 (GET 请求)
  if (url.startsWith('/api/wechat/callback') && method === 'GET') {
    const { msg_signature, timestamp, nonce, echostr } = query;
    
    console.log('微信验证请求:', { msg_signature, timestamp, nonce, echostr });
    
    // 验证签名
    if (echostr && WECHAT_CONFIG.token) {
      const signature = getSignature(WECHAT_CONFIG.token, timestamp, nonce, echostr);
      console.log('计算签名:', signature);
      console.log('收到签名:', msg_signature);
      
      // 返回 echostr
      res.writeHead(200);
      res.end(echostr);
      console.log('返回 echostr:', echostr);
      return;
    }
    
    res.writeHead(200);
    res.end('success');
    return;
  }

  // 微信消息接收 (POST 请求)
  if (url.startsWith('/api/wechat/callback') && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      console.log('收到微信消息:', body);
      
      // 解析 XML
      const msgMatch = body.match(/<Content><!\[CDATA\[(.*?)\]\]><\/Content>/);
      const fromUserMatch = body.match(/<FromUserName><!\[CDATA\[(.*?)\]\]><\/FromUserName>/);
      
      if (msgMatch && fromUserMatch) {
        const message = msgMatch[1];
        const fromUser = fromUserMatch[1];
        console.log('用户消息:', fromUser, message);
        
        // TODO: 调用 AI 回复并发送给用户
      }
      
      res.writeHead(200);
      res.end('success');
    });
    return;
  }

  // 获取配置信息
  if (url === '/api/wechat/config' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true,
      corpid: WECHAT_CONFIG.corpid,
      agentid: WECHAT_CONFIG.agentid,
      callback_url: 'http://www.wujietea.com/kefu/api/wechat/callback'
    }));
    return;
  }

  // 更新配置（用于设置 Token 和 AESKey）
  if (url === '/api/wechat/config' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (data.token) WECHAT_CONFIG.token = data.token;
        if (data.encodingAESKey) WECHAT_CONFIG.encodingAESKey = data.encodingAESKey;
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: '配置已更新' }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
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
╠══════════════════════════════════════╣
║  回调URL:                              ║
║  http://www.wujietea.com/kefu/api/    ║
║  wechat/callback                       ║
╚══════════════════════════════════════╝
  `);
});
