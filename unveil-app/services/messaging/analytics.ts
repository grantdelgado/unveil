import { supabase } from '@/lib/supabase';
import type { Database } from '@/app/reference/supabase.types';

type MessageDelivery = Database['public']['Tables']['message_deliveries']['Row'];
type ScheduledMessage = Database['public']['Tables']['scheduled_messages']['Row'];
type EventGuest = Database['public']['Tables']['event_guests']['Row'];

export interface DeliveryStats {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalResponses: number;
  deliveryRate: number;
  responseRate: number;
  failureRate: number;
}

export interface EngagementMetrics {
  messageId: string;
  recipientCount: number;
  deliveredCount: number;
  openedCount: number;
  respondedCount: number;
  averageResponseTime: number | null; // in minutes
  engagementRate: number;
}

export interface RSVPCorrelation {
  messageId: string;
  beforeMessage: {
    attending: number;
    notAttending: number;
    pending: number;
  };
  afterMessage: {
    attending: number;
    notAttending: number;
    pending: number;
  };
  rsvpChangeRate: number;
  influenceScore: number; // how much the message influenced RSVPs
}

export interface MessageAnalytics {
  deliveryStats: DeliveryStats;
  engagementMetrics: EngagementMetrics[];
  rsvpCorrelations: RSVPCorrelation[];
  topPerformingMessages: Array<{
    messageId: string;
    content: string;
    engagementRate: number;
    deliveryRate: number;
  }>;
}

/**
 * Get comprehensive delivery statistics for an event
 */
export async function getDeliveryStatsForEvent(eventId: string): Promise<DeliveryStats> {
  try {
    // Get all scheduled messages for the event
    const { data: messages, error: messagesError } = await supabase
      .from('scheduled_messages')
      .select('id')
      .eq('event_id', eventId)
      .eq('status', 'sent');
    
    if (messagesError) throw messagesError;
    
    if (!messages || messages.length === 0) {
      return {
        totalSent: 0,
        totalDelivered: 0,
        totalFailed: 0,
        totalResponses: 0,
        deliveryRate: 0,
        responseRate: 0,
        failureRate: 0,
      };
    }
    
    const messageIds = messages.map(m => m.id);
    
    // Get delivery statistics
    const { data: deliveries, error: deliveriesError } = await supabase
      .from('message_deliveries')
      .select('sms_status, email_status, push_status, has_responded')
      .in('scheduled_message_id', messageIds);
    
    if (deliveriesError) throw deliveriesError;
    
    const totalSent = deliveries?.length || 0;
    // Consider delivered if any delivery method succeeded
    const totalDelivered = deliveries?.filter(d => 
      d.sms_status === 'delivered' || d.email_status === 'delivered' || d.push_status === 'delivered'
    ).length || 0;
    // Consider failed if all delivery methods failed
    const totalFailed = deliveries?.filter(d => 
      d.sms_status === 'failed' && d.email_status === 'failed' && d.push_status === 'failed'
    ).length || 0;
    const totalResponses = deliveries?.filter(d => d.has_responded === true).length || 0;
    
    return {
      totalSent,
      totalDelivered,
      totalFailed,
      totalResponses,
      deliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
      responseRate: totalDelivered > 0 ? (totalResponses / totalDelivered) * 100 : 0,
      failureRate: totalSent > 0 ? (totalFailed / totalSent) * 100 : 0,
    };
  } catch (error) {
    console.error('Error getting delivery stats:', error);
    throw new Error('Failed to fetch delivery statistics');
  }
}

/**
 * Get engagement metrics for a specific message
 */
export async function getEngagementMetrics(messageId: string): Promise<EngagementMetrics> {
  try {
    // Get message deliveries with status data
    const { data: deliveries, error: deliveriesError } = await supabase
      .from('message_deliveries')
      .select('sms_status, email_status, push_status, has_responded, created_at, updated_at')
      .eq('scheduled_message_id', messageId);
    
    if (deliveriesError) throw deliveriesError;
    
    const recipientCount = deliveries?.length || 0;
    const deliveredCount = deliveries?.filter(d => 
      d.sms_status === 'delivered' || d.email_status === 'delivered' || d.push_status === 'delivered'
    ).length || 0;
    // For now, we'll assume opened = delivered since we don't have read tracking yet
    const openedCount = deliveredCount;
    const respondedCount = deliveries?.filter(d => d.has_responded === true).length || 0;
    
    // Calculate average response time (simplified - using updated_at as proxy for response time)
    const responseTimes = deliveries
      ?.filter(d => d.has_responded && d.created_at && d.updated_at)
      .map(d => {
        const created = new Date(d.created_at!);
        const updated = new Date(d.updated_at!);
        return (updated.getTime() - created.getTime()) / (1000 * 60); // minutes
      }) || [];
    
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : null;
    
    return {
      messageId,
      recipientCount,
      deliveredCount,
      openedCount,
      respondedCount,
      averageResponseTime,
      engagementRate: deliveredCount > 0 ? ((openedCount + respondedCount) / deliveredCount) * 100 : 0,
    };
  } catch (error) {
    console.error('Error getting engagement metrics:', error);
    throw new Error('Failed to fetch engagement metrics');
  }
}

/**
 * Analyze RSVP correlation for a message
 */
export async function getRSVPCorrelation(messageId: string): Promise<RSVPCorrelation> {
  try {
    // Get the message details
    const { data: message, error: messageError } = await supabase
      .from('scheduled_messages')
      .select('event_id, sent_at')
      .eq('id', messageId)
      .single();
    
    if (messageError) throw messageError;
    if (!message?.sent_at) {
      throw new Error('Message has not been sent yet');
    }
    
    const eventId = message.event_id;
    const sentAt = new Date(message.sent_at);
    const dayBefore = new Date(sentAt.getTime() - 24 * 60 * 60 * 1000);
    const dayAfter = new Date(sentAt.getTime() + 24 * 60 * 60 * 1000);
    
    // Get RSVP data before message was sent
    const { data: beforeRSVPs, error: beforeError } = await supabase
      .from('event_guests')
      .select('rsvp_status')
      .eq('event_id', eventId)
      .lt('updated_at', sentAt.toISOString());
    
    if (beforeError) throw beforeError;
    
    // Get RSVP data after message was sent (within 24 hours)
    const { data: afterRSVPs, error: afterError } = await supabase
      .from('event_guests')
      .select('rsvp_status')
      .eq('event_id', eventId)
      .gte('updated_at', sentAt.toISOString())
      .lt('updated_at', dayAfter.toISOString());
    
    if (afterError) throw afterError;
    
    const beforeStats = {
      attending: beforeRSVPs?.filter(r => r.rsvp_status === 'attending').length || 0,
      notAttending: beforeRSVPs?.filter(r => r.rsvp_status === 'not_attending').length || 0,
      pending: beforeRSVPs?.filter(r => r.rsvp_status === 'pending').length || 0,
    };
    
    const afterStats = {
      attending: afterRSVPs?.filter(r => r.rsvp_status === 'attending').length || 0,
      notAttending: afterRSVPs?.filter(r => r.rsvp_status === 'not_attending').length || 0,
      pending: afterRSVPs?.filter(r => r.rsvp_status === 'pending').length || 0,
    };
    
    const totalChanges = afterStats.attending + afterStats.notAttending + afterStats.pending;
    const totalBefore = beforeStats.attending + beforeStats.notAttending + beforeStats.pending;
    
    const rsvpChangeRate = totalBefore > 0 ? (totalChanges / totalBefore) * 100 : 0;
    
    // Calculate influence score based on positive RSVP changes
    const positiveChanges = afterStats.attending;
    const influenceScore = totalChanges > 0 ? (positiveChanges / totalChanges) * 100 : 0;
    
    return {
      messageId,
      beforeMessage: beforeStats,
      afterMessage: afterStats,
      rsvpChangeRate,
      influenceScore,
    };
  } catch (error) {
    console.error('Error getting RSVP correlation:', error);
    throw new Error('Failed to analyze RSVP correlation');
  }
}

/**
 * Get comprehensive analytics for an event
 */
export async function getEventAnalytics(eventId: string): Promise<MessageAnalytics> {
  try {
    // Get all sent messages for the event
    const { data: messages, error: messagesError } = await supabase
      .from('scheduled_messages')
      .select('id, content')
      .eq('event_id', eventId)
      .eq('status', 'sent')
      .order('sent_at', { ascending: false })
      .limit(10);
    
    if (messagesError) throw messagesError;
    
    // Get overall delivery stats
    const deliveryStats = await getDeliveryStatsForEvent(eventId);
    
    // Get engagement metrics for each message
    const engagementMetrics = await Promise.all(
      (messages || []).map(message => getEngagementMetrics(message.id))
    );
    
    // Get RSVP correlations for messages (only recent ones to avoid overload)
    const rsvpCorrelations = await Promise.all(
      (messages || []).slice(0, 5).map(message => 
        getRSVPCorrelation(message.id).catch(error => {
          console.warn(`Failed to get RSVP correlation for message ${message.id}:`, error);
          return null;
        })
      )
    ).then(results => results.filter(Boolean) as RSVPCorrelation[]);
    
    // Calculate top performing messages
    const topPerformingMessages = (messages || [])
      .map(message => {
        const metrics = engagementMetrics.find(m => m.messageId === message.id);
        return {
          messageId: message.id,
          content: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
          engagementRate: metrics?.engagementRate || 0,
          deliveryRate: metrics ? (metrics.deliveredCount / metrics.recipientCount) * 100 : 0,
        };
      })
      .sort((a, b) => b.engagementRate - a.engagementRate)
      .slice(0, 5);
    
    return {
      deliveryStats,
      engagementMetrics,
      rsvpCorrelations,
      topPerformingMessages,
    };
  } catch (error) {
    console.error('Error getting event analytics:', error);
    throw new Error('Failed to fetch event analytics');
  }
}

/**
 * Enhanced delivery tracking helpers
 */
export async function recordDeliveryStatus(
  messageDeliveryId: string,
  deliveryMethod: 'sms' | 'email' | 'push',
  status: 'delivered' | 'failed',
  providerId?: string
): Promise<void> {
  try {
    const updateData: Partial<MessageDelivery> = {
      updated_at: new Date().toISOString(),
    };
    
    // Update the appropriate status and provider ID based on delivery method
    switch (deliveryMethod) {
      case 'sms':
        updateData.sms_status = status;
        if (providerId) updateData.sms_provider_id = providerId;
        break;
      case 'email':
        updateData.email_status = status;
        if (providerId) updateData.email_provider_id = providerId;
        break;
      case 'push':
        updateData.push_status = status;
        if (providerId) updateData.push_provider_id = providerId;
        break;
    }
    
    const { error } = await supabase
      .from('message_deliveries')
      .update(updateData)
      .eq('id', messageDeliveryId);
    
    if (error) throw error;
  } catch (error) {
    console.error('Error recording delivery status:', error);
    throw new Error('Failed to record delivery status');
  }
}

/**
 * Record that a message was read (opened) by a guest
 * Note: Current schema doesn't have read tracking, this is a placeholder for future implementation
 */
export async function recordMessageRead(
  messageDeliveryId: string,
  readAt: Date = new Date()
): Promise<void> {
  try {
    // For now, we'll just update the timestamp since we don't have read_at column
    const { error } = await supabase
      .from('message_deliveries')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('id', messageDeliveryId);
    
    if (error) throw error;
    
    // TODO: Add read_at column to message_deliveries table for proper read tracking
    console.log(`Message read recorded for delivery ${messageDeliveryId} at ${readAt.toISOString()}`);
  } catch (error) {
    console.error('Error recording message read:', error);
    throw new Error('Failed to record message read');
  }
}

/**
 * Record that a guest responded to a message
 */
export async function recordMessageResponse(
  messageDeliveryId: string,
  respondedAt: Date = new Date()
): Promise<void> {
  try {
    const { error } = await supabase
      .from('message_deliveries')
      .update({
        has_responded: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', messageDeliveryId);
    
    if (error) throw error;
  } catch (error) {
    console.error('Error recording message response:', error);
    throw new Error('Failed to record message response');
  }
}

/**
 * Calculate response rates for different message types
 */
export async function getResponseRatesByMessageType(eventId: string): Promise<Array<{
  messageType: string;
  totalSent: number;
  totalResponses: number;
  responseRate: number;
}>> {
  try {
    const { data, error } = await supabase
      .from('scheduled_messages')
      .select(`
        message_type,
        message_deliveries (
          has_responded
        )
      `)
      .eq('event_id', eventId)
      .eq('status', 'sent');
    
    if (error) throw error;
    
    const stats = (data || []).reduce((acc, message) => {
      const messageType = message.message_type || 'unknown';
      const deliveries = message.message_deliveries || [];
      const responses = deliveries.filter(d => d.has_responded === true);
      
      if (!acc[messageType]) {
        acc[messageType] = { totalSent: 0, totalResponses: 0 };
      }
      
      acc[messageType].totalSent += deliveries.length;
      acc[messageType].totalResponses += responses.length;
      
      return acc;
    }, {} as Record<string, { totalSent: number; totalResponses: number }>);
    
    return Object.entries(stats).map(([messageType, data]) => ({
      messageType,
      totalSent: data.totalSent,
      totalResponses: data.totalResponses,
      responseRate: data.totalSent > 0 ? (data.totalResponses / data.totalSent) * 100 : 0,
    }));
  } catch (error) {
    console.error('Error getting response rates by message type:', error);
    throw new Error('Failed to calculate response rates by message type');
  }
} 