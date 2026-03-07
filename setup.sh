#!/bin/bash

# Setup script for Unipile Dashboard
set -e

echo "Setting up Unipile Dashboard..."

# Create data directory
mkdir -p /home/ubuntu/apps/unipile-dashboard/data

# Install dependencies
cd /home/ubuntu/apps/unipile-dashboard
npm install

# Build the app
npm run build

# Setup systemd service
sudo cp unipile-dashboard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable unipile-dashboard

echo "Setup complete! Start the service with:"
echo "  sudo systemctl start unipile-dashboard"
echo ""
echo "View logs with:"
echo "  sudo journalctl -u unipile-dashboard -f"
