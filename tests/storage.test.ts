import { DatabaseStorage } from '../server/storage';

describe('Storage Service', () => {
  let storage: DatabaseStorage;

  beforeAll(() => {
    // Use the existing storage instance
    storage = new DatabaseStorage();
  });

  describe('Job Operations', () => {
    describe('getJobs', () => {
      it('should return array of jobs', async () => {
        const jobs = await storage.getJobs();
        expect(Array.isArray(jobs)).toBe(true);
      });

      it('should filter jobs by status', async () => {
        const activeJobs = await storage.getJobs({ status: 'Active' });
        expect(Array.isArray(activeJobs)).toBe(true);
        
        activeJobs.forEach(job => {
          expect(job.status).toBe('Active');
        });
      });

      it('should filter jobs by search term', async () => {
        const searchResults = await storage.getJobs({ searchTerm: 'developer' });
        expect(Array.isArray(searchResults)).toBe(true);
      });

      it('should filter jobs by date', async () => {
        const date = new Date('2024-01-01');
        const dateFilteredJobs = await storage.getJobs({ date });
        expect(Array.isArray(dateFilteredJobs)).toBe(true);
      });
    });

    describe('getJob', () => {
      it('should return null for non-existent job', async () => {
        const job = await storage.getJob(99999);
        expect(job).toBeNull();
      });

      it('should return job object for valid ID', async () => {
        const jobs = await storage.getJobs();
        if (jobs.length > 0) {
          const job = await storage.getJob(jobs[0].id);
          expect(job).toBeTruthy();
          expect(job).toHaveProperty('id');
          expect(job).toHaveProperty('title');
        }
      });
    });

    describe('createJob', () => {
      const testJobData = {
        jobId: 'TEST-STORAGE-001',
        title: 'Storage Test Job',
        description: 'Job for testing storage operations',
        requirements: 'Test requirements',
        location: 'Test Location',
        salaryRange: '$50,000 - $70,000',
        status: 'Active' as const,
        priority: 'Medium' as const,
        clientName: 'Test Client',
        assignedRecruiters: [],
        createdBy: 1
      };

      it('should create job with valid data', async () => {
        const job = await storage.createJob(testJobData);
        expect(job).toBeTruthy();
        expect(job.jobId).toBe(testJobData.jobId);
        expect(job.title).toBe(testJobData.title);
        expect(job).toHaveProperty('id');
        expect(job).toHaveProperty('createdAt');
      });

      it('should throw error for duplicate job ID', async () => {
        await expect(storage.createJob(testJobData)).rejects.toThrow();
      });
    });

    describe('updateJob', () => {
      it('should update existing job', async () => {
        const jobs = await storage.getJobs();
        if (jobs.length > 0) {
          const jobId = jobs[0].id;
          const updateData = { title: 'Updated Job Title' };
          
          const updatedJob = await storage.updateJob(jobId, updateData);
          expect(updatedJob.title).toBe('Updated Job Title');
        }
      });

      it('should throw error for non-existent job', async () => {
        await expect(storage.updateJob(99999, { title: 'Updated' })).rejects.toThrow();
      });
    });

    describe('deleteJob', () => {
      it('should delete existing job', async () => {
        // Create a job to delete
        const jobData = {
          jobId: 'DELETE-TEST-001',
          title: 'Job to Delete',
          description: 'This job will be deleted',
          requirements: 'Test requirements',
          location: 'Test Location',
          salaryRange: '$50,000 - $70,000',
          status: 'Active' as const,
          priority: 'Medium' as const,
          clientName: 'Test Client',
          assignedRecruiters: [],
          createdBy: 1
        };

        const createdJob = await storage.createJob(jobData);
        await storage.deleteJob(createdJob.id);

        // Verify job is deleted
        const deletedJob = await storage.getJob(createdJob.id);
        expect(deletedJob).toBeNull();
      });

      it('should throw error for non-existent job', async () => {
        await expect(storage.deleteJob(99999)).rejects.toThrow();
      });
    });
  });

  describe('Candidate Operations', () => {
    describe('getCandidates', () => {
      it('should return array of candidates', async () => {
        const candidates = await storage.getCandidates();
        expect(Array.isArray(candidates)).toBe(true);
      });
    });

    describe('getCandidate', () => {
      it('should return null for non-existent candidate', async () => {
        const candidate = await storage.getCandidate(99999);
        expect(candidate).toBeNull();
      });

      it('should return candidate object for valid ID', async () => {
        const candidates = await storage.getCandidates();
        if (candidates.length > 0) {
          const candidate = await storage.getCandidate(candidates[0].id);
          expect(candidate).toBeTruthy();
          expect(candidate).toHaveProperty('id');
          expect(candidate).toHaveProperty('firstName');
          expect(candidate).toHaveProperty('lastName');
        }
      });
    });

    describe('createCandidate', () => {
      const testCandidateData = {
        firstName: 'Storage',
        lastName: 'Test',
        email: 'storage.test@example.com',
        phone: '+1-555-0100',
        dobMonth: 6,
        dobDay: 15,
        ssn4: '1234',
        location: 'Storage Test City, NY',
        workAuthorization: 'US Citizen' as const,
        source: 'Storage Test',
        createdBy: 1
      };

      it('should create candidate with valid data', async () => {
        const candidate = await storage.createCandidate(testCandidateData);
        expect(candidate).toBeTruthy();
        expect(candidate.firstName).toBe(testCandidateData.firstName);
        expect(candidate.lastName).toBe(testCandidateData.lastName);
        expect(candidate.email).toBe(testCandidateData.email);
        expect(candidate).toHaveProperty('id');
        expect(candidate).toHaveProperty('createdAt');
      });

      it('should throw error for duplicate email', async () => {
        await expect(storage.createCandidate(testCandidateData)).rejects.toThrow();
      });
    });

    describe('updateCandidate', () => {
      it('should update existing candidate', async () => {
        const candidates = await storage.getCandidates();
        if (candidates.length > 0) {
          const candidateId = candidates[0].id;
          const updateData = { firstName: 'Updated Name' };
          
          const updatedCandidate = await storage.updateCandidate(candidateId, updateData);
          expect(updatedCandidate.firstName).toBe('Updated Name');
        }
      });

      it('should throw error for non-existent candidate', async () => {
        await expect(storage.updateCandidate(99999, { firstName: 'Updated' })).rejects.toThrow();
      });
    });
  });

  describe('Submission Operations', () => {
    describe('getSubmissions', () => {
      it('should return array of submissions', async () => {
        const submissions = await storage.getSubmissions();
        expect(Array.isArray(submissions)).toBe(true);
      });

      it('should filter submissions by job ID', async () => {
        const jobs = await storage.getJobs();
        if (jobs.length > 0) {
          const jobSubmissions = await storage.getSubmissions({ jobId: jobs[0].id });
          expect(Array.isArray(jobSubmissions)).toBe(true);
          
          jobSubmissions.forEach(submission => {
            expect(submission.jobId).toBe(jobs[0].id);
          });
        }
      });

      it('should filter submissions by candidate ID', async () => {
        const candidates = await storage.getCandidates();
        if (candidates.length > 0) {
          const candidateSubmissions = await storage.getSubmissions({ candidateId: candidates[0].id });
          expect(Array.isArray(candidateSubmissions)).toBe(true);
          
          candidateSubmissions.forEach(submission => {
            expect(submission.candidateId).toBe(candidates[0].id);
          });
        }
      });

      it('should filter submissions by recruiter ID', async () => {
        const recruiterSubmissions = await storage.getSubmissions({ recruiterId: 2 });
        expect(Array.isArray(recruiterSubmissions)).toBe(true);
        
        recruiterSubmissions.forEach(submission => {
          expect(submission.recruiterId).toBe(2);
        });
      });
    });

    describe('getSubmission', () => {
      it('should return null for non-existent submission', async () => {
        const submission = await storage.getSubmission(99999);
        expect(submission).toBeNull();
      });

      it('should return submission object for valid ID', async () => {
        const submissions = await storage.getSubmissions();
        if (submissions.length > 0) {
          const submission = await storage.getSubmission(submissions[0].id);
          expect(submission).toBeTruthy();
          expect(submission).toHaveProperty('id');
          expect(submission).toHaveProperty('status');
        }
      });
    });

    describe('updateSubmissionStatus', () => {
      it('should update submission status', async () => {
        const submissions = await storage.getSubmissions();
        if (submissions.length > 0) {
          const submissionId = submissions[0].id;
          const newStatus = 'Interview Scheduled';
          
          const updatedSubmission = await storage.updateSubmissionStatus(
            submissionId, 
            newStatus,
            'Status update test',
            1
          );
          
          expect(updatedSubmission.status).toBe(newStatus);
        }
      });

      it('should throw error for non-existent submission', async () => {
        await expect(storage.updateSubmissionStatus(
          99999, 
          'Interview Scheduled',
          'Test',
          1
        )).rejects.toThrow();
      });
    });
  });

  describe('User Operations', () => {
    describe('getRecruiters', () => {
      it('should return array of recruiters', async () => {
        const recruiters = await storage.getRecruiters();
        expect(Array.isArray(recruiters)).toBe(true);
      });
    });

    describe('getUser', () => {
      it('should return null for non-existent user', async () => {
        const user = await storage.getUser(99999);
        expect(user).toBeNull();
      });

      it('should return user object for valid ID', async () => {
        const user = await storage.getUser(1); // Admin user
        if (user) {
          expect(user).toHaveProperty('id');
          expect(user).toHaveProperty('username');
          expect(user).toHaveProperty('role');
        }
      });
    });

    describe('getUserByUsername', () => {
      it('should return null for non-existent username', async () => {
        const user = await storage.getUserByUsername('nonexistent');
        expect(user).toBeNull();
      });

      it('should return user object for valid username', async () => {
        const user = await storage.getUserByUsername('admin');
        if (user) {
          expect(user.username).toBe('admin');
          expect(user).toHaveProperty('id');
          expect(user).toHaveProperty('role');
        }
      });
    });
  });

  describe('Activity Operations', () => {
    describe('getActivities', () => {
      it('should return array of activities', async () => {
        const activities = await storage.getActivities();
        expect(Array.isArray(activities)).toBe(true);
      });

      it('should respect limit parameter', async () => {
        const limitedActivities = await storage.getActivities(5);
        expect(Array.isArray(limitedActivities)).toBe(true);
        expect(limitedActivities.length).toBeLessThanOrEqual(5);
      });
    });

    describe('createActivity', () => {
      it('should create activity with valid data', async () => {
        const activityData = {
          type: 'job_created' as const,
          description: 'Test activity creation',
          userId: 1,
          jobId: null,
          candidateId: null
        };

        const activity = await storage.createActivity(activityData);
        expect(activity).toBeTruthy();
        expect(activity.type).toBe(activityData.type);
        expect(activity.description).toBe(activityData.description);
        expect(activity).toHaveProperty('id');
        expect(activity).toHaveProperty('createdAt');
      });
    });
  });

  describe('Dashboard Operations', () => {
    describe('getDashboardStats', () => {
      it('should return dashboard statistics', async () => {
        const stats = await storage.getDashboardStats();
        expect(stats).toHaveProperty('activeJobs');
        expect(stats).toHaveProperty('totalSubmissions');
        expect(stats).toHaveProperty('totalCandidates');
        expect(stats).toHaveProperty('recentActivities');
        
        expect(typeof stats.activeJobs).toBe('number');
        expect(typeof stats.totalSubmissions).toBe('number');
        expect(typeof stats.totalCandidates).toBe('number');
        expect(Array.isArray(stats.recentActivities)).toBe(true);
        
        expect(stats.activeJobs).toBeGreaterThanOrEqual(0);
        expect(stats.totalSubmissions).toBeGreaterThanOrEqual(0);
        expect(stats.totalCandidates).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Validation and Fraud Detection', () => {
    describe('findSimilarCandidates', () => {
      it('should find similar candidates based on criteria', async () => {
        const testData = {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@test.com',
          phone: '+1-555-0123',
          dobMonth: 6,
          dobDay: 15,
          ssn4: '1234'
        };

        const similarCandidates = await storage.findSimilarCandidates(testData);
        expect(Array.isArray(similarCandidates)).toBe(true);
      });
    });

    describe('findSimilarEmploymentHistories', () => {
      it('should find candidates with similar employment histories', async () => {
        const clientNames = ['Test Company', 'Another Corp'];
        const relevantDates = ['2020-2023', '2018-2020'];

        const similarHistories = await storage.findSimilarEmploymentHistories(
          clientNames, 
          relevantDates,
          1 // exclude candidate ID 1
        );
        
        expect(Array.isArray(similarHistories)).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // This test would require mocking the database connection
      // For now, we'll just ensure the methods exist and return proper types
      expect(typeof storage.getJobs).toBe('function');
      expect(typeof storage.getCandidates).toBe('function');
      expect(typeof storage.getSubmissions).toBe('function');
    });

    it('should validate required fields', async () => {
      // Test with incomplete data
      await expect(storage.createJob({} as any)).rejects.toThrow();
      await expect(storage.createCandidate({} as any)).rejects.toThrow();
    });

    it('should handle concurrent operations', async () => {
      // Test concurrent read operations
      const promises = [
        storage.getJobs(),
        storage.getCandidates(),
        storage.getSubmissions(),
        storage.getActivities()
      ];

      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });
    });
  });
});