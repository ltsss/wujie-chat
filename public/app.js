// 聊天应用逻辑 - 带信息收集版本
class ChatApp {
  constructor() {
    this.conversationId = '';
    this.userId = this.generateUserId();
    this.isTyping = false;
    // 服务器 API 配置
    this.apiUrl = '/kefu/api/chat';  // 调用我们自己的服务器
    
    // 收集的信息
    this.collectedInfo = {
      location: '',    // 场景
      roomSize: '',    // 室内大小
      material: '',    // 材质
      budget: '',      // 预算
      city: ''         // 城市
    };
    
    // 当前收集步骤
    this.currentStep = '';
    
    this.initElements();
    this.bindEvents();
    this.loadHistory();
  }

  generateUserId() {
    const saved = localStorage.getItem('wujie_chat_user_id');
    if (saved) return saved;
    const newId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('wujie_chat_user_id', newId);
    return newId;
  }

  initElements() {
    this.container = document.getElementById('chatContainer');
    this.messagesEl = document.getElementById('chatMessages');
    this.inputEl = document.getElementById('messageInput');
    this.sendBtn = document.getElementById('sendBtn');
    this.clearBtn = document.getElementById('clearBtn');
    this.closeBtn = document.getElementById('closeBtn');
    this.fabBtn = document.getElementById('fabBtn');
    this.transferBtn = document.getElementById('transferBtn');
    this.transferModal = document.getElementById('transferModal');
    this.closeModal = document.getElementById('closeModal');
    this.cancelTransfer = document.getElementById('cancelTransfer');
    this.confirmTransfer = document.getElementById('confirmTransfer');
    this.transferReason = document.getElementById('transferReason');
  }

  bindEvents() {
    this.sendBtn.addEventListener('click', () => this.sendMessage());
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    this.messagesEl.addEventListener('click', (e) => {
      if (e.target.classList.contains('quick-btn')) {
        const msg = e.target.dataset.msg;
        this.handleQuickReply(msg);
      }
      
      const optionBtn = e.target.closest('.option-btn');
      if (optionBtn) {
        const value = optionBtn.dataset.value;
        const type = optionBtn.dataset.type;
        this.handleOptionClick(value, type);
      }
      
      // 服务选项按钮（转客服 / 继续浏览）
      const serviceBtn = e.target.closest('.service-btn');
      if (serviceBtn) {
        const action = serviceBtn.dataset.action;
        this.handleServiceOption(action);
      }
    });

    this.clearBtn.addEventListener('click', () => this.clearChat());
    this.closeBtn.addEventListener('click', () => this.minimize());
    this.fabBtn.addEventListener('click', () => this.expand());
    this.transferBtn.addEventListener('click', () => this.showTransferModal());
    this.closeModal.addEventListener('click', () => this.hideTransferModal());
    this.cancelTransfer.addEventListener('click', () => this.hideTransferModal());
    this.confirmTransfer.addEventListener('click', () => this.transferToHuman());
    this.transferModal.addEventListener('click', (e) => {
      if (e.target === this.transferModal) this.hideTransferModal();
    });
  }

  // 处理快捷回复
  handleQuickReply(msg) {
    this.addMessage(msg, 'user');
    
    if (msg === '了解价格') {
      // 触发信息收集流程
      this.startCollection();
    } else if (msg === '了解产品' || msg === '公司信息' || msg === '联系客服') {
      // 直接发给 Dify 处理
      this.sendToDify(msg);
    } else {
      this.sendToDify(msg);
    }
  }

  // 开始收集信息
  startCollection() {
    this.resetCollection();
    this.currentStep = 'location';
    this.showLocationOptions();
  }

  // 重置收集状态
  resetCollection() {
    this.collectedInfo = { location: '', roomSize: '', material: '', budget: '', city: '' };
    this.currentStep = '';
  }

  // 显示场景选项
  showLocationOptions() {
    const message = '为了更好地为您推荐茶台，请告诉我：<br><br>【1/5】主要使用场景？';
    const options = [
      { num: '1', text: '家庭客厅', type: 'location' },
      { num: '2', text: '办公室', type: 'location' },
      { num: '3', text: '茶室', type: 'location' },
      { num: '4', text: '会所/酒店', type: 'location' }
    ];
    this.showOptionMessage(message, options);
    this.currentStep = 'location';
  }

  // 显示室内大小选项
  showRoomSizeOptions() {
    const message = '【2/5】房间面积大小？';
    const options = [
      { num: '1', text: '10㎡以下', type: 'roomSize' },
      { num: '2', text: '10-20㎡', type: 'roomSize' },
      { num: '3', text: '20-30㎡', type: 'roomSize' },
      { num: '4', text: '30㎡以上', type: 'roomSize' }
    ];
    this.showOptionMessage(message, options);
    this.currentStep = 'roomSize';
  }

  // 显示材质选项
  showMaterialOptions() {
    const message = '【3/5】您偏好的材质？';
    const options = [
      { num: '1', text: '实木（传统典雅）', type: 'material' },
      { num: '2', text: '岩板（现代简约）', type: 'material' },
      { num: '3', text: '智能（科技便捷）', type: 'material' }
    ];
    this.showOptionMessage(message, options);
    this.currentStep = 'material';
  }

  // 显示预算选项
  showBudgetOptions() {
    const message = '【4/5】您的预算范围？';
    const options = [
      { num: '1', text: '5000以下', type: 'budget' },
      { num: '2', text: '5000-10000', type: 'budget' },
      { num: '3', text: '10000-20000', type: 'budget' },
      { num: '4', text: '20000以上', type: 'budget' }
    ];
    this.showOptionMessage(message, options);
    this.currentStep = 'budget';
  }

  // 显示城市输入提示
  showCityInput() {
    const message = '【5/5】您所在的城市？<br>（直接回复城市名，如：上海、北京）';
    this.addMessage(message, 'bot');
    this.currentStep = 'city';
    this.inputEl.placeholder = '请输入城市名...';
    this.inputEl.focus();
  }

  // 显示带选项的消息
  showOptionMessage(message, options) {
    const messageEl = document.createElement('div');
    messageEl.className = 'message bot';
    
    const buttonsHtml = options.map(opt => `
      <button class="option-btn" data-value="${opt.num}" data-type="${opt.type}">
        <span class="opt-num">${opt.num}</span>
        <span class="opt-text">${opt.text}</span>
      </button>
    `).join('');
    
    messageEl.innerHTML = `
      <div class="avatar">🍵</div>
      <div class="content">
        <div class="question-text">${message}</div>
        <div class="option-buttons">${buttonsHtml}</div>
      </div>
    `;
    
    this.messagesEl.appendChild(messageEl);
    this.scrollToBottom();
  }

  // 处理选项点击
  handleOptionClick(value, type) {
    // 存储选择
    const valueMap = {
      location: { '1': '家庭客厅', '2': '办公室', '3': '茶室', '4': '会所/酒店' },
      roomSize: { '1': '10㎡以下', '2': '10-20㎡', '3': '20-30㎡', '4': '30㎡以上' },
      material: { '1': '实木', '2': '岩板', '3': '智能' },
      budget: { '1': '5000以下', '2': '5000-10000', '3': '10000-20000', '4': '20000以上' }
    };
    
    this.collectedInfo[type] = valueMap[type][value];
    
    // 显示用户选择
    this.addMessage(valueMap[type][value], 'user');
    
    // 进入下一步
    this.goToNextStep();
  }

  // 进入下一步
  goToNextStep() {
    if (!this.collectedInfo.location) {
      this.showLocationOptions();
    } else if (!this.collectedInfo.roomSize) {
      this.showRoomSizeOptions();
    } else if (!this.collectedInfo.material) {
      this.showMaterialOptions();
    } else if (!this.collectedInfo.budget) {
      this.showBudgetOptions();
    } else if (!this.collectedInfo.city) {
      this.showCityInput();
    } else {
      this.submitCollection();
    }
  }

  // 提交收集的信息
  submitCollection() {
    const { location, roomSize, material, budget, city } = this.collectedInfo;
    const fullMessage = `了解价格：${location}，${roomSize}，${material}，预算${budget}，${city}`;
    
    // 显示汇总
    this.addMessage(`正在为您查询适合的茶台价格...`, 'bot');
    
    // 标记这是价格查询，回复后要显示转客服选项
    this.isPriceQuery = true;
    
    // 发送给 Dify
    this.sendToDify(fullMessage);
    
    // 重置
    this.currentStep = '';
    this.inputEl.placeholder = '请输入您的问题...';
  }

  // 显示服务选项（转客服 / 继续浏览）
  showServiceOptions() {
    const messageEl = document.createElement('div');
    messageEl.className = 'message bot';
    messageEl.innerHTML = `
      <div class="avatar">🍵</div>
      <div class="content">
        <p>是否需要进一步服务？</p>
        <div class="service-options">
          <button class="service-btn transfer" data-action="transfer">
            <span>👤</span>
            转接人工客服
          </button>
          <button class="service-btn continue" data-action="continue">
            <span>💬</span>
            继续浏览
          </button>
        </div>
      </div>
    `;
    this.messagesEl.appendChild(messageEl);
    this.scrollToBottom();
  }

  // 发送消息
  sendMessage() {
    const message = this.inputEl.value.trim();
    if (!message || this.isTyping) return;

    this.inputEl.value = '';
    this.addMessage(message, 'user');

    // 如果在收集城市
    if (this.currentStep === 'city') {
      this.collectedInfo.city = message;
      this.goToNextStep();
      return;
    }

    this.sendToDify(message);
  }

  // 发送给服务器 API
  async sendToDify(message) {
    this.showTyping();

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: message,
          userId: this.userId,
          conversationId: this.conversationId || ''
        })
      });

      if (!response.ok) {
        throw new Error(`API错误: ${response.status}`);
      }

      const data = await response.json();
      this.hideTyping();

      if (data.success) {
        // 保存会话 ID
        if (data.conversationId) {
          this.conversationId = data.conversationId;
          localStorage.setItem('wujie_conversation_id', this.conversationId);
        }
        
        // 检查是否转人工
        if (data.transfer) {
          // 显示转人工提示
          this.addMessage(data.answer, 'system');
          // 显示企业微信客服二维码或提示
          this.showWechatKfQRCode();
        } else {
          // 显示 AI 回复
          this.addMessage(data.answer, 'bot');
          
          // 如果是价格推荐，显示转客服选项
          if (this.isPriceQuery) {
            this.showServiceOptions();
            this.isPriceQuery = false;
          }
        }
      } else {
        this.addMessage('抱歉，服务暂时出现问题，请稍后再试。', 'bot');
      }
    } catch (error) {
      console.error('Send error:', error);
      this.hideTyping();
      this.addMessage('抱歉，服务暂时出现问题，请稍后再试。', 'bot');
    }
  }

  // 显示企业微信客服二维码
  showWechatKfQRCode() {
    const messageEl = document.createElement('div');
    messageEl.className = 'message bot';
    messageEl.innerHTML = `
      <div class="avatar">🍵</div>
      <div class="content">
        <p>请扫描下方二维码联系人工客服：</p>
        <div class="kf-qrcode">
          <img src="/images/kefu-qrcode.jpg" alt="客服二维码" style="max-width: 200px; border-radius: 8px;">
        </div>
        <p style="font-size: 12px; color: #999; margin-top: 8px;">工作时间：9:00-21:00</p>
      </div>
    `;
    this.messagesEl.appendChild(messageEl);
    this.scrollToBottom();
  }

  // 添加消息
  addMessage(content, role) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${role}`;
    const avatar = role === 'bot' ? '🍵' : '👤';
    const avatarBg = role === 'bot' ? '#8B4513' : '#4CAF50';
    
    messageEl.innerHTML = `
      <div class="avatar" style="background: ${avatarBg}">${avatar}</div>
      <div class="content">${content.replace(/\n/g, '<br>')}</div>
    `;
    
    this.messagesEl.appendChild(messageEl);
    this.scrollToBottom();
  }

  // 显示正在输入
  showTyping() {
    this.isTyping = true;
    this.sendBtn.disabled = true;
    
    const typingEl = document.createElement('div');
    typingEl.className = 'message bot typing-indicator';
    typingEl.innerHTML = `
      <div class="avatar">🍵</div>
      <div class="content"><div class="typing"><span></span><span></span><span></span></div></div>
    `;
    this.messagesEl.appendChild(typingEl);
    this.scrollToBottom();
  }

  hideTyping() {
    this.isTyping = false;
    this.sendBtn.disabled = false;
    const typingEl = this.messagesEl.querySelector('.typing-indicator');
    if (typingEl) typingEl.remove();
  }

  scrollToBottom() {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  loadHistory() {
    const saved = localStorage.getItem('wujie_conversation_id');
    if (saved) this.conversationId = saved;
  }

  clearChat() {
    if (confirm('确定要清空当前对话吗？')) {
      this.messagesEl.innerHTML = '';
      this.conversationId = '';
      this.resetCollection();
      localStorage.removeItem('wujie_conversation_id');
      this.addWelcomeMessage();
    }
  }

  addWelcomeMessage() {
    const welcomeEl = document.createElement('div');
    welcomeEl.className = 'message bot';
    welcomeEl.innerHTML = `
      <div class="avatar">🍵</div>
      <div class="content">
        <p>您好！我是小珍，無界茶台的智能客服助手 🌿</p>
        <p>请问有什么可以帮您？</p>
        <div class="quick-replies">
          <button class="quick-btn" data-msg="了解产品">了解产品</button>
          <button class="quick-btn" data-msg="了解价格">了解价格</button>
          <button class="quick-btn" data-msg="公司信息">公司信息</button>
          <button class="quick-btn" data-msg="联系客服">联系客服</button>
        </div>
      </div>
    `;
    this.messagesEl.appendChild(welcomeEl);
  }

  minimize() {
    this.container.style.display = 'none';
    this.fabBtn.style.display = 'flex';
  }

  expand() {
    this.container.style.display = 'flex';
    this.fabBtn.style.display = 'none';
  }

  showTransferModal() {
    this.transferModal.classList.add('show');
    this.transferReason.focus();
  }

  hideTransferModal() {
    this.transferModal.classList.remove('show');
    this.transferReason.value = '';
  }

  // 处理服务选项（转客服 / 继续浏览）
  handleServiceOption(action) {
    if (action === 'transfer') {
      // 显示转人工弹窗
      this.showTransferModal();
    } else if (action === 'continue') {
      // 显示欢迎消息，让用户可以继续浏览
      this.addMessage('好的，您还有其他问题吗？', 'bot');
      this.addWelcomeMessage();
    }
  }

  async transferToHuman() {
    const reason = this.transferReason.value.trim();
    this.hideTransferModal();
    
    // 显示转接中消息
    this.addMessage('正在为您转接人工客服，请稍候...', 'system');
    
    // 跳转到企业微信客服
    setTimeout(() => {
      this.addMessage(`
        ✅ 正在跳转到人工客服...<br>
        如未自动跳转，<a href="https://work.weixin.qq.com/kfid/kfcbcbba1b84e6621a1">请点击这里</a>
      `, 'system');
      
      // 直接跳转（当前页面打开）
      window.location.href = 'https://work.weixin.qq.com/kfid/kfcbcbba1b84e6621a1';
    }, 1000);
  }

  // 获取聊天摘要（用于转客服时展示）
  getChatSummary() {
    const messages = this.messagesEl.querySelectorAll('.message');
    const summary = [];
    messages.forEach(msg => {
      const content = msg.querySelector('.content');
      if (content) {
        summary.push(content.innerText.substring(0, 50));
      }
    });
    return summary.slice(-5).join(' | ');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ChatApp();
});
