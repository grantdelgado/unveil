# 📚 Unveil Documentation Index

## 🔖 Purpose

This folder contains all active documentation for the Unveil wedding app. Use this index to quickly find the right reference guide, specification, or planning document. Archived and legacy files are excluded from this index but preserved in the `archive/` folder.

**Last Updated**: January 16, 2025  
**Status**: ✅ Production Ready  
**Total Active Documents**: 16 files

---

## 📚 Live Documentation Index

| Document                                                                                | Description                                                                 | Intended For                 |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------- |
| **CORE TECHNICAL DOCUMENTATION**                                                        |
| `architecture-guide.md`                                 | Complete technical architecture, database schema, and system design         | Developers, Technical Leads  |
| `developer-guide.md`                                       | Setup instructions, development workflows, and contribution guidelines      | Developers, New Contributors |
| `testing-infrastructure.md`                         | Testing setup, strategies, and infrastructure (unit, integration, E2E)      | Developers, QA               |
| **DESIGN SYSTEM & UI**                                                                  |
| `unveil-design-system.md`                             | ✅ **IMPLEMENTED** - Core UI principles, colors, typography, layout rules   | Developers, Designers        |
| `component-library-implementation.md`     | ✅ **IMPLEMENTED** - Technical implementation of shared UI component system | Developers                   |
| `../reference/style-guide.md`                             | Tailwind CSS usage patterns and styling conventions                         | Developers                   |
| **INTEGRATION & SETUP**                                                                 |
| `mcp-supabase-setup.md`                                 | Cursor + Supabase MCP integration setup and configuration                   | Developers                   |
| `mcp-schema-binding.md`                                 | Database schema binding and type generation processes                       | Developers                   |
| `SMS_SETUP_GUIDE.md`                                       | SMS messaging integration setup and configuration                           | Developers                   |
| **DEVELOPMENT TOOLS**                                                                   |
| `test-user-management.md`                             | Test user creation, management, and development workflows                   | Developers                   |
| `NAVIGATION_SYSTEM.md`                                   | Navigation architecture and routing implementation                          | Developers                   |
| `rules.md`                                                           | Team workflow rules and development processes                               | Team Members                 |
| **PROJECT PLANS**                                                                       |
| `../project-plans/unveil-ui-standardization.md` | 📦 **ARCHIVED** - Completed UI standardization project plan                 | Historical Reference         |
| **BRAND & REFERENCE**                                                                   |
| `../reference/brand.md`                                         | Brand guidelines, voice, and design principles                              | Designers, Content           |
| `../reference/voice.md`                                         | Voice & tone guidelines for UX copy and messaging                           | Designers, Content           |
| `../reference/quick-reference.md`                     | Developer shortcuts and quick reference commands                            | Developers                   |
| **ARCHIVED DOCUMENTATION**                                                              |
| `archive/`                                                                | 📦 Legacy documentation and completed project files (14 files)              | Historical Reference         |

---

## 🧭 How to Use This Documentation

### 🚀 Getting Started

1. **New Developers**: Start with `developer-guide.md` for setup and workflows
2. **Technical Overview**: Read `architecture-guide.md` for system understanding
3. **UI Development**: Consult `unveil-design-system.md` and `component-library-implementation.md`

### 🔍 Finding What You Need

- **Database/Schema**: `architecture-guide.md` + `mcp-schema-binding.md`
- **Styling/UI**: `unveil-design-system.md` + `../reference/style-guide.md`
- **Testing**: `testing-infrastructure.md` + `test-user-management.md`
- **Brand/Design**: `../reference/brand.md` + `../reference/voice.md`
- **Integration**: `mcp-supabase-setup.md` + `SMS_SETUP_GUIDE.md`

### ⚠️ Important Notes

- **Avoid archived files**: Don't reference anything in `archive/` for current development
- **Status indicators**: ✅ = Implemented, 📦 = Archived, 🔧 = In Progress
- **Always check dates**: Prefer newer documentation over older versions
- **Cursor integration**: Use MCP setup guides for AI-powered development

---

## 📊 Documentation Health Status

| Category                   | Status       | Count    |
| -------------------------- | ------------ | -------- |
| **Active Documentation**   | ✅ Current   | 16 files |
| **Archived Documentation** | 📦 Preserved | 14 files |
| **Total Coverage**         | ✅ Complete  | 30 files |

### Recent Updates

- **January 16, 2025**: Complete documentation audit and cleanup
- **January 16, 2025**: UI Standardization project completed and archived
- **January 16, 2025**: Design system and component library marked as fully implemented

---

## 🤝 Contributing to Documentation

When adding new documentation:

1. **Update this index** with new files and descriptions
2. **Follow naming conventions**: Use kebab-case for filenames
3. **Add status indicators**: ✅ Complete, 🔧 In Progress, 📦 Archived
4. **Include intended audience** in descriptions
5. **Link files properly** using relative paths

### Documentation Standards

- Use clear, descriptive filenames
- Include purpose and audience in file headers
- Maintain consistent formatting and structure
- Archive completed project files with proper notices
- Keep this index updated with all changes

---

**Maintained by**: Development Team  
**Next Audit**: April 2025 (Quarterly)  
**Questions?** Check `developer-guide.md` or `../reference/quick-reference.md`
