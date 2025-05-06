# Architecture Overview

## Overview

The application is a full-stack recruitment tracking system ("RecruiterTracker") that helps recruiters manage candidates, jobs, and the submission process. It uses AI-powered features like resume parsing and job matching to streamline the recruitment workflow.

The system follows a client-server architecture with a React front-end, Express.js backend, and PostgreSQL database. It leverages modern technologies including OpenAI integration for AI capabilities, document parsing for resumes, and a RESTful API for communication between the client and server.

## System Architecture

### High-Level Architecture

The application follows a typical three-tier architecture:

1. **Presentation Layer**: React-based Single Page Application (SPA)
2. **Application Layer**: Express.js REST API server
3. **Data Layer**: PostgreSQL database using Drizzle ORM

### Key Architectural Decisions

- **Full-Stack JavaScript/TypeScript**: The entire application uses TypeScript for type safety and better developer experience
- **Client-Server Pattern**: Clear separation between frontend and backend
- **RESTful API Design**: Standard HTTP methods for resource operations
- **ORM for Database Access**: Drizzle ORM for type-safe database operations
- **AI Integration**: OpenAI for resume parsing and candidate-job matching
- **Document Processing**: Support for multiple document formats (PDF, DOCX, TXT)
- **Component-Based UI**: Shadcn UI components with Tailwind CSS for styling

## Key Components

### Frontend (Client)

- **Framework**: React with TypeScript
- **State Management**: React Query for server state management
- **Routing**: Wouter for client-side routing
- **UI Components**: Shadcn UI library with Radix UI primitives
- **Styling**: Tailwind CSS for utility-based styling
- **API Communication**: Custom fetch-based client

Key frontend modules:
- `/client/src/pages/*`: Page components for different routes
- `/client/src/components/*`: Reusable UI components
- `/client/src/hooks/*`: Custom React hooks for data fetching and business logic
- `/client/src/lib/*`: Utility functions and API clients

### Backend (Server)

- **Framework**: Express.js with TypeScript
- **API Routes**: RESTful endpoints for CRUD operations
- **Middleware**: Express middleware for request handling
- **Document Processing**: Libraries for parsing different document types (mammoth for DOCX, pdf-parse for PDF)
- **AI Processing**: Integration with OpenAI API for resume analysis and job matching

Key backend modules:
- `/server/routes.ts`: API route definitions
- `/server/storage.ts`: Data access layer
- `/server/openai.ts`: OpenAI integration for AI features
- `/server/document-parser.ts`: Document extraction utilities
- `/server/index.ts`: Application entry point

### Database

- **Database**: PostgreSQL
- **ORM**: Drizzle ORM for type-safe database access
- **Schema**: Defined in `/shared/schema.ts`
- **Migrations**: Managed through Drizzle Kit

Key tables:
- `users`: Recruiters and administrators
- `jobs`: Job listings
- `candidates`: Candidate profiles
- `submissions`: Job applications linking candidates to jobs
- `resumeData`: Parsed resume information
- `activities`: System activity logs

## Data Flow

### Resume Submission and Analysis

1. User uploads a resume document (PDF, DOCX, or TXT)
2. Backend parses document to extract text
3. Extracted text is sent to OpenAI for analysis
4. OpenAI extracts structured information (employment history, skills, etc.)
5. Structured data is stored in the database
6. Results are returned to the frontend for display

### Job-Candidate Matching

1. User selects a candidate and job to match
2. Backend retrieves candidate resume data and job description
3. Data is sent to OpenAI for comparison and analysis
4. OpenAI evaluates compatibility and returns a match score with strengths/weaknesses
5. Results are stored in the submission record
6. Match results are displayed in the UI

### Fraud Detection

1. System analyzes employment history from parsed resumes
2. Backend compares new candidate data with existing records
3. Similar employment histories are flagged for review
4. Candidates can be marked as "unreal" with justification

## External Dependencies

### API Integrations

- **OpenAI API**: For natural language processing tasks:
  - Resume parsing and information extraction
  - Candidate-job matching and scoring
  - Skills gap analysis

### Third-Party Libraries

#### Frontend
- React and React DOM for UI
- TanStack Query (React Query) for data fetching
- Wouter for routing
- Lucide React for icons
- Radix UI for accessible component primitives
- Tailwind CSS for styling
- date-fns for date formatting
- clsx and tailwind-merge for class name utilities

#### Backend
- Express.js for HTTP server
- Multer for file upload handling
- Mammoth for DOCX parsing
- pdf-parse for PDF parsing
- Drizzle ORM for database access
- Zod for validation
- Node-fetch for HTTP requests

## Deployment Strategy

The application is configured for deployment on Replit, as evidenced by the `.replit` configuration file. It uses the following deployment strategy:

- **Development Environment**: Uses `npm run dev` with hot reloading
- **Production Build**: Uses `npm run build` to generate optimized assets
- **Production Start**: Uses `npm run start` to run the production server
- **Database**: Connects to a PostgreSQL database via environment variable
- **Port Configuration**: Exposes the app on port 5000 internally, mapped to port 80 externally

### Build Process

1. Frontend assets are built using Vite
2. Backend TypeScript is compiled using esbuild
3. Combined assets are served from the `/dist` directory

### Environment Configuration

- Environment variables (like `DATABASE_URL` and `OPENAI_API_KEY`) are required for database connection and API access
- The application supports different configurations for development and production environments

## Future Architecture Considerations

- **Microservices**: Consider splitting the resume processing functionality into a separate microservice
- **Caching**: Implement Redis caching for frequently accessed data
- **Queue System**: Add a job queue for handling document processing asynchronously
- **WebSockets**: Add real-time updates for collaborative features
- **Authentication**: Enhance security with JWT-based authentication