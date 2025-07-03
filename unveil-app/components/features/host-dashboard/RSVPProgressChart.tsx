'use client';

import React, { memo } from 'react';

interface StatusCount {
  attending: number;
  pending: number;
  declined: number;
  maybe: number;
  total: number;
}

interface RSVPProgressChartProps {
  statusCounts: StatusCount;
}

export const RSVPProgressChart = memo<RSVPProgressChartProps>(({ statusCounts }) => {
  const { attending, maybe, declined, total } = statusCounts;
  
  if (total === 0) {
    return (
      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
        <span className="text-xs text-gray-500">No guests</span>
      </div>
    );
  }

  const responded = attending + maybe + declined;
  const responseRate = Math.round((responded / total) * 100);
  
  const radius = 30;
  const strokeWidth = 6;
  const normalizedRadius = radius - strokeWidth * 0.5;
  const circumference = normalizedRadius * 2 * Math.PI;
  
  const attendingPercent = (attending / total) * 100;
  const maybePercent = (maybe / total) * 100;
  const declinedPercent = (declined / total) * 100;
  const pendingPercent = ((total - responded) / total) * 100;
  
  // Calculate stroke dash arrays for each segment
  const attendingDash = (attendingPercent / 100) * circumference;
  const maybeDash = (maybePercent / 100) * circumference;
  const declinedDash = (declinedPercent / 100) * circumference;
  const pendingDash = (pendingPercent / 100) * circumference;
  
  // Calculate stroke dash offsets
  let currentOffset = 0;
  const attendingOffset = currentOffset;
  currentOffset += attendingDash;
  const maybeOffset = currentOffset;
  currentOffset += maybeDash;
  const declinedOffset = currentOffset;
  currentOffset += declinedDash;
  const pendingOffset = currentOffset;

  return (
    <div className="relative w-20 h-20">
      <svg
        width="60"
        height="60"
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          stroke="#f3f4f6"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={normalizedRadius}
          cx="30"
          cy="30"
        />
        
        {/* Attending segment */}
        {attending > 0 && (
          <circle
            stroke="#10b981"
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={`${attendingDash} ${circumference - attendingDash}`}
            strokeDashoffset={-attendingOffset}
            r={normalizedRadius}
            cx="30"
            cy="30"
            strokeLinecap="round"
          />
        )}
        
        {/* Maybe segment */}
        {maybe > 0 && (
          <circle
            stroke="#f59e0b"
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={`${maybeDash} ${circumference - maybeDash}`}
            strokeDashoffset={-maybeOffset}
            r={normalizedRadius}
            cx="30"
            cy="30"
            strokeLinecap="round"
          />
        )}
        
        {/* Declined segment */}
        {declined > 0 && (
          <circle
            stroke="#ef4444"
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={`${declinedDash} ${circumference - declinedDash}`}
            strokeDashoffset={-declinedOffset}
            r={normalizedRadius}
            cx="30"
            cy="30"
            strokeLinecap="round"
          />
        )}
        
        {/* Pending segment */}
        {total - responded > 0 && (
          <circle
            stroke="#d1d5db"
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={`${pendingDash} ${circumference - pendingDash}`}
            strokeDashoffset={-pendingOffset}
            r={normalizedRadius}
            cx="30"
            cy="30"
            strokeLinecap="round"
          />
        )}
      </svg>
      
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-gray-900">
          {responseRate}%
        </span>
        <span className="text-xs text-gray-500">
          responded
        </span>
      </div>
    </div>
  );
});

RSVPProgressChart.displayName = 'RSVPProgressChart';