import { NextResponse } from 'next/server';

export async function GET() {
  const healthStatus = {
    status: 'ok',
    uptime: process.uptime(), // server uptime in seconds
    timestamp: new Date().toISOString()
  };

  return NextResponse.json(healthStatus);
}
