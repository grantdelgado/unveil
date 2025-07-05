import { supabase } from '@/lib/supabase';
import type { Database } from '@/app/reference/supabase.types';
import { logger } from '@/lib/logger';

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
  totalRead: number;
  readRate: number;
  readRatio: number;
}

export interface EngagementMetrics {
  messageId: string;
  recipientCount: number;
  deliveredCount: number;
  openedCount: number;
  respondedCount: number;
  averageResponseTime: number | null; // in minutes
  engagementRate: number;
  averageTimeToRead: number | null; // average time between delivery and read (minutes)
  readRate: number; // percentage of delivered messages that were read
  responseToReadRatio: number; // percentage of read messages that got responses
}

export interface ResponseRateOverTime {
  timeRange: string; // '2024-01', '2024-01-15', etc.
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalResponses: number;
  deliveryRate: number;
  readRate: number;
  responseRate: number;
  averageTimeToRead: number | null;
  averageTimeToResponse: number | null;
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

export interface TopPerformingMessage {
  messageId: string;
  content: string;
  engagementRate: number;
  deliveryRate: number;
  readRate: number;
  responseRate: number;
  engagementScore: number;
  sentAt: string;
}

export interface MessageAnalytics {
  deliveryStats: DeliveryStats;
  engagementMetrics: EngagementMetrics[];
  rsvpCorrelations: RSVPCorrelation[];
  responseRatesOverTime: ResponseRateOverTime[];
  topPerformingMessages: TopPerformingMessage[];
}

/**
 * Get comprehensive delivery statistics for an event with enhanced read tracking
 * OPTIMIZED: Uses separate queries instead of complex JOINs for better performance
 */
export async function getDeliveryStatsForEvent(eventId: string): Promise<DeliveryStats> {
  try {
    // Step 1: Get scheduled message IDs (fast, simple query)
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
        totalRead: 0,
        deliveryRate: 0,
        responseRate: 0,
        failureRate: 0,
        readRate: 0,
        readRatio: 0,
      };
    }
    
    const messageIds = messages.map(m => m.id);
    
    // Step 2: Get delivery statistics (separate, optimized query)
    // Only select essential fields to reduce data transfer
    const { data: deliveries, error: deliveriesError } = await supabase
      .from('message_deliveries')
      .select('sms_status, email_status, push_status, has_responded, created_at, updated_at')
      .in('scheduled_message_id', messageIds);
    
    if (deliveriesError) throw deliveriesError;
    
    // Step 3: Compute statistics on client side (faster than complex DB aggregations)
    const totalSent = deliveries?.length || 0;
    
    // Use optimized counting logic
    let totalDelivered = 0;
    let totalFailed = 0;
    let totalResponses = 0;
    let totalRead = 0;
    
    if (deliveries) {
      for (const delivery of deliveries) {
        // Count delivered (any method succeeded)
        if (delivery.sms_status === 'delivered' || 
            delivery.email_status === 'delivered' || 
            delivery.push_status === 'delivered') {
          totalDelivered++;
        }
        
        // Count failed (all methods failed)
        if (delivery.sms_status === 'failed' && 
            delivery.email_status === 'failed' && 
            delivery.push_status === 'failed') {
          totalFailed++;
        }
        
        // Count responses
        if (delivery.has_responded === true) {
          totalResponses++;
          totalRead++; // Responses imply reading
        } else {
          // Read heuristic: significant time between create/update suggests engagement
          if (delivery.created_at && delivery.updated_at) {
            const timeDiff = new Date(delivery.updated_at).getTime() - new Date(delivery.created_at).getTime();
            if (timeDiff > 60000) { // More than 1 minute difference
              totalRead++;
            }
          }
        }
      }
    }
    
    // Calculate rates
    const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
    const readRate = totalSent > 0 ? (totalRead / totalSent) * 100 : 0;
    const readRatio = totalDelivered > 0 ? (totalRead / totalDelivered) * 100 : 0;
    const responseRate = totalDelivered > 0 ? (totalResponses / totalDelivered) * 100 : 0;
    const failureRate = totalSent > 0 ? (totalFailed / totalSent) * 100 : 0;
    
    return {
      totalSent,
      totalDelivered,
      totalFailed,
      totalResponses,
      totalRead,
      deliveryRate,
      responseRate,
      failureRate,
      readRate,
      readRatio,
    };
  } catch (error) {
    logger.databaseError('Error getting delivery stats', error);
    throw new Error('Failed to fetch delivery statistics');
  }
}

/**
 * Get enhanced engagement metrics for a specific message with read tracking
 */
export async function getEngagementMetrics(messageId: string): Promise<EngagementMetrics> {
  try {
    const { data: deliveries, error } = await supabase
      .from('message_deliveries')
      .select('*')
      .eq('message_id', messageId);
    
    if (error) {
      logger.databaseError('Error fetching delivery data', error);
      throw new Error(`Failed to fetch delivery data: ${error.message}`);
    }
    
    if (!deliveries || deliveries.length === 0) {
      return {
        messageId,
        recipientCount: 0,
        deliveredCount: 0,
        openedCount: 0,
        respondedCount: 0,
        averageResponseTime: null,
        averageTimeToRead: null,
        engagementRate: 0,
        readRate: 0,
        responseToReadRatio: 0,
      };
    }
    
    const recipientCount = deliveries.length;
    const deliveredDeliveries = deliveries.filter(d => 
      d.sms_status === 'delivered' || 
      d.email_status === 'delivered' || 
      d.push_status === 'delivered'
    );
    const deliveredCount = deliveredDeliveries.length;
    
    // Enhanced: Calculate read metrics
    const readDeliveries = deliveries.filter(d => {
      // FUTURE: Use read_at if available (Phase 6 read receipts)
      // if (d.read_at) return true;
      // Fallback heuristics
      if (d.has_responded) return true;
      if (d.created_at && d.updated_at) {
        const timeDiff = new Date(d.updated_at).getTime() - new Date(d.created_at).getTime();
        return timeDiff > 60000; // More than 1 minute suggests read
      }
      return false;
    });
    const openedCount = readDeliveries.length;
    const respondedCount = deliveries.filter(d => d.has_responded === true).length;
    
    // Calculate time-to-read metrics
    let averageTimeToRead: number | null = null;
    const readTimes = readDeliveries
      .filter(d => d.created_at && d.updated_at)
      .map(d => {
        const created = new Date(d.created_at!);
        // FUTURE: Use d.read_at when Phase 6 is implemented
        const readTime = new Date(d.updated_at!);
        return (readTime.getTime() - created.getTime()) / (1000 * 60); // minutes
      })
      .filter(time => time >= 0 && time < 24 * 60); // Filter out invalid times
    
    if (readTimes.length > 0) {
      averageTimeToRead = readTimes.reduce((sum, time) => sum + time, 0) / readTimes.length;
    }
    
    // Calculate response times (existing logic)
    let averageResponseTime: number | null = null;
    const responseTimes = deliveries
      .filter(d => d.has_responded && d.created_at && d.updated_at)
      .map(d => {
        const created = new Date(d.created_at!);
        const updated = new Date(d.updated_at!);
        return (updated.getTime() - created.getTime()) / (1000 * 60); // minutes
      })
      .filter(time => time >= 0 && time < 24 * 60); // Filter out invalid times
    
    if (responseTimes.length > 0) {
      averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    }
    
    // Enhanced rate calculations
    const readRate = deliveredCount > 0 ? (openedCount / deliveredCount) * 100 : 0;
    const responseToReadRatio = openedCount > 0 ? (respondedCount / openedCount) * 100 : 0;
    const engagementRate = recipientCount > 0 ? ((deliveredCount + respondedCount) / recipientCount) * 100 : 0;
    
    return {
      messageId,
      recipientCount,
      deliveredCount,
      openedCount,
      respondedCount,
      averageResponseTime,
      averageTimeToRead,
      engagementRate,
      readRate,
      responseToReadRatio,
    };
  } catch (error) {
    logger.databaseError('Error getting engagement metrics', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get engagement metrics';
    throw new Error(errorMessage);
  }
}

/**
 * Get response rates over time for trend analysis
 */
export async function getResponseRatesOverTime(
  eventId: string,
  granularity: 'day' | 'week' | 'month' = 'day',
  daysBack: number = 30
): Promise<ResponseRateOverTime[]> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    
    const { data: messages, error: messagesError } = await supabase
      .from('scheduled_messages')
      .select(`
        id,
        sent_at,
        message_deliveries (
          created_at,
          sms_status,
          email_status,
          push_status,
          has_responded,
          updated_at
        )
      `)
      .eq('event_id', eventId)
      .eq('status', 'sent')
      .gte('sent_at', startDate.toISOString())
      .order('sent_at', { ascending: true });
    
    if (messagesError) throw messagesError;
    
    // Group data by time period
    interface DeliveryRecord {
      created_at: string;
      sms_status: string | null;
      email_status: string | null;
      push_status: string | null;
      has_responded: boolean;
      updated_at: string;
      read_at?: string | null;
    }
    
    const timeGroups: Record<string, {
      deliveries: DeliveryRecord[];
    }> = {};
    
    (messages || []).forEach(message => {
      if (!message.sent_at) return;
      
      const sentDate = new Date(message.sent_at);
      let timeKey: string;
      
      switch (granularity) {
        case 'month':
          timeKey = `${sentDate.getFullYear()}-${String(sentDate.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'week':
          const weekStart = new Date(sentDate);
          weekStart.setDate(sentDate.getDate() - sentDate.getDay());
          timeKey = weekStart.toISOString().split('T')[0];
          break;
        case 'day':
        default:
          timeKey = sentDate.toISOString().split('T')[0];
          break;
      }
      
      if (!timeGroups[timeKey]) {
        timeGroups[timeKey] = { deliveries: [] };
      }
      
      // Filter out deliveries with null created_at values
      const validDeliveries = (message.message_deliveries || []).filter(
        (delivery): delivery is DeliveryRecord => delivery.created_at !== null
      );
      timeGroups[timeKey].deliveries.push(...validDeliveries);
    });
    
    // Calculate metrics for each time period
    const results: ResponseRateOverTime[] = Object.entries(timeGroups).map(([timeRange, data]) => {
      const deliveries = data.deliveries;
      const totalSent = deliveries.length;
      
      const deliveredDeliveries = deliveries.filter(d => 
        d.sms_status === 'delivered' || 
        d.email_status === 'delivered' || 
        d.push_status === 'delivered'
      );
      const totalDelivered = deliveredDeliveries.length;
      
      const readDeliveries = deliveries.filter(d => {
        if (d.read_at) return true;
        if (d.has_responded) return true;
        if (d.created_at && d.updated_at) {
          const timeDiff = new Date(d.updated_at).getTime() - new Date(d.created_at).getTime();
          return timeDiff > 60000;
        }
        return false;
      });
      const totalRead = readDeliveries.length;
      
      const totalResponses = deliveries.filter(d => d.has_responded === true).length;
      
      // Calculate average times
      const readTimes = readDeliveries
        .filter(d => d.created_at && (d.read_at || d.updated_at))
        .map(d => {
          const created = new Date(d.created_at);
          const readTime = d.read_at ? new Date(d.read_at) : new Date(d.updated_at);
          return (readTime.getTime() - created.getTime()) / (1000 * 60);
        })
        .filter(time => time >= 0 && time < 24 * 60);
      
      const responseTimes = deliveries
        .filter(d => d.has_responded && d.created_at && d.updated_at)
        .map(d => {
          const created = new Date(d.created_at);
          const updated = new Date(d.updated_at);
          return (updated.getTime() - created.getTime()) / (1000 * 60);
        })
        .filter(time => time >= 0 && time < 24 * 60);
      
      const averageTimeToRead = readTimes.length > 0 
        ? readTimes.reduce((sum, time) => sum + time, 0) / readTimes.length 
        : null;
      
      const averageTimeToResponse = responseTimes.length > 0 
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
        : null;
      
      return {
        timeRange,
        totalSent,
        totalDelivered,
        totalRead,
        totalResponses,
        deliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
        readRate: totalDelivered > 0 ? (totalRead / totalDelivered) * 100 : 0,
        responseRate: totalDelivered > 0 ? (totalResponses / totalDelivered) * 100 : 0,
        averageTimeToRead,
        averageTimeToResponse,
      };
    });
    
    return results.sort((a, b) => a.timeRange.localeCompare(b.timeRange));
  } catch (error) {
    logger.databaseError('Error getting response rates over time', error);
    throw new Error('Failed to calculate response rates over time');
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
    logger.databaseError('Error getting RSVP correlation', error);
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
      .select('id, content, sent_at, created_at')
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
          logger.warn(`Failed to get RSVP correlation for message ${message.id}`, error);
          return null;
        })
      )
    ).then(results => results.filter(Boolean) as RSVPCorrelation[]);
    
    // Get response rates over time
    const responseRatesOverTime = await getResponseRatesOverTime(eventId);
    
    // Calculate top performing messages
    const topPerformingMessages = (messages || [])
      .map(message => {
        const metrics = engagementMetrics.find(m => m.messageId === message.id);
        const engagementRate = metrics?.engagementRate || 0;
        const deliveryRate = metrics ? (metrics.deliveredCount / metrics.recipientCount) * 100 : 0;
        const readRate = metrics ? (metrics.openedCount / metrics.deliveredCount) * 100 : 0;
        const responseRate = metrics ? (metrics.respondedCount / metrics.openedCount) * 100 : 0;
        
        // Calculate engagement score as weighted average of key metrics
        const engagementScore = (engagementRate * 0.4) + (readRate * 0.3) + (responseRate * 0.3);
        
        return {
          messageId: message.id,
          content: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
          engagementRate,
          deliveryRate,
          readRate,
          responseRate,
          engagementScore,
          sentAt: message.sent_at || message.created_at || new Date().toISOString(),
        };
      })
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, 5);
    
    return {
      deliveryStats,
      engagementMetrics,
      rsvpCorrelations,
      responseRatesOverTime,
      topPerformingMessages,
    };
  } catch (error) {
    logger.databaseError('Error getting event analytics', error);
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
    logger.databaseError('Error recording delivery status', error);
    throw new Error('Failed to record delivery status');
  }
}

/**
 * Record that a message was read (opened) by a guest
 * FUTURE: Update to use read_at column in Phase 6 read receipts
 */
export async function recordMessageRead(
  messageDeliveryId: string,
  readAt: Date = new Date()
): Promise<void> {
  try {
    // FUTURE: Update to set read_at column in Phase 6 schema
    // For now, we'll just update the timestamp as a placeholder
    const { error } = await supabase
      .from('message_deliveries')
      .update({
        updated_at: readAt.toISOString(),
      })
      .eq('id', messageDeliveryId);
    
    if (error) {
      logger.databaseError('Error updating read status', error);
      throw new Error(`Failed to record message read: ${error.message}`);
    }
  } catch (error) {
    logger.databaseError('Error recording message read', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to record message read';
    throw new Error(errorMessage);
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
    logger.databaseError('Error recording message response', error);
    throw new Error('Failed to record message response');
  }
}

/**
 * Calculate response rates for different message types
 * OPTIMIZED: Uses separate queries instead of complex JOIN for better performance
 */
export async function getResponseRatesByMessageType(eventId: string): Promise<Array<{
  messageType: string;
  totalSent: number;
  totalResponses: number;
  responseRate: number;
}>> {
  try {
    // Step 1: Get scheduled messages (simple, fast query)
    const { data: messages, error: messagesError } = await supabase
      .from('scheduled_messages')
      .select('id, message_type')
      .eq('event_id', eventId)
      .eq('status', 'sent');
    
    if (messagesError) throw messagesError;
    
    if (!messages || messages.length === 0) {
      return [];
    }
    
    const messageIds = messages.map(m => m.id);
    
    // Step 2: Get delivery responses (separate, optimized query)
    const { data: deliveries, error: deliveriesError } = await supabase
      .from('message_deliveries')
      .select('scheduled_message_id, has_responded')
      .in('scheduled_message_id', messageIds);
    
    if (deliveriesError) throw deliveriesError;
    
    // Step 3: Merge results on client side (faster than complex DB aggregations)
    const deliveryMap = new Map<string, { total: number; responses: number }>();
    
    // Initialize counts for all message types
    for (const message of messages) {
      const messageType = message.message_type || 'unknown';
      if (!deliveryMap.has(messageType)) {
        deliveryMap.set(messageType, { total: 0, responses: 0 });
      }
    }
    
    // Count deliveries and responses efficiently
    if (deliveries) {
      for (const delivery of deliveries) {
        // Find the message type for this delivery
        const message = messages.find(m => m.id === delivery.scheduled_message_id);
        if (message) {
          const messageType = message.message_type || 'unknown';
          const stats = deliveryMap.get(messageType)!;
          
          stats.total++;
          if (delivery.has_responded === true) {
            stats.responses++;
          }
        }
      }
    }
    
    // Convert to final format
    return Array.from(deliveryMap.entries()).map(([messageType, stats]) => ({
      messageType,
      totalSent: stats.total,
      totalResponses: stats.responses,
      responseRate: stats.total > 0 ? (stats.responses / stats.total) * 100 : 0,
    }));
  } catch (error) {
    logger.databaseError('Error getting response rates by message type', error);
    throw new Error('Failed to calculate response rates by message type');
  }
} 