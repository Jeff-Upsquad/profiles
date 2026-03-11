# Profiles — Portfolio Platform

A portfolio platform for designers and video editors. Users create profiles, upload images/videos, and showcase their work.

## Tech Stack

- **Frontend**: React + Vite
- **Admin**: React + Vite (separate app)
- **Backend**: Node.js + Express
- **Database**: MongoDB + Mongoose
- **File Storage**: Local (switchable to cloud)

## Project Structure

```
/frontend    → User-facing React app
/admin       → Admin panel React app
/backend     → Express API server
/deploy      → Nginx config & setup scripts
```

---

## Local Development Setup

### Prerequisites

- Node.js 18+ installed
- MongoDB running locally (or use MongoDB Atlas)

### 1. Clone and install

```bash
git clone YOUR_REPO_URL
cd Profiles

# Install all dependencies
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
cd admin && npm install && cd ..
```

### 2. Configure environment

```bash
cd backend
cp .env.example .env
# Edit .env if needed (defaults work for local development)
```

### 3. Seed the database

```bash
cd backend
npm run seed
```

This creates:
- Admin user: `admin@profiles.com` / `admin123456`
- Default categories and types

### 4. Start development servers

Open 3 terminal windows:

```bash
# Terminal 1 — Backend API (port 5000)
cd backend && npm run dev

# Terminal 2 — Frontend (port 5173)
cd frontend && npm run dev

# Terminal 3 — Admin (port 5174)
cd admin && npm run dev
```

### 5. Open in browser

- Frontend: http://localhost:5173
- Admin: http://localhost:5174
- API: http://localhost:5000/api/health

---

## Deployment to Hostinger VPS

### Step 1: Initial VPS Setup

SSH into your VPS and run the setup script:

```bash
ssh root@YOUR_VPS_IP
# Upload and run setup script, or run commands manually:
```

The setup script installs: Node.js 20, MongoDB 7, Nginx, PM2

### Step 2: Clone Your Project

```bash
cd /var/www/profiles
git clone YOUR_REPO_URL .
```

### Step 3: Install Dependencies & Build

```bash
# Backend
cd /var/www/profiles/backend
npm install
cp .env.example .env
nano .env  # Set production values (change JWT_SECRET!)

# Seed database
npm run seed

# Frontend
cd /var/www/profiles/frontend
npm install
echo "VITE_API_URL=/api" > .env
npm run build

# Admin
cd /var/www/profiles/admin
npm install
echo "VITE_API_URL=/api" > .env
npm run build
```

### Step 4: Configure Nginx

```bash
sudo cp /var/www/profiles/deploy/nginx.conf /etc/nginx/sites-available/profiles
sudo ln -sf /etc/nginx/sites-available/profiles /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### Step 5: Start Backend with PM2

```bash
cd /var/www/profiles/backend
pm2 start src/app.js --name profiles-api
pm2 save
pm2 startup  # Follow the output command to enable auto-start
```

### Step 6: Verify

- Frontend: http://YOUR_VPS_IP
- Admin: http://YOUR_VPS_IP/admin
- API: http://YOUR_VPS_IP/api/health

---

## Deploying Updates

After pushing changes to GitHub:

```bash
ssh root@YOUR_VPS_IP
cd /var/www/profiles

# Pull latest code
git pull

# If backend changed:
cd backend && npm install
pm2 restart profiles-api

# If frontend changed:
cd frontend && npm install && npm run build

# If admin changed:
cd admin && npm install && npm run build
```

---

## Environment Variables

### Backend (.env)

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | API server port | 5000 |
| MONGODB_URI | MongoDB connection string | mongodb://localhost:27017/profiles |
| JWT_SECRET | Secret for signing tokens | (change this!) |
| JWT_EXPIRES_IN | Token expiry | 7d |
| STORAGE_PROVIDER | File storage: local, cloudinary, s3 | local |
| UPLOAD_DIR | Upload directory name | uploads |
| MAX_FILE_SIZE | Max upload size in bytes | 104857600 (100MB) |
| CORS_ORIGIN | Allowed origins (comma-separated) | http://localhost:5173,http://localhost:5174 |

### Frontend & Admin (.env)

| Variable | Description |
|----------|-------------|
| VITE_API_URL | Backend API URL (`http://localhost:5000/api` locally, `/api` in production) |

---

## Default Admin Credentials

After running `npm run seed`:

- **Email**: admin@profiles.com
- **Password**: admin123456

Change these immediately in production!

---

## Switching to Cloud Storage

The storage system uses an abstraction layer. To switch from local to cloud:

1. Install the cloud provider package (e.g., `npm install cloudinary`)
2. Create a new provider in `backend/src/services/storage/`
3. Set `STORAGE_PROVIDER=cloudinary` in `.env`
4. Add cloud credentials to `.env`

No other code changes needed.
