# Unveil – Wedding Communication & Memory Platform

Unveil is a modern, mobile-first app designed to help couples communicate effortlessly with their wedding guests, stay organized across their wedding weekend, and preserve shared memories for years to come. It's built for hosts and guests alike—with real-time messaging, media sharing, and a post-wedding time capsule experience.

This project is being developed as a clean, production-grade MVP and will be tested live at the creator's own wedding.

---

## ✨ Core Purpose

Unveil simplifies wedding communication and memory sharing—before, during, and after the event. Hosts can send updates, manage schedules, and collect media. Guests can stay informed, upload photos, and revisit memories over time.

---

## 🎉 Current Features (Latest Update)

### **🏠 Comprehensive Host Dashboard**

- **Tabbed Interface**: Overview, Guests, Messages, Event Setup
- **Real-time Statistics**: Live RSVP counts and guest analytics
- **Quick Actions Sidebar**: Instant access to key functions
- **Getting Started Flow**: Step-by-step guidance for new hosts

### **🎪 Multi-Event Management**

- **Sub-Event Creation**: Rehearsal Dinner, Ceremony, Reception, and custom events
- **Event Details**: Date, time, location, and descriptions for each event
- **Required vs Optional Events**: Flexible guest assignment options
- **Integration Guidance**: Clear next steps for guest management

### **👥 Advanced Guest Management**

- **Bulk Operations**: Mass assignment/removal from events with checkbox selection
- **Smart Filtering**: Search by name/email/phone, filter by event and RSVP status
- **Visual Organization**: Color-coded RSVP indicators and event assignment tags
- **Individual Management**: Edit capabilities for each guest
- **Guest Import**: CSV upload wizard for bulk guest addition

### **💬 Sophisticated Messaging System**

- **Flexible Scheduling**: Immediate or future message scheduling
- **Multi-channel Delivery**: SMS (primary), Push notifications, Email options
- **Advanced Targeting**: All guests, specific events, guest tags, or individuals
- **Live Preview**: Real-time recipient count and message preview
- **SMS Optimization**: Character counting and delivery optimization

### **📊 Real-time Analytics**

- **RSVP Tracking**: Live attendance statistics
- **Guest Insights**: Event participation and response rates
- **Message Analytics**: Delivery tracking across channels

---

## 🧱 Tech Stack

| Layer         | Tool/Framework          | Purpose                            |
| ------------- | ----------------------- | ---------------------------------- |
| Frontend      | Next.js 15 (App Router) | Core application framework         |
| Styling       | Tailwind CSS            | Utility-first responsive design    |
| UI Components | shadcn/ui               | Reusable, modern component library |
| Backend       | Supabase (PostgreSQL)   | DB, Auth, Storage, RLS             |
| Deployment    | Vercel                  | Hosting & CI/CD                    |
| IDE           | Cursor                  | AI-powered coding workflow         |
| Design        | Figma + Untitled UI     | Visual design system               |
| Project Mgmt  | Notion                  | Roadmap, tasks, and logs           |

---

## 🗄️ Database Architecture

### **Core Tables**

- `events` - Main wedding events
- `event_guests` - Guest list with RSVP tracking
- `users` - Authentication and user profiles

### **Advanced Features (Latest)**

- `sub_events` - Individual event management (Rehearsal, Ceremony, etc.)
- `guest_sub_event_assignments` - Flexible guest-to-event assignments
- `scheduled_messages` - Advanced message scheduling with targeting
- `message_deliveries` - Individual delivery tracking (SMS/Push/Email)
- `communication_preferences` - User delivery preferences and quiet hours

### **Security & Performance**

- **Row Level Security (RLS)** on all tables
- **Helper Functions**: `is_event_host()`, `is_event_guest()`
- **Performance Indexes** for optimal query performance
- **Foreign Key Constraints** with proper cascading

---

## 🧑‍🤝‍🧑 User Roles

- **Hosts**: Create and manage events, organize guests across multiple sub-events, send targeted messages, and view comprehensive analytics
- **Guests**: Join weddings, receive targeted updates, view event schedules, upload photos/videos, and manage communication preferences

---

## ✅ Current Feature Status

| Feature                      | Status  | Description                                               |
| ---------------------------- | ------- | --------------------------------------------------------- |
| ✅ Host Dashboard            | ✅ Live | Complete tabbed interface with real-time stats            |
| ✅ Multi-Event Management    | ✅ Live | Create/manage multiple events (Rehearsal, Ceremony, etc.) |
| ✅ Advanced Guest Management | ✅ Live | Bulk operations, filtering, event assignments             |
| ✅ Message Scheduling        | ✅ Live | Target guests by event/tags with multi-channel delivery   |
| ✅ RSVP Tracking             | ✅ Live | Real-time attendance analytics                            |
| ✅ Guest Import              | ✅ Live | CSV upload wizard                                         |
| 🔧 SMS Integration           | Planned | Twilio API for actual message delivery                    |
| 🔧 Push Notifications        | Planned | Firebase for app users                                    |
| 🔧 Media Gallery             | Planned | Photo/video upload and sharing                            |
| 🔧 Post-Wedding Capsule      | Planned | Anniversary messages and memory sharing                   |

---

## 🗂 Reference Folder

The `/reference` folder contains the system's architectural snapshot:

- `schema.sql` – Current Supabase schema (exported via CLI)
- `supabase.types.ts` – Generated TypeScript types from Supabase
- `session-log.md` – Daily build logs of what changed and why
- `decisions.md` – Structural/product decisions with rationale
- `questions.md` – Open questions for review or debugging

---

## 🧠 Architecture

- Each user may be a **Host** for one or more events, and a **Guest** for others.
- **Multi-event Support**: Each wedding can have multiple sub-events with individual guest assignments
- **Advanced Messaging**: Sophisticated targeting and scheduling system with multi-channel delivery
- Supabase RLS enforces role-based data access and event-specific permissions
- The app is modular, with clean separation of concerns across `/app`, `/components`, `/lib`, and `/types`

---

## 🛠 Setup Instructions (Local Dev)

```bash
git clone https://github.com/grantdelgado/unveil-app
cd unveil-app

# Install dependencies
pnpm install

# Configure environment
cp .env.local.example .env.local
# Fill in Supabase credentials + Vercel URL

# Apply database migrations
npx supabase db push

# Generate TypeScript types
npx supabase gen types typescript > app/reference/supabase.types.ts

# Run the dev server
pnpm dev
```

---

## 📈 Recent Updates

### **January 2025 - UI Standardization & Production Polish**

- **Complete UI Standardization**: All pages standardized to unified design system
- **Component Library Implementation**: Comprehensive reusable component library
- **Production Ready**: Clean builds, passing tests, optimized performance
- **Enhanced Accessibility**: Proper form labeling and keyboard navigation
- **Mobile-First Design**: Responsive layouts across all screen sizes

### **Migration Applied**

- `20250602002100_enhance_messaging_system.sql` - Complete messaging and multi-event architecture

---

## 🔒 Status

This is an active MVP approaching production readiness. The core host dashboard and guest management features are complete and tested. The system is built with enterprise-grade architecture and ready for real-world deployment.

Testing will be done live at an upcoming wedding. Feedback loops are tightly integrated with Notion and AI-based code auditing.

---

## 👋 About the Builder

This app is being built by a solo founder/product manager with strong PM fundamentals and AI-accelerated build workflows. It's designed to be easily handed off to a future CTO or dev partner—with clean architecture, typed schema, and clear documentation from the start.
