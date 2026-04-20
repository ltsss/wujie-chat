const fetch = require('node-fetch');
const crypto = require('crypto');

class WechatWorkService {
  constructor() {
    this.corpId = process.env.WECHAT_CORPID;
    this.agentId = process.env.WECHAT_AGENTID;
    this.secret = process.env.WECHAT_SECRET;
    this.accessToken = null;
    this.tokenExpireTime = 0;
  }

  // 获取 Access Token
  async getAccessToken() {
    // 如果 token 未过期，直接返回
    if (this.accessToken && Date.now() < this.tokenExpireTime) {
      return this.accessToken;
    }

    try {
      const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${this.corpId}&corpsecret=${this.secret}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.errcode === 0) {
        this.accessToken = data.access_token;
        // 提前 5 分钟过期
        this.tokenExpireTime = Date.now() + (data.expires_in - 300) * 1000;
        console.log('✅ 企业微信 AccessToken 获取成功');
        return this.accessToken;
      } else {
        throw new Error(`获取 AccessToken 失败: ${data.errmsg}`);
      }
    } catch (error) {
      console.error('❌ 获取 AccessToken 错误:', error);
      throw error;
    }
  }

  // 发送消息给微信用户
  async sendMessage(userId, openKfId, content) {
    try {
      // 截断超长消息（微信限制约 2000 字）
      const MAX_LENGTH = 2000;
      let truncatedContent = content;
      if (content.length > MAX_LENGTH) {
        truncatedContent = content.substring(0, MAX_LENGTH - 3) + '...';
        console.log(`⚠️ 消息超长已截断: ${content.length} -> ${truncatedContent.length}`);
      }

      const accessToken = await this.getAccessToken();
      const url = `https://qyapi.weixin.qq.com/cgi-bin/kf/send_msg?access_token=${accessToken}`;

      const body = {
        touser: userId,
        open_kfid: openKfId,
        msgtype: 'text',
        text: {
          content: truncatedContent
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      if (data.errcode === 0) {
        console.log('✅ 消息发送成功');
        return { success: true, msgId: data.msgid };
      } else {
        console.error('❌ 发送消息失败:', data);
        throw new Error(`发送消息失败: ${data.errmsg} (errcode: ${data.errcode})`);
      }
    } catch (error) {
      console.error('❌ 发送消息错误:', error);
      throw error;
    }
  }

  // 拉取企业微信消息（解决 95018 错误的关键）
  async syncMessages(cursor = '') {
    try {
      const accessToken = await this.getAccessToken();
      const url = `https://qyapi.weixin.qq.com/cgi-bin/kf/sync_msg?access_token=${accessToken}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cursor: cursor,
          token: process.env.WECHAT_TOKEN,
          limit: 100
        })
      });

      const data = await response.json();
      if (data.errcode === 0) {
        console.log(`✅ 同步消息成功，获取 ${data.msg_list?.length || 0} 条消息`);
        return {
          messages: data.msg_list || [],
          nextCursor: data.next_cursor
        };
      } else {
        throw new Error(`同步消息失败: ${data.errmsg}`);
      }
    } catch (error) {
      console.error('❌ 同步消息错误:', error);
      return { messages: [], nextCursor: cursor };
    }
  }

  // 获取客服账号列表
  async getKfAccountList() {
    try {
      const accessToken = await this.getAccessToken();
      const url = `https://qyapi.weixin.qq.com/cgi-bin/kf/account/list?access_token=${accessToken}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const data = await response.json();
      if (data.errcode === 0) {
        return data.account_list || [];
      } else {
        throw new Error(`获取客服账号失败: ${data.errmsg}`);
      }
    } catch (error) {
      console.error('❌ 获取客服账号错误:', error);
      throw error;
    }
  }

  // 验证消息签名（用于回调接口）
  verifySignature(token, timestamp, nonce, encrypt) {
    const arr = [token, timestamp, nonce, encrypt].sort();
    const str = arr.join('');
    const sha1 = crypto.createHash('sha1').update(str).digest('hex');
    return sha1;
  }

  // 解密消息
  decryptMessage(encrypt, encodingAESKey) {
    // 这里需要使用微信提供的解密算法
    // 简化版，实际需要引入微信的加密库
    console.log('解密消息:', encrypt);
    return { message: '解密功能待实现' };
  }
}

module.exports = WechatWorkService;
