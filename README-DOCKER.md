# Session Notes App - Docker Setup

## 🚀 One Command Deployment

```bash
docker-compose up -d
```

That's it! The application will be available at:
- **HTTP**: http://localhost (redirects to HTTPS)
- **HTTPS**: https://localhost

## 🔧 What's Included

- **Next.js App**: Session notes application
- **PostgreSQL**: Database with automatic schema setup
- **Nginx**: Reverse proxy with SSL termination
- **SSL**: Self-signed certificates (generated automatically)

## 📋 Default Configuration

- **Database**: `session_notes` / `session_user` / `session_password_123`
- **JWT Secret**: `your_jwt_secret_key_here_minimum_32_characters_long`
- **Ports**: 80 (HTTP), 443 (HTTPS)

## 🛠️ Management Commands

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Restart services
docker-compose restart

# Rebuild and start
docker-compose up -d --build
```

## 🔐 Custom Configuration

To customize the setup, edit `docker-compose.yml`:

```yaml
environment:
  POSTGRES_PASSWORD: your_secure_password
  JWT_SECRET: your_jwt_secret_key
  OPENAI_API_KEY: your_openai_api_key
```

## 📊 Health Check

- **Application**: https://localhost/health
- **Database**: `docker-compose exec postgres pg_isready`

## 🗄️ Data Persistence

- Database data is stored in Docker volume `postgres_data`
- Data persists between container restarts
- To reset data: `docker-compose down -v`

## 🔍 Troubleshooting

```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs app
docker-compose logs postgres
docker-compose logs nginx

# Access database
docker-compose exec postgres psql -U session_user -d session_notes
```

## 📝 Notes

- SSL certificates are self-signed (browser will show security warning)
- For production, replace with proper SSL certificates
- All services are automatically configured and connected
- No external dependencies required
