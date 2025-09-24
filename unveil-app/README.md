# 🎪 Unveil

> **Modern Wedding Event Management Platform** — Mobile-first, real-time communication and memory sharing for hosts and guests

Unveil is a production-ready wedding event management application that enables hosts to create events and manage guests, while providing guests with real-time photo sharing, messaging, and RSVP capabilities.

---

## 🚀 Quick Start

### **New Team Members**

1. **[📚 Read the Documentation](./docs/)** — Complete platform overview and development guides
2. **🏗️ Architecture Overview** — Technical foundation and design patterns
3. **🔧 Development Setup** — Workflow, standards, and contribution guidelines

### **Production Deployment**

1. **📋 Release Checklist** — Step-by-step production deployment guide
2. **⚙️ Deployment Guide** — Environment setup and operations

---

## 📋 Current Status

**Version**: v1.0.0 Production Ready  
**Phase**: 7 - Final Integration & Launch Preparation  
**Documentation**: ✅ Complete and centralized in [`/docs`](./docs/)

### 🏆 Key Achievements

- **🔐 Authentication**: Phone-first OTP with Supabase Auth + Twilio
- **📱 Mobile Experience**: Responsive design optimized for phones
- **⚡ Real-time Features**: Live messaging and photo sharing
- **🛡️ Security**: Enterprise-level Row Level Security (RLS)
- **📊 Performance**: Sub-100ms page loads, 99.9% uptime target

---

## 🎯 MVP Features

### For Event Hosts

- **Event Creation & Management** — Create weddings, manage details and timelines
- **Guest Management** — Invite participants, track RSVPs, manage roles
- **Real-time Messaging** — Send announcements to all guests
- **Media Gallery** — View and organize all uploaded photos/videos
- **Analytics Dashboard** — Monitor guest engagement and metrics

### For Event Guests

- **RSVP Management** — Confirm attendance and update status
- **Photo Sharing** — Upload and view event photos in real-time
- **Messaging** — Communicate with hosts and other guests
- **Event Access** — View schedules, locations, and details

**👉 Complete Feature Documentation**

---

## 🛠️ Technology Stack

**Frontend**: Next.js 14 + TypeScript + Tailwind CSS  
**Backend**: Supabase (PostgreSQL + Storage + Realtime + Auth)  
**Deployment**: Vercel  
**Package Manager**: pnpm

### Architecture / Hooks

> **Note**: Messaging hook consolidation is deferred. All live code continues to use the existing hooks (`useMessages`, `useScheduledMessages`, etc.). Experimental work has been archived in the `feature/messaging-consolidation-experiments` branch.

**👉 Complete Technical Documentation**

---

## 📚 Documentation

All documentation has been consolidated and organized in the **[`/docs`](./docs/)** folder:

| **Document**                                            | **Purpose**                                         |
| ------------------------------------------------------- | --------------------------------------------------- |
| **📋 System Overview**     | High-level platform overview and current status     |
| **🏗️ Architecture**           | Complete technical architecture and design patterns |
| **🔧 Development Guide** | Workflow, coding standards, and team guidelines     |
| **📋 MVP Features**           | Current scope, included/excluded features, roadmap  |
| **🛡️ Security**                   | Security implementation and best practices          |
| **🎨 Design System**         | UI components and design patterns                   |
| **⚙️ Deployment**               | Production environment setup procedures             |
| **📋 Release Checklist** | Comprehensive deployment checklist                  |

**👉 [Browse All Documentation](./docs/)**

---

## 🔧 Development

### Local Setup

```bash
# Install dependencies
pnpm install

# Set up Supabase
supabase start
supabase db reset

# Generate types
pnpm supabase:types

# Start development server
pnpm dev
```

### Code Quality

```bash
# Lint and format
pnpm lint
pnpm lint:fix
pnpm format

# Run tests
pnpm test
pnpm test:e2e
```

**👉 Complete Development Guide**

---

## 🚀 Deployment

### Production Checklist

- ✅ Clean TypeScript build
- ✅ All tests passing
- ✅ Environment variables configured
- ✅ Database migrations applied
- ✅ Security verification complete

**👉 Full Release Checklist**

---

## 📞 Support & Contact

- **📚 Documentation**: [`/docs`](./docs/) folder contains comprehensive guides
- **🔧 Technical Issues**: See Architecture Guide and Development Guide
- **🚀 Deployment**: See Release Checklist and Deployment Guide

---

_Unveil represents world-class product development with comprehensive documentation, enterprise-grade security, and production-ready architecture suitable for scaling teams and investor presentations._

**Last Updated**: January 2025 | **Status**: Production Ready | **Docs**: ✅ Complete
