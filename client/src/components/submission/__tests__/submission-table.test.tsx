import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SubmissionTable from '../submission-table';
import { Submission } from '@shared/schema';

// Mock the useLocation hook from wouter
jest.mock('wouter', () => ({
  useLocation: () => ['/submissions', jest.fn()]
}));

// Mock fetch for download functionality
global.fetch = jest.fn();

// Mock window.URL.createObjectURL and URL.revokeObjectURL
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: jest.fn(() => 'mock-url'),
    revokeObjectURL: jest.fn(),
  },
});

// Mock document.createElement and related DOM methods
Object.defineProperty(document, 'createElement', {
  value: jest.fn(() => ({
    href: '',
    download: '',
    click: jest.fn(),
    style: {},
  })),
});

describe('SubmissionTable Download Button', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    jest.clearAllMocks();
    
    // Reset fetch mock
    (fetch as jest.MockedFunction<typeof fetch>).mockClear();
  });

  const renderWithQueryClient = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  const createMockSubmission = (jobStatus: string): Submission & {
    job?: { id: number; jobId: string; title: string; status: string };
    candidate?: { 
      id: number; 
      firstName: string; 
      middleName?: string;
      lastName: string; 
      location: string;
    };
    recruiter?: { id: number; name: string; username?: string };
  } => ({
    id: 1,
    jobId: 1,
    candidateId: 1,
    recruiterId: 1,
    status: 'New',
    matchScore: 90,
    agreedRate: 75,
    submittedAt: new Date(),
    updatedAt: new Date(),
    notes: 'Test submission',
    feedback: null,
    isSuspicious: false,
    suspiciousReason: null,
    suspiciousSeverity: null,
    lastUpdatedBy: null,
    job: {
      id: 1,
      jobId: 'JOB-001',
      title: 'Test Job',
      status: jobStatus,
    },
    candidate: {
      id: 1,
      firstName: 'John',
      lastName: 'Doe',
      location: 'New York, NY',
    },
    recruiter: {
      id: 1,
      name: 'Test Recruiter',
    },
  });

  describe('Success Cases', () => {
    test('should enable download button for active job (lowercase)', async () => {
      const submissions = [createMockSubmission('active')];
      
      renderWithQueryClient(
        <SubmissionTable submissions={submissions} isLoading={false} />
      );

      const downloadButton = screen.getByRole('button', { name: /download/i });
      
      expect(downloadButton).toBeEnabled();
      expect(downloadButton).toHaveClass('text-green-600');
      expect(downloadButton).not.toHaveClass('cursor-not-allowed');
    });

    test('should enable download button for Active job (uppercase)', async () => {
      const submissions = [createMockSubmission('Active')];
      
      renderWithQueryClient(
        <SubmissionTable submissions={submissions} isLoading={false} />
      );

      const downloadButton = screen.getByRole('button', { name: /download/i });
      
      expect(downloadButton).toBeEnabled();
      expect(downloadButton).toHaveClass('text-green-600');
      expect(downloadButton).not.toHaveClass('cursor-not-allowed');
    });

    test('should enable download button for ACTIVE job (mixed case)', async () => {
      const submissions = [createMockSubmission('ACTIVE')];
      
      renderWithQueryClient(
        <SubmissionTable submissions={submissions} isLoading={false} />
      );

      const downloadButton = screen.getByRole('button', { name: /download/i });
      
      expect(downloadButton).toBeEnabled();
      expect(downloadButton).toHaveClass('text-green-600');
    });

    test('should successfully download resume for active job', async () => {
      const submissions = [createMockSubmission('active')];
      
      // Mock successful fetch response
      const mockBlob = new Blob(['resume content'], { type: 'application/pdf' });
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
        headers: {
          get: (name: string) => {
            if (name === 'content-disposition') {
              return 'attachment; filename="john_doe_resume.pdf"';
            }
            return null;
          },
        },
      } as Response);

      renderWithQueryClient(
        <SubmissionTable submissions={submissions} isLoading={false} />
      );

      const downloadButton = screen.getByRole('button', { name: /download/i });
      
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/candidates/resume/1');
      });
    });

    test('should show correct tooltip for enabled download button', async () => {
      const submissions = [createMockSubmission('active')];
      
      renderWithQueryClient(
        <SubmissionTable submissions={submissions} isLoading={false} />
      );

      const downloadButton = screen.getByRole('button', { name: /download/i });
      
      expect(downloadButton).toHaveAttribute('title', 'Download resume');
    });
  });

  describe('Failure Cases', () => {
    test('should disable download button for closed job', async () => {
      const submissions = [createMockSubmission('closed')];
      
      renderWithQueryClient(
        <SubmissionTable submissions={submissions} isLoading={false} />
      );

      const downloadButton = screen.getByRole('button', { name: /download/i });
      
      expect(downloadButton).toBeDisabled();
      expect(downloadButton).toHaveClass('text-gray-400');
      expect(downloadButton).toHaveClass('cursor-not-allowed');
    });

    test('should disable download button for reviewing job', async () => {
      const submissions = [createMockSubmission('reviewing')];
      
      renderWithQueryClient(
        <SubmissionTable submissions={submissions} isLoading={false} />
      );

      const downloadButton = screen.getByRole('button', { name: /download/i });
      
      expect(downloadButton).toBeDisabled();
      expect(downloadButton).toHaveClass('text-gray-400');
      expect(downloadButton).toHaveClass('cursor-not-allowed');
    });

    test('should disable download button when job status is null', async () => {
      const submission = createMockSubmission('active');
      submission.job!.status = null as any;
      
      renderWithQueryClient(
        <SubmissionTable submissions={[submission]} isLoading={false} />
      );

      const downloadButton = screen.getByRole('button', { name: /download/i });
      
      expect(downloadButton).toBeDisabled();
    });

    test('should disable download button when job is undefined', async () => {
      const submission = createMockSubmission('active');
      submission.job = undefined;
      
      renderWithQueryClient(
        <SubmissionTable submissions={[submission]} isLoading={false} />
      );

      const downloadButton = screen.getByRole('button', { name: /download/i });
      
      expect(downloadButton).toBeDisabled();
    });

    test('should not render download button when candidate is undefined', async () => {
      const submission = createMockSubmission('active');
      submission.candidate = undefined;
      
      renderWithQueryClient(
        <SubmissionTable submissions={[submission]} isLoading={false} />
      );

      const downloadButton = screen.queryByRole('button', { name: /download/i });
      
      expect(downloadButton).not.toBeInTheDocument();
    });

    test('should show correct tooltip for disabled download button', async () => {
      const submissions = [createMockSubmission('closed')];
      
      renderWithQueryClient(
        <SubmissionTable submissions={submissions} isLoading={false} />
      );

      const downloadButton = screen.getByRole('button', { name: /download/i });
      
      expect(downloadButton).toHaveAttribute('title', 'Download is only available for Active jobs');
    });

    test('should not trigger download for disabled button', async () => {
      const submissions = [createMockSubmission('closed')];
      
      renderWithQueryClient(
        <SubmissionTable submissions={submissions} isLoading={false} />
      );

      const downloadButton = screen.getByRole('button', { name: /download/i });
      
      fireEvent.click(downloadButton);

      // Should not call fetch since button is disabled
      expect(fetch).not.toHaveBeenCalled();
    });

    test('should handle fetch error gracefully', async () => {
      const submissions = [createMockSubmission('active')];
      
      // Mock fetch to reject
      (fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
        new Error('Network error')
      );

      // Mock alert
      window.alert = jest.fn();

      renderWithQueryClient(
        <SubmissionTable submissions={submissions} isLoading={false} />
      );

      const downloadButton = screen.getByRole('button', { name: /download/i });
      
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Failed to download resume. Please try again.');
      });
    });

    test('should handle 404 error with specific message', async () => {
      const submissions = [createMockSubmission('active')];
      
      // Mock 404 response
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      // Mock alert
      window.alert = jest.fn();

      renderWithQueryClient(
        <SubmissionTable submissions={submissions} isLoading={false} />
      );

      const downloadButton = screen.getByRole('button', { name: /download/i });
      
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Resume file not found. The candidate may not have uploaded a resume.');
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty submissions array', () => {
      renderWithQueryClient(
        <SubmissionTable submissions={[]} isLoading={false} />
      );

      expect(screen.getByText('No submissions found.')).toBeInTheDocument();
    });

    test('should show loading state', () => {
      renderWithQueryClient(
        <SubmissionTable submissions={[]} isLoading={true} />
      );

      expect(screen.getByRole('status')).toBeInTheDocument(); // Loading spinner
    });

    test('should handle submission with missing job title', () => {
      const submission = createMockSubmission('active');
      submission.job!.title = '';
      
      renderWithQueryClient(
        <SubmissionTable submissions={[submission]} isLoading={false} />
      );

      const downloadButton = screen.getByRole('button', { name: /download/i });
      expect(downloadButton).toBeEnabled();
    });
  });
});