# SMS and Event Tagging Development Guide

**Last Updated:** September 19, 2025  
**Status:** Active Reference  
**Scope:** SMS messaging and event tagging implementation

## Overview

This guide consolidates all SMS messaging and event tagging development procedures, implementation patterns, and best practices. Use this as the primary reference for working with SMS features and event tagging in the Unveil application.

## SMS Implementation

### Core Components
- **SMS Service**: Handles message sending and delivery tracking
- **Provider Integration**: Twilio integration for SMS delivery
- **Delivery Tracking**: Status updates and error handling
- **Opt-out Management**: STOP/HELP command processing

### Event Tagging System

#### Tag Structure
- **Format**: Standardized tag format for consistency
- **Validation**: Server-side validation of tag formats
- **Storage**: Efficient storage and retrieval patterns
- **Querying**: Optimized queries for tag-based filtering

#### Implementation Patterns
1. **Tag Creation**: Consistent tag creation across the application
2. **Tag Assignment**: Bulk and individual tag assignment
3. **Tag Filtering**: Efficient filtering by tags
4. **Tag Management**: CRUD operations for tag management

### SMS Integration Best Practices

#### Message Composition
- Use consistent message templates
- Include proper opt-out instructions
- Respect character limits for single segments
- Handle special characters properly

#### Delivery Tracking
- Monitor delivery status updates
- Handle delivery failures gracefully
- Implement retry logic for failed messages
- Track delivery metrics for optimization

#### Compliance Requirements
- Include required opt-out language
- Handle STOP/HELP commands automatically
- Maintain consent records
- Provide clear privacy policy links

## Development Workflows

### Adding New SMS Features
1. **Design Phase**: Plan message flow and user experience
2. **Implementation**: Follow established patterns and conventions
3. **Testing**: Include SMS delivery and opt-out testing
4. **Deployment**: Monitor delivery rates and error rates

### Event Tag Features
1. **Schema Design**: Plan tag structure and relationships
2. **Validation**: Implement proper tag validation
3. **Performance**: Optimize tag queries and indexes
4. **User Experience**: Design intuitive tag management UI

## Troubleshooting

### Common SMS Issues
- **Delivery Failures**: Check provider status and message format
- **Opt-out Issues**: Verify STOP/HELP command processing
- **Rate Limiting**: Monitor sending rates and provider limits
- **Character Encoding**: Handle special characters and emojis

### Tag-Related Issues
- **Performance**: Optimize tag queries with proper indexes
- **Validation**: Ensure tag format consistency
- **Filtering**: Debug tag-based filtering logic
- **Bulk Operations**: Handle large tag operations efficiently

## Monitoring & Metrics

### SMS Metrics
- Delivery rates by provider
- Error rates and types
- Opt-out rates and trends
- Message volume and costs

### Tag Metrics
- Tag usage patterns
- Query performance
- Tag creation/deletion rates
- Filter usage statistics

---

## Appendix — Historical Notes (merged 2025-09-19)

*The following sections contain historical SMS and tagging implementation data that has been consolidated into this comprehensive guide.*
