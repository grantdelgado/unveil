"use client";

import React, { useEffect, useState } from 'react';
import { LoadingOverlay } from './LoadingOverlay';

export const RouteSuspenseFallback: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 120);
    return () => clearTimeout(showTimer);
  }, []);

  if (!visible) return null;
  return <LoadingOverlay message="Loading..." />;
};

RouteSuspenseFallback.displayName = 'RouteSuspenseFallback';


