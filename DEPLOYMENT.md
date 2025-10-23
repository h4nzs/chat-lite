# Chat-Lite Deployment Guide

## 📋 Prerequisites

Before deploying Chat-Lite, ensure you have the following installed:
- Node.js (version 18 or newer)
- pnpm (recommended) or npm/yarn
- PostgreSQL (version 12 or newer)
- Git

## 🗄️ Database Setup

### 1. PostgreSQL Installation
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# macOS (with Homebrew)
brew install postgresql

# Start PostgreSQL service
sudo systemctl start postgresql
```

### 2. Database Creation
```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE chatlite;
CREATE USER chatlite_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE chatlite TO chatlite_user;
ALTER USER chatlite_user WITH SUPERUSER;

# Exit PostgreSQL
\q
```

### 3. Environment Configuration
Create `.env` files in both `server/` and `web/` directories:

**server/.env:**
```env
DATABASE_URL="postgresql://chatlite_user:your_secure_password@localhost:5432/chatlite?schema=public"
JWT_SECRET="your_jwt_secret_here"
JWT_REFRESH_SECRET="your_jwt_refresh_secret_here"
PORT=4000
CORS_ORIGIN="http://yourdomain.com"
UPLOAD_DIR="uploads"
```

**web/.env:**
```env
VITE_API_URL="http://yourdomain.com:4000"
VITE_WS_URL="http://yourdomain.com:4000"
```

## 🚀 Backend Deployment

### 1. Install Dependencies
```bash
cd server
pnpm install
```

### 2. Database Migration
```bash
# Apply database migrations
pnpm prisma migrate deploy

# Generate Prisma client
pnpm prisma generate
```

### 3. Build Application
```bash
pnpm build
```

### 4. Start Server
```bash
# Production mode
pnpm start

# Development mode
pnpm dev
```

## 🌐 Frontend Deployment

### 1. Install Dependencies
```bash
cd web
pnpm install
```

### 2. Build Application
```bash
pnpm build
```

### 3. Serve Static Files
The build output will be in the `dist/` directory. You can serve these files using any web server:

```bash
# Using serve (install globally first)
npm install -g serve
serve -s dist -l 3000

# Using nginx (example configuration below)
```

## ⚙️ Nginx Configuration

### Sample nginx.conf for Production
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    # Redirect all HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    # SSL Configuration (using Let's Encrypt)
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Frontend (React app)
    location / {
        root /path/to/chat-lite/web/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API proxy
    location /api/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # WebSocket proxy
    location /socket.io/ {
        proxy_pass http://localhost:4000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # File uploads
    location /uploads/ {
        proxy_pass http://localhost:4000/uploads/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🔐 SSL Certificate Setup (Let's Encrypt)

### 1. Install Certbot
```bash
# Ubuntu/Debian
sudo apt install certbot python3-certbot-nginx

# macOS (with Homebrew)
brew install certbot
```

### 2. Obtain Certificate
```bash
sudo certbot --nginx -d yourdomain.com
```

### 3. Auto-renewal
```bash
# Test renewal
sudo certbot renew --dry-run

# Add to crontab for automatic renewal
sudo crontab -e
# Add this line:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

## 🐳 Docker Deployment (Optional)

### Dockerfile for Backend
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY server/package*.json ./
RUN npm install

COPY server/ .

RUN npm run build

EXPOSE 4000

CMD ["npm", "start"]
```

### Dockerfile for Frontend
```dockerfile
FROM node:18-alpine as build

WORKDIR /app

COPY web/package*.json ./
RUN npm install

COPY web/ .

RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### docker-compose.yml
```yaml
version: '3.8'

services:
  db:
    image: postgres:12
    environment:
      POSTGRES_DB: chatlite
      POSTGRES_USER: chatlite_user
      POSTGRES_PASSWORD: your_secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: ./server
    environment:
      DATABASE_URL: "postgresql://chatlite_user:your_secure_password@db:5432/chatlite?schema=public"
      JWT_SECRET: "your_jwt_secret_here"
      JWT_REFRESH_SECRET: "your_jwt_refresh_secret_here"
      PORT: 4000
      CORS_ORIGIN: "http://localhost:3000"
    ports:
      - "4000:4000"
    depends_on:
      - db

  frontend:
    build: ./web
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  postgres_data:
```

To run with Docker:
```bash
docker-compose up -d
```

## 🔧 Environment Variables

### Backend (.env)
| Variable | Description | Required |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL connection string | Yes |
| JWT_SECRET | Secret for signing access tokens | Yes |
| JWT_REFRESH_SECRET | Secret for signing refresh tokens | Yes |
| PORT | Server port (default: 4000) | No |
| CORS_ORIGIN | Allowed origins for CORS | Yes |
| UPLOAD_DIR | Directory for file uploads (default: uploads) | No |

### Frontend (.env)
| Variable | Description | Required |
|----------|-------------|----------|
| VITE_API_URL | Backend API URL | Yes |
| VITE_WS_URL | WebSocket server URL | Yes |

## 📊 Monitoring and Logging

### 1. Application Logs
```bash
# Backend logs
cd server
tail -f logs/app.log

# Frontend logs (browser console)
# Open Developer Tools → Console tab
```

### 2. Database Monitoring
```bash
# Monitor PostgreSQL
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"
```

### 3. Performance Monitoring
- Use PM2 for process management and monitoring
- Implement application performance monitoring (APM) tools
- Set up log aggregation with ELK stack or similar

## 🔁 CI/CD Pipeline (GitHub Actions Example)

```yaml
name: Deploy Chat-Lite

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
        
    - name: Install pnpm
      run: npm install -g pnpm
      
    - name: Install backend dependencies
      run: |
        cd server
        pnpm install
        
    - name: Build backend
      run: |
        cd server
        pnpm build
        
    - name: Install frontend dependencies
      run: |
        cd web
        pnpm install
        
    - name: Build frontend
      run: |
        cd web
        pnpm build
        
    - name: Deploy to server
      # Add your deployment steps here
      run: echo "Deploying..."
```

## 🛡️ Security Hardening

### 1. Firewall Configuration
```bash
# UFW example
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
```

### 2. Fail2Ban Setup
```bash
# Install fail2ban
sudo apt install fail2ban

# Configure jail.local
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
```

### 3. Regular Security Updates
```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade

# Check for security advisories regularly
```

## 📈 Performance Tuning

### 1. Database Optimization
```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_messages_conversation_id ON "Message"(conversationId);
CREATE INDEX idx_messages_created_at ON "Message"(createdAt);
CREATE INDEX idx_participants_user_id ON "Participant"(userId);
CREATE INDEX idx_participants_conversation_id ON "Participant"(conversationId);
```

### 2. Server Configuration
- Adjust Node.js memory limits if needed
- Configure connection pooling for PostgreSQL
- Optimize nginx worker processes

### 3. Caching Strategy
- Implement Redis for session storage
- Add CDN for static assets
- Use browser caching for frontend assets

## 🆘 Troubleshooting

### Common Issues and Solutions

#### 1. Database Connection Failed
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Verify connection settings
psql -h localhost -U chatlite_user -d chatlite
```

#### 2. CORS Errors
- Check `CORS_ORIGIN` in `.env` file
- Verify nginx proxy configuration
- Ensure frontend and backend URLs match

#### 3. WebSocket Connection Issues
- Check nginx WebSocket proxy configuration
- Verify firewall settings
- Ensure port 4000 is accessible

#### 4. File Upload Failures
- Check permissions on `uploads/` directory
- Verify `UPLOAD_DIR` environment variable
- Check nginx file size limits

#### 5. Authentication Problems
- Verify JWT secrets in `.env` files
- Check cookie settings and SameSite attributes
- Ensure HTTPS in production environments

## 🔄 Backup and Recovery

### 1. Database Backup
```bash
# Create backup
pg_dump -U chatlite_user -h localhost chatlite > chatlite_backup.sql

# Restore backup
psql -U chatlite_user -h localhost chatlite < chatlite_backup.sql
```

### 2. File Backup
```bash
# Backup uploads directory
tar -czf uploads_backup.tar.gz uploads/
```

### 3. Automated Backups
```bash
# Add to crontab for daily backups
0 2 * * * pg_dump -U chatlite_user -h localhost chatlite > /backups/chatlite_$(date +\%Y\%m\%d).sql
```

## 📞 Support

For issues not covered in this guide:

1. Check the [GitHub Issues](https://github.com/h4nzs/chat-lite/issues)
2. Join our [Discord Community](https://discord.gg/example)
3. Contact support team at support@chatlite.app

---

*Deployment guide last updated: October 2025*