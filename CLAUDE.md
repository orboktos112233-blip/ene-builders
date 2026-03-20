@AGENTS.md
# ENE Builders – Construction Management System

## Overview
ENE Builders is a modern web-based construction management system designed to replace Excel-based workflows with a centralized, real-time platform.

The system must support multiple roles, project tracking, financial management, daily reporting, media uploads, data import from existing Excel files, and internal/external communication.

The system should be scalable, production-ready, and designed as a future SaaS product.

---

## Core Goals
- Replace manual Excel workflows
- Import existing business data into the system
- Provide real-time visibility across all projects
- Improve communication between field, office, and management
- Track progress, budgets, and timelines accurately
- Create a clean, intuitive UI for non-technical users

---

## User Roles & Permissions

### 1. Admin (Owner / Management)
- Full system access
- Create/edit/delete projects
- Manage users and roles
- Access all financial data
- View analytics and reports
- Approve/reject updates
- Import data from Excel/CSV

### 2. Project Manager
- Manage assigned projects
- Update project status
- Upload daily updates and images
- Request materials
- Track progress and timelines
- Communicate with office and workers

### 3. Office (Finance / Operations)
- Access project financials
- Manage budgets, invoices, payments
- Approve material orders
- Generate financial reports
- Import financial data from Excel

### 4. Field Workers
- Login with simple interface
- Upload daily work reports
- Upload photos/videos of work
- Mark attendance / working hours

### 5. Client (Customer)
- Limited access per project
- View project progress
- View timeline and status
- Leave comments/questions

---

## Core Features

### Project Management
- Create and manage projects
- Project status tracking:
  - Planning
  - Demolition
  - Framing
  - Finishing
- Assign users to projects
- Timeline and milestones
- Estimated vs actual duration

---

### Daily Reports
- Workers upload:
  - Photos
  - Notes
  - Progress updates
- Timestamped automatically

---

### Media & File Management
- Upload images and videos
- Upload documents (PDF, contracts, invoices)
- Organize by:
  - project
  - date
  - category
- Categories:
  - before
  - progress
  - after
  - final_result
  - contract
  - invoice
  - budget
  - plan
  - other

Each file must include:
- project_id
- uploaded_by
- uploaded_at
- category
- optional description

---

### Materials & Orders
- Request materials
- Track orders and approvals
- Status:
  - Requested
  - Approved
  - Ordered
  - Delivered

---

### Financial System
- Budget per project
- Expense tracking
- Payments and invoices
- Profit tracking
- Financial history per project

---

### Notifications System
- Real-time notifications for:
  - Updates
  - Approvals
  - Comments
  - Status changes

---

### Client Communication
- Clients can:
  - View project dashboard
  - Leave comments/questions

---

### Time Tracking
- Track estimated time per stage
- Track actual time spent
- Compare delays

---

## Data Import & Migration (CRITICAL FEATURE)

The system must support importing existing business data from Excel/CSV files.

### Supported Formats
- .xlsx
- .xls
- .csv

---

### Import Capabilities
- Import projects
- Import budgets
- Import financial records
- Import client data

---

### Import Features
- Upload Excel/CSV file
- Map columns to system fields
- Preview data before import
- Validate required fields
- Handle duplicates:
  - skip
  - update existing
  - create new
- Show import results:
  - success rows
  - failed rows
  - skipped rows
- Save import history/logs

---

### Migration Use Cases
- Import all existing active projects
- Import budgets from Excel sheets
- Import financial tracking data
- Move entire business data from spreadsheets into system

---

## Technical Requirements

### Frontend
- Next.js (App Router)
- Tailwind CSS
- Responsive design (mobile-first)

---

### Backend
- Supabase:
  - Authentication
  - Database
  - Storage
- API routes via Next.js

---

### Authentication
- Email/password login
- Role-based access control (RBAC)
- Secure access per role

---

### Database (High-Level Entities)
- Users
- Roles
- Projects
- ProjectAssignments
- DailyReports
- MediaFiles
- Materials
- Orders
- FinancialRecords
- Notifications
- Comments
- ImportLogs

---

### Storage
- Use Supabase Storage
- Organize files by:
  - project_id
  - category
- Secure access based on roles

---

## UX Requirements
- Clean, modern UI
- Simple for non-technical users
- Dashboard-based navigation
- Mobile-first design (especially for workers)

---

## Future Considerations
- SaaS multi-tenant architecture
- Subscription plans
- Mobile app (React Native)
- AI insights (delays, costs, predictions)

---

## Development Rules

- Build in small steps
- Always propose architecture before coding
- Keep code modular and scalable
- Follow production best practices
- Avoid over-engineering

---

## Current Task for Claude

Analyze this project and propose a production-grade architecture.

Do NOT implement code yet.

Provide:
1. Folder structure
2. Core modules and boundaries
3. Database design (high-level)
4. Auth & roles strategy
5. Development phases (step-by-step)
6. Risks and important decisions
