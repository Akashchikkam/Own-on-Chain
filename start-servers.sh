#!/bin/bash

# Start Backend and Frontend servers

echo "🚀 Starting Own-on-Chain servers..."
echo ""

# Kill any existing processes
echo "Cleaning up existing processes..."
pkill -f "node.*server.js" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 1

# Start Backend
echo "📦 Starting Backend on port 3001..."
cd "$(dirname "$0")/backend"
npm run dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to start
sleep 3

# Check if backend is running
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ Backend is running!"
else
    echo "⚠️ Backend might still be starting..."
fi

# Start Frontend
echo ""
echo "🎨 Starting Frontend on port 5173..."
cd "$(dirname "$0")/frontend"
npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

# Wait for frontend to start
sleep 3

echo ""
echo "✅ Servers starting!"
echo ""
echo "📋 Backend: http://localhost:3001"
echo "📋 Frontend: http://localhost:5173"
echo ""
echo "📝 Logs:"
echo "   Backend: tail -f /tmp/backend.log"
echo "   Frontend: tail -f /tmp/frontend.log"
echo ""
echo "Press Ctrl+C to stop (or kill PIDs: $BACKEND_PID $FRONTEND_PID)"

# Keep script running
wait

