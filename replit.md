# Overview

RecruiterTracker is a modern AI-powered recruitment management platform built with React/TypeScript frontend and Node.js/Express backend. The system streamlines the recruitment process by allowing recruiters to manage jobs, candidates, and submissions while integrating OpenAI for resume analysis and matching capabilities. Key features include duplicate candidate prevention, intelligent resume processing, comprehensive tracking of the recruitment pipeline from initial submission to final hiring decisions, and robust analytics with success/rejection rate calculations.

## Recent Changes (August 17, 2025)

**Profile Record System - Complete Implementation with Logging & Testing (Latest)**
- Implemented comprehensive Profile Record system for resume library management
- Added Winston logging system with file rotation and detailed event tracking
- Fixed PDF parsing errors by switching from require() to dynamic imports for ES modules
- Created complete Jest test suite with 8 comprehensive test files covering all scenarios
- Enhanced multiple file upload with individual X-icon removal on hover functionality
- Implemented PostgreSQL full-text search with GIN indexing for efficient content searching
- Added comprehensive error handling with user-friendly messages instead of raw stack traces
- Fixed database schema issues by removing problematic search_vector columns
- Integrated logging throughout document parser, API routes, and storage operations
- System successfully handles PDF/DOCX uploads, text extraction, search, and file management
- Performance optimized: 38KB DOCX file processed in 1.18s with 26,678 characters extracted
- All CRUD operations working with proper authentication and activity logging

## Previous Changes (August 14, 2025)

**Critical PDF Analysis Fix (Latest)**
- Fixed "Maximum call stack size exceeded" error that was corrupting resume analysis
- Identified incorrect function call `extractTextFromBuffer` instead of `extractTextFromDocument` in server routes
- Improved PDF parsing with proper options to prevent stack overflow on large files
- Enhanced error handling in document parser to return user-friendly messages instead of throwing
- Fixed client-side error handling to prevent recursive errors from being stored as extractedText
- Modified openai.ts to store clean error messages instead of raw stack traces
- Added proper MIME type detection and file handling in public application routes

**Security Enhancement: Optional Sensitive Fields**
- Made Birth Month, Birth Day, and Last 4 of SSN optional fields for enhanced security and privacy
- Updated database schema to allow nullable values for dobMonth, dobDay, and ssn4 columns
- Modified frontend form validation to accept empty values for these sensitive fields
- Enhanced backend identity checking logic to work with partial identifying information
- Added clear "(Optional)" labels in UI to indicate fields are not required
- Implemented proper null handling in API routes using null coalescing operator
- Maintains candidate uniqueness checking functionality where identifying information is available
- Reduces collection of sensitive personal data while preserving system functionality

**Resume File Storage Fix**
- Fixed critical timing issue where files weren't stored during initial candidate creation
- Modified analyzeResume function to capture actual file content as base64 data
- Enhanced candidate creation flow to store file data after candidateId is available
- Resolved 404 download errors by ensuring files are properly stored in database
- Cleaned up excessive logging and improved code quality across file handling components

**Dropdown Actions Menu Implementation**
- Replaced individual action buttons with clean dropdown menus across all tables
- Created reusable ActionsDropdown component for consistent UI patterns
- Candidate table now uses dropdown with View, Resubmit, Quick Submit, and UNREAL options
- Submission table uses dropdown with View, Download Resume, Resubmit, and Quick Submit options
- Improved responsive design by consolidating multiple buttons into single dropdown trigger
- Maintained all existing functionality while reducing UI clutter and improving space efficiency

**Resume Comparison Validation System (Latest)**
- Implemented complete resume comparison validation in submissions workflow
- Added server-side resume comparison logic in `/api/submissions` endpoint
- Frontend now handles 202 validation responses and shows comparison dialog
- System detects significant changes in companies and job titles
- Validation triggers automatically when existing candidates submit with resume changes
- **Critical Fix**: Resume data is no longer updated until recruiter approves changes - preserves original data for comparison during validation process
- Fixed validation logic placement from regular submission dialog to resubmit dialog
- Added skipComparison flag to bypass validation after recruiter approval
- Fixed candidate profile rate display to show actual submission rates instead of hardcoded values
- Added support for multiple rates display (comma-separated) in candidate profiles

**Comprehensive Test Suite Implementation**
- Added complete Jest-based testing framework with TypeScript support
- Created 8 comprehensive test files covering all major services
- Implemented both success and failure scenario testing
- Added proper mocking for external dependencies (OpenAI, database)
- Enhanced analytics calculations with success rate (Approved/Total × 100) and rejected rate (Rejected/Total × 100)
- Added rejected rate column to reports with color-coded badges (Green ≤30%, Yellow 31-50%, Red >50%)
- Updated CSV export to include both success and rejected rate metrics

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript and Vite for fast development and building
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and dark mode support
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod schema validation

## Backend Architecture
- **Runtime**: Node.js with TypeScript and ESM modules
- **Framework**: Express.js for REST API endpoints
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Authentication**: Session-based authentication with role-based access control
- **File Processing**: Multer for file uploads, Mammoth for DOCX parsing, pdf-parse for PDF extraction
- **AI Integration**: OpenAI GPT-4 for resume analysis, job matching, and content generation

## Data Storage Solutions
- **Primary Database**: PostgreSQL for all application data
- **Schema Management**: Drizzle ORM with migration support
- **File Storage**: Local filesystem for resume uploads (configurable for cloud storage)
- **Session Storage**: Database-backed sessions using connect-pg-simple

## External Dependencies

### AI Services
- **OpenAI API**: GPT-4 model for resume analysis, job description parsing, and candidate matching with confidence scoring

### Database & ORM
- **PostgreSQL**: Primary relational database
- **Drizzle ORM**: Type-safe database operations and schema management
- **@neondatabase/serverless**: Serverless PostgreSQL driver support

### Document Processing
- **mammoth**: Microsoft Word (.docx) document text extraction
- **pdf-parse**: PDF document text extraction and parsing

### Authentication & Security
- **connect-pg-simple**: PostgreSQL session store for Express sessions
- **Crypto polyfills**: Cross-platform cryptographic functions for both development and production environments

### Development & Build Tools
- **Vite**: Fast frontend build tool with hot module replacement
- **esbuild**: Fast JavaScript bundler for production builds
- **PM2**: Production process manager for application deployment
- **cross-env**: Cross-platform environment variable handling