# Overview

RecruiterTracker is an AI-powered recruitment management platform designed to streamline the hiring process. It features a React/TypeScript frontend and a Node.js/Express backend, enabling recruiters to manage jobs, candidates, and submissions efficiently. The platform integrates OpenAI for intelligent resume analysis and candidate matching, includes duplicate candidate prevention, comprehensive tracking of the recruitment pipeline, and robust analytics for success and rejection rates. Its purpose is to enhance recruitment efficiency through automation and intelligent insights.

## Recent Changes (October 2, 2025)

**Critical Bug Fixes: Upload Sessions & Worker Thread Processing**

### Fix #1: Upload Session Tracking
- **Problem**: Sessions stuck in "processing" state forever
- **Cause**: Missing `sessionId` in processingData; incorrect progress calculation querying all user jobs
- **Fix**: Added sessionId to job data (routes.ts:4063); updated endpoint to use getSessionProgress() (routes.ts:4202-4233)

### Fix #2: Worker File Reading  
- **Problem**: Workers failed with "Received null" error
- **Cause**: createTempFileForWorker() tried to read non-existent resume.fileData from DB (files are on disk)
- **Fix**: Removed temp file creation (job-scheduler.ts:240); workers read directly from filePath

### Fix #3: Worker Data Structure
- **Problem**: "Cannot read properties of undefined (reading 'fileName')" crashes
- **Cause**: worker-script.js expected nested processingData structure but received flat structure
- **Fix**: Updated message handler to destructure correct fields (worker-script.js:16-31)

### Fix #4: Real File Processing
- **Problem**: Mock text extraction returning fake data
- **Fix**: Implemented actual file reading and document parsing (worker-script.js:63-93)

**Impact**: Upload sessions complete properly, workers process files successfully, 100% failure rate resolved

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript and Vite
- **UI Components**: Shadcn/ui (built on Radix UI)
- **Styling**: Tailwind CSS (with custom design tokens and dark mode)
- **State Management**: TanStack Query
- **Routing**: Wouter
- **Form Handling**: React Hook Form with Zod validation

## Backend Architecture
- **Runtime**: Node.js with TypeScript and ESM modules
- **Framework**: Express.js for REST API
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Session-based with role-based access control
- **File Processing**: Multer (file uploads), Mammoth (DOCX parsing), PDF.js (PDF extraction)
- **AI Integration**: OpenAI GPT-4 for resume analysis and matching

## Data Storage Solutions
- **Primary Database**: PostgreSQL
- **Schema Management**: Drizzle ORM
- **File Storage**: Local filesystem (configurable for cloud)
- **Session Storage**: Database-backed sessions (connect-pg-simple)

## UI/UX Decisions
- Clean dropdown menus across all tables for consolidated actions
- Visual search term highlighting in results using `ts_headline`
- Progress bars and detailed status for file uploads
- Optional sensitive fields for enhanced privacy

## Technical Implementations
- Email threading system for job assignments using `Message-ID` per assignment
- N+1 query optimization for jobs listing (single API call for job data)
- Sequential chunk processing for large file uploads with memory optimization and retry mechanisms
- Migration to PDF.js for robust PDF parsing, replacing `pdf-parse`
- Comprehensive Profile Record system with Boolean search and PostgreSQL full-text search (GIN indexing)
- Resume comparison validation system for submissions, allowing recruiter approval for changes
- Jest-based test suite with TypeScript support for all major services
- Analytics calculations for success and rejected rates with color-coded badges
- Security enhancement: Optional sensitive fields (Birth Month, Birth Day, Last 4 of SSN)

# External Dependencies

### AI Services
- **OpenAI API**: GPT-4 model for resume analysis, job description parsing, and candidate matching.

### Database & ORM
- **PostgreSQL**: Primary relational database.
- **Drizzle ORM**: Type-safe database operations and schema management.
- **@neondatabase/serverless**: Serverless PostgreSQL driver support.

### Document Processing
- **mammoth**: Microsoft Word (.docx) document text extraction.
- **pdfjs-dist**: PDF document text extraction and parsing (Mozilla PDF.js library).

### Authentication & Security
- **connect-pg-simple**: PostgreSQL session store for Express sessions.
- **Crypto polyfills**: Cross-platform cryptographic functions.

### Development & Build Tools
- **Vite**: Fast frontend build tool.
- **esbuild**: Fast JavaScript bundler.
- **PM2**: Production process manager.
- **cross-env**: Cross-platform environment variable handling.