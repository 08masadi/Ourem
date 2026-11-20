import { NextResponse } from 'next/server';
import { getUserNotifications } from '@/actions/requests';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roleParam = searchParams.get('role') || undefined;

    const notifications = await getUserNotifications(roleParam);

    return NextResponse.json({
      success: true,
      count: notifications.length,
      notifications,
    });
  } catch (error: any) {
    console.error('Error in /api/notifications/poll:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to fetch notifications',
        notifications: [],
      },
      { status: 200 } // return 200 with empty array to prevent Android crash
    );
  }
}
