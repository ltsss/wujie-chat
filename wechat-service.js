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
  async sendMessage(userId, msgType = 'text', content) {
    try {
      const accessToken = await this.getAccessToken();
      const url = `https://qyapi.weixin.qq.com/cgi-bin/kf/send_msg?access_token=${accessToken}`;

      const body = {
        touser: userId,
        msgtype: msgType,
        text: {
          content: content
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
        throw new Error(`发送消息失败: ${data.errmsg}`);
      }
    } catch (error) {
      console.error('❌ 发送消息错误:', error);
      throw error;
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
