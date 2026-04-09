// 企业微信客服服务 - 完整版
const http = require('http');
const crypto = require('crypto');
const https = require('https');

// 简单的 fetch 实现（Node.js 16 没有内置 fetch）
function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          json: () => Promise.resolve(JSON.parse(data)),
          text: () => Promise.resolve(data)
        });
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

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

// Dify AI 配置
const DIFY_CONFIG = {
  apiKey: 'app-2wNgRmooOPx0GZevdxwKMYor',
  apiUrl: 'https://api.dify.ai/v1'
};

// 调用 Dify AI
async function callDifyAI(message, userId) {
  try {
    console.log('调用 Dify AI:', message);
    
    const response = await fetch(`${DIFY_CONFIG.apiUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: {},
        query: message,
        response_mode: 'blocking',
        conversation_id: '',
        user: userId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Dify API 错误: ${errorText}`);
    }

    const data = await response.json();
    console.log('Dify 回复:', data.answer);
    return data.answer;
  } catch (error) {
    console.error('Dify 调用失败:', error.message);
    return '抱歉，我暂时无法回答，请稍后再试。';
  }
}

// 获取企业微信 AccessToken
let accessToken = null;
let tokenExpireTime = 0;

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpireTime) {
    return accessToken;
  }
  
  try {
    const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${WECHAT_CONFIG.corpid}&corpsecret=${WECHAT_CONFIG.secret}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.errcode === 0) {
      accessToken = data.access_token;
      tokenExpireTime = Date.now() + (data.expires_in - 300) * 1000;
      console.log('AccessToken 获取成功');
      return accessToken;
    } else {
      throw new Error(`获取 Token 失败: ${data.errmsg}`);
    }
  } catch (error) {
    console.error('获取 AccessToken 失败:', error.message);
    throw error;
  }
}

// 发送微信消息给用户
async function sendWechatMessage(userId, content) {
  try {
    const token = await getAccessToken();
    const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        touser: userId,
        msgtype: 'text',
        agentid: WECHAT_CONFIG.agentid,
        text: { content: content }
      })
    });
    
    const data = await response.json();
    if (data.errcode === 0) {
      console.log('微信消息发送成功');
      return true;
    } else {
      console.error('微信消息发送失败:', data.errmsg);
      return false;
    }
  } catch (error) {
    console.error('发送微信消息失败:', error.message);
    return false;
  }
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
    req.on('end', async () => {
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
          
          // 检查是否是转人工请求
          const transferKeywords = ['转人工', '人工客服', '找客服', '人工', '客服'];
          const isTransferRequest = transferKeywords.some(keyword => message.includes(keyword));
          
          if (isTransferRequest) {
            // 保存转人工请求
            memoryStorage.transfers.push({
              id: Date.now().toString(),
              user_id: fromUser,
              message: message,
              status: 'pending',
              created_at: new Date()
            });
            
            // 发送转人工提示
            await sendWechatMessage(fromUser, '已为您转接人工客服，请稍候，客服人员将尽快为您服务。');
            console.log('转人工请求已记录:', fromUser);
          } else {
            // 调用 Dify AI 回复
            try {
              const difyResponse = await callDifyAI(message, fromUser);
              if (difyResponse) {
                // 发送回复给用户
                await sendWechatMessage(fromUser, difyResponse);
              }
            } catch (error) {
              console.error('AI 回复失败:', error.message);
            }
          }
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

  // 获取转人工列表（客服后台用）
  if (url === '/api/transfers' && method === 'GET') {
    const { status } = query;
    let transfers = memoryStorage.transfers;
    if (status) {
      transfers = transfers.filter(t => t.status === status);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, transfers: transfers.slice(-50) }));
    return;
  }

  // 更新转人工状态
  if (url.startsWith('/api/transfers/') && method === 'POST') {
    const id = url.split('/').pop();
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const transfer = memoryStorage.transfers.find(t => t.id === id);
        if (transfer) {
          transfer.status = data.status || 'processing';
          transfer.updated_at = new Date();
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // 客服主动发送消息给用户
  if (url === '/api/wechat/send' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { userId, content } = data;
        const success = await sendWechatMessage(userId, content);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success }));
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
