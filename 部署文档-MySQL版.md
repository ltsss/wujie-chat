# 無界茶台客服系统 - MySQL 版本部署文档

## 一、本地开发环境搭建

### 1. 安装 MySQL

**macOS:**
```bash
brew install mysql
brew services start mysql
```

**Ubuntu/CentOS:**
```bash
sudo apt-get install mysql-server  # Ubuntu
sudo yum install mysql-server      # CentOS
sudo systemctl start mysql
```

### 2. 初始化数据库

```bash
cd wujie-chat
mysql -u root -p < init-database.sql
```

### 3. 配置环境变量

编辑 `.env` 文件：
```env
# Dify 配置
DIFY_API_KEY=app-2wNgRmooOPx0GZevdxwKMYor
DIFY_API_URL=https://api.dify.ai/v1

# 服务器配置
PORT=3000

# MySQL 数据库配置（根据你的数据库修改）
DB_HOST=localhost
DB_PORT=3306
DB_USER=wujie_kefu
DB_PASSWORD=your_secure_password
DB_NAME=wujie_chat
```

### 4. 安装依赖并启动

```bash
cd wujie-chat
npm install
npm start
```

访问：http://localhost:3000

---

## 二、服务器部署

### 1. 服务器环境准备

```bash
# 登录服务器
ssh test1

# 安装 MySQL
sudo yum install mysql-server
sudo systemctl start mysqld
sudo systemctl enable mysqld

# 初始化数据库
mysql -u root -p < /opt/xiangmu/wujie-kefu-server/init-database.sql
```

### 2. 部署后端服务

```bash
# 创建目录
mkdir -p /opt/xiangmu/wujie-chat-server
cd /opt/xiangmu/wujie-chat-server

# 复制文件（从本地）
scp -r wujie-chat/* test1:/opt/xiangmu/wujie-chat-server/

# 安装依赖
npm install

# 配置环境变量
vim .env

# 启动服务
npm start
```

### 3. 配置 Nginx

编辑 `/etc/nginx/conf.d/wujietest.conf`：

```nginx
# 客服系统 API
location /kefu/api {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

# 客服系统静态文件
location /kefu {
    alias /opt/xiangmu/landing-page-1/kefu;
    index index.html;
    try_files $uri $uri/ =404;
}
```

重载 Nginx：
```bash
nginx -t
systemctl reload nginx
```

---

## 三、API 接口文档

### 1. 健康检查
```
GET /api/health
```

### 2. 发送消息
```
POST /api/chat
Body: {
  "message": "用户消息",
  "conversationId": "会话ID",
  "userId": "用户ID",
  "intent": "意图（可选）"
}
```

### 3. 获取用户聊天记录
```
GET /api/messages/:userId?limit=50
```

### 4. 获取会话聊天记录
```
GET /api/conversations/:conversationId/messages?limit=100
```

### 5. 转人工请求
```
POST /api/transfer
Body: {
  "userId": "用户ID",
  "conversationId": "会话ID",
  "reason": "转人工原因",
  "chatSummary": "聊天记录摘要"
}
```

### 6. 获取转人工列表
```
GET /api/transfers?status=pending&limit=50
```

### 7. 更新转人工状态
```
PATCH /api/transfers/:id
Body: {
  "status": "processing"  // pending/processing/completed
}
```

### 8. 保存用户信息
```
POST /api/users/:userId
Body: {
  "collectedInfo": {
    "budget": "10000-20000",
    "city": "上海",
    ...
  }
}
```

### 9. 获取用户信息
```
GET /api/users/:userId
```

### 10. 获取统计信息
```
GET /api/stats
```

---

## 四、数据库表结构

### chat_messages（聊天记录）
| 字段 | 类型 | 说明 |
|-----|------|------|
| id | INT | 主键 |
| user_id | VARCHAR | 用户ID |
| conversation_id | VARCHAR | 会话ID |
| role | ENUM | user/bot/system |
| content | TEXT | 消息内容 |
| intent | VARCHAR | 意图 |
| created_at | TIMESTAMP | 创建时间 |

### transfer_requests（转人工记录）
| 字段 | 类型 | 说明 |
|-----|------|------|
| id | INT | 主键 |
| user_id | VARCHAR | 用户ID |
| conversation_id | VARCHAR | 会话ID |
| reason | TEXT | 转人工原因 |
| chat_summary | TEXT | 聊天记录摘要 |
| status | ENUM | pending/processing/completed |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### user_info（用户信息）
| 字段 | 类型 | 说明 |
|-----|------|------|
| id | INT | 主键 |
| user_id | VARCHAR | 用户ID |
| collected_info | JSON | 收集的信息 |
| first_visit | TIMESTAMP | 首次访问 |
| last_visit | TIMESTAMP | 最后访问 |
| visit_count | INT | 访问次数 |

---

## 五、常见问题

### 1. 数据库连接失败
- 检查 MySQL 是否运行：`systemctl status mysqld`
- 检查用户名密码是否正确
- 检查防火墙是否放行 3306 端口

### 2. 端口被占用
- 查找占用 3000 端口的进程：`lsof -i :3000`
- 杀掉进程或修改 .env 中的 PORT

### 3. 权限问题
- 确保数据库用户有相应权限
- 确保文件权限正确：`chmod 755 -R /opt/xiangmu/wujie-chat-server`

