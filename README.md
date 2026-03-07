# Unipile Dashboard

GUI for LinkedIn automation via Unipile API.

## Features

- **Connection Status**: View connected LinkedIn accounts, health check
- **Sequences**: Create/manage outreach sequences (connection request → follow-up messages)
- **Contacts**: Import from Pipedrive, CSV upload, manual add
- **Queue**: View pending actions, pause/resume
- **Templates**: Message templates with personalization variables
- **Analytics**: Connection rate, reply rate, sequence performance
- **Settings**: Daily limits, timing controls

## Tech Stack

- Next.js 14 (App Router)
- SQLite for data persistence
- Tailwind CSS + shadcn/ui
- Unipile API integration
- Pipedrive integration

## Installation

```bash
cd /home/ubuntu/apps/unipile-dashboard
npm install
```

## Configuration

```bash
cp .env.example .env
# Edit .env with your settings
```

## Build

```bash
npm run build
```

## Run Development Server

```bash
npm run dev
# Access at http://localhost:3462
```

## Production Deployment

### 1. Setup Systemd Service

```bash
sudo cp unipile-dashboard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable unipile-dashboard
sudo systemctl start unipile-dashboard
```

### 2. Setup Nginx

```bash
sudo cp nginx.conf /etc/nginx/sites-available/unipile
sudo ln -s /etc/nginx/sites-available/unipile /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Setup SSL with Certbot

```bash
sudo certbot --nginx -d unipile.yourdomain.com
```

## Database Schema

- **accounts**: id, unipile_account_id, name, status, connected_at
- **contacts**: id, name, linkedin_url, company, title, source, status
- **sequences**: id, name, steps (JSON), active, created_at
- **queue**: id, contact_id, sequence_id, step_number, action_type, status, scheduled_at
- **messages**: id, contact_id, content, sent_at, replied_at
- **templates**: id, name, subject, body, variables
- **daily_stats**: date, connections_sent, messages_sent, replies_received

## Pages

- `/` - Dashboard with stats + queue status
- `/contacts` - Manage contacts, import from Pipedrive
- `/sequences` - Build/edit outreach sequences
- `/queue` - View/manage pending actions
- `/templates` - Message template library
- `/analytics` - Performance charts
- `/settings` - Account limits, Unipile config

## API Routes

- `/api/unipile/accounts` - List connected accounts
- `/api/unipile/send-connection` - Send connection request
- `/api/unipile/send-message` - Send message
- `/api/queue/process` - Process next items in queue
- `/api/pipedrive/sync` - Import contacts from Pipedrive

## Authentication

First-time setup: Access `/login` and set your admin password. All subsequent visits require this password.

## Default Templates

The app comes with 3 default templates:
1. Connection Request - Initial LinkedIn connection
2. Follow-up #1 - Post-connection message
3. Follow-up #2 - Value-focused follow-up

## Environment Variables

- `UNIPILE_API_KEY` - Your Unipile API key
- `UNIPILE_DSN` - Unipile DSN (api21.unipile.com:15135)
- `PIPEDRIVE_API_KEY` - Pipedrive API key
- `DAILY_LIMIT` - Max connections + messages per day (default: 20)
- `MESSAGE_DELAY_MIN/MAX` - Random delay between actions
