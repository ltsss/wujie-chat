// 企业微信客服服务 - 完整版
const http = require('http');
const crypto = require('crypto');

const PORT = 3000;

// 内存存储
const memoryStorage = {
  messages: [],
  transfers: [],
  users: new Map()
};

// 企业微信配置
const WECHAT_CONFIG = {
  corpid: 'ww78c04bb69d7d7a8c',
  agentid: '1000002',
  secret: 'ywB1l8Siky33ryeMicib8g8ElI9KjWRt2nesTpKC5pY',
  token: 'm5cUv2PpfTUCHg3WXeOflNBzhTKLXF',
  encodingAESKey: '0tm2zExj4tsn40aBuGxhxCPwU3iCLcSR1TWVarLtfeQ'
};

// AES 解密
function decryptAES(encryptedData, aesKey) {
  try {
    // Base64 解码 AESKey
    const key = Buffer.from(aesKey + '=', 'base64');
    const iv = key.slice(0, 16);
    
    // Base64 解码加密数据
    const encrypted = Buffer.from(encryptedData, 'base64');
    
    // AES-256-CBC 解密
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    decipher.setAutoPadding(false);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    // 去除填充
    const padLength = decrypted[decrypted.length - 1];
    decrypted = decrypted.slice(0, decrypted.length - padLength);
    
    // 去除前 16 个随机字节
    const content = decrypted.slice(16);
    
    // 提取消息长度（4字节）
    const msgLen = content.readUInt32BE(0);
    
    // 提取消息内容
    const msg = content.slice(4, 4 + msgLen).toString('utf8');
    
    return msg;
  } catch (e) {
    console.error('AES 解密失败:', e.message);
    return null;
  }
}

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
  if ((url.startsWith('/api/wechat/callback') || url.startsWith('//wechat/callback')) && method === 'GET') {
    const { msg_signature, timestamp, nonce, echostr } = query;
    
    console.log('微信验证请求:', { msg_signature, timestamp, nonce, echostr });
    
    if (echostr && WECHAT_CONFIG.token && WECHAT_CONFIG.encodingAESKey) {
      // 解码 URL 编码的 echostr
      const decodedEchostr = decodeURIComponent(echostr);
      console.log('解码后 echostr:', decodedEchostr);
      
      // 验证签名
      const signature = getSignature(WECHAT_CONFIG.token, timestamp, nonce, decodedEchostr);
      console.log('计算签名:', signature);
      console.log('收到签名:', msg_signature);
      
      // 解密 echostr
      const decrypted = decryptAES(decodedEchostr, WECHAT_CONFIG.encodingAESKey);
      console.log('解密后:', decrypted);
      
      if (decrypted) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(decrypted);
        console.log('返回解密后的 echostr:', decrypted);
        return;
      }
    }
    
    res.writeHead(200);
    res.end('success');
    return;
  }

  // 微信消息接收 (POST 请求)
  if ((url.startsWith('/api/wechat/callback') || url.startsWith('//wechat/callback')) && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      console.log('收到微信消息:', body);
      
      // 解析 XML
      const encryptMatch = body.match(/<Encrypt><!\[CDATA\[(.*?)\]\]><\/Encrypt>/);
      
      if (encryptMatch && WECHAT_CONFIG.encodingAESKey) {
        const encrypted = encryptMatch[1];
        const decrypted = decryptAES(encrypted, WECHAT_CONFIG.encodingAESKey);
        console.log('解密后消息:', decrypted);
        
        // 解析解密后的 XML
        const msgMatch = decrypted && decrypted.match(/<Content><!\[CDATA\[(.*?)\]\]><\/Content>/);
        const fromUserMatch = decrypted && decrypted.match(/<FromUserName><!\[CDATA\[(.*?)\]\]><\/FromUserName>/);
        
        if (msgMatch && fromUserMatch) {
          const message = msgMatch[1];
          const fromUser = fromUserMatch[1];
          console.log('用户消息:', fromUser, message);
        }
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
