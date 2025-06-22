import React from 'react';
import { cn } from '@/lib/utils';

// Page Title Component
interface PageTitleProps {
  children: React.ReactNode;
  className?: string;
}

export const PageTitle: React.FC<PageTitleProps> = ({ children, className }) => {
  return (
    <h1 className={cn('text-3xl font-bold text-gray-900 mb-2', className)}>
      {children}
    </h1>
  );
};

// Subtitle Component
interface SubTitleProps {
  children: React.ReactNode;
  className?: string;
}

export const SubTitle: React.FC<SubTitleProps> = ({ children, className }) => {
  return (
    <p className={cn('text-base text-gray-500', className)}>
      {children}
    </p>
  );
};

// Section Title Component
interface SectionTitleProps {
  children: React.ReactNode;
  className?: string;
}

export const SectionTitle: React.FC<SectionTitleProps> = ({ children, className }) => {
  return (
    <h2 className={cn('text-xl font-bold text-gray-900 mb-4', className)}>
      {children}
    </h2>
  );
};

// Field Label Component
interface FieldLabelProps {
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
  required?: boolean;
}

export const FieldLabel: React.FC<FieldLabelProps> = ({ 
  children, 
  htmlFor, 
  className,
  required = false 
}) => {
  return (
    <label 
      htmlFor={htmlFor}
      className={cn('block text-base font-medium text-gray-700 mb-2', className)}
    >
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
};

// Microcopy Component
interface MicroCopyProps {
  children: React.ReactNode;
  className?: string;
  centered?: boolean;
}

export const MicroCopy: React.FC<MicroCopyProps> = ({ 
  children, 
  className,
  centered = true 
}) => {
  return (
    <p className={cn(
      'text-sm text-gray-500',
      centered && 'text-center',
      className
    )}>
      {children}
    </p>
  );
};

// Display Names
PageTitle.displayName = 'PageTitle';
SubTitle.displayName = 'SubTitle';
SectionTitle.displayName = 'SectionTitle';
FieldLabel.displayName = 'FieldLabel';
MicroCopy.displayName = 'MicroCopy'; 