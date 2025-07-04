// /api/purchase/[id]/notify-middle-manager/route.ts
// Purpose: Send middle manager DM after all items are added (no timing issues)

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

interface RouteContext {
  params: { id: string }
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const purchaseRequestId = parseInt(context.params.id);
    
    if (!purchaseRequestId || isNaN(purchaseRequestId)) {
      return NextResponse.json(
        { error: 'Invalid purchase request ID' },
        { status: 400 }
      );
    }

    // supabase client is already imported

    // Use the new explicit function for accurate notification
    const { data: result, error } = await supabase
      .rpc('notify_middle_manager_explicit', {
        purchase_request_id_param: purchaseRequestId
      });

    if (error) {
      console.error('Error calling notify_middle_manager_explicit:', error);
      return NextResponse.json(
        { error: 'Failed to send notification', details: error.message },
        { status: 500 }
      );
    }

    if (!result?.success) {
      return NextResponse.json(
        { error: result?.error || 'Notification failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Middle manager notification sent successfully',
      data: result
    });

  } catch (error) {
    console.error('Error in notify-middle-manager API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}