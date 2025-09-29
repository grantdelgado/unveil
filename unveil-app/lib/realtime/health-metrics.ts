/**
 * In-memory counters for realtime health metrics
 * Reset on server restart (acceptable for health monitoring)
 */
class RealtimeHealthMetrics {
  private static instance: RealtimeHealthMetrics;
  private metrics = {
    activeChannels: 0,
    totalConnects: 0,
    totalDisconnects: 0,
    totalMessages: 0,
    totalErrors: 0,
    startTime: Date.now(),
    lastActivity: Date.now(),
  };

  private recentActivity: number[] = []; // Rolling 5-minute window

  static getInstance(): RealtimeHealthMetrics {
    if (!RealtimeHealthMetrics.instance) {
      RealtimeHealthMetrics.instance = new RealtimeHealthMetrics();
    }
    return RealtimeHealthMetrics.instance;
  }

  incrementActiveChannels() {
    this.metrics.activeChannels++;
    this.metrics.totalConnects++;
    this.updateActivity();
  }

  decrementActiveChannels() {
    this.metrics.activeChannels = Math.max(0, this.metrics.activeChannels - 1);
    this.metrics.totalDisconnects++;
    this.updateActivity();
  }

  incrementMessages() {
    this.metrics.totalMessages++;
    this.updateActivity();
  }

  incrementErrors() {
    this.metrics.totalErrors++;
    this.updateActivity();
  }

  private updateActivity() {
    const now = Date.now();
    this.metrics.lastActivity = now;
    
    // Add to rolling window
    this.recentActivity.push(now);
    
    // Keep only last 5 minutes
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    this.recentActivity = this.recentActivity.filter(time => time > fiveMinutesAgo);
  }

  getMetrics() {
    const now = Date.now();
    const uptime = now - this.metrics.startTime;
    const recentActivityRate = this.recentActivity.length / 5; // Events per minute over 5min window

    return {
      activeChannels: this.metrics.activeChannels,
      totalConnects: this.metrics.totalConnects,
      totalDisconnects: this.metrics.totalDisconnects,
      totalMessages: this.metrics.totalMessages,
      totalErrors: this.metrics.totalErrors,
      uptimeMs: uptime,
      lastActivityMs: now - this.metrics.lastActivity,
      recentActivityRate: Math.round(recentActivityRate * 10) / 10, // Round to 1 decimal
      healthScore: this.calculateHealthScore(),
    };
  }

  private calculateHealthScore(): number {
    const { totalConnects, totalErrors, activeChannels } = this.metrics;
    
    if (totalConnects === 0) return 100; // No connections yet, perfect score
    
    const errorRate = totalErrors / totalConnects;
    const baseScore = Math.max(0, 100 - (errorRate * 100));
    
    // Bonus for having active connections
    const activeBonus = activeChannels > 0 ? 5 : 0;
    
    return Math.min(100, Math.round(baseScore + activeBonus));
  }
}

// Export singleton instance for global use
export const realtimeHealthMetrics = RealtimeHealthMetrics.getInstance();
