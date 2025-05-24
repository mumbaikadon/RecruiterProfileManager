import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Building2, GraduationCap, Briefcase } from 'lucide-react';

interface ResumeDataDisplayProps {
  candidateId: number;
}

const ResumeDataDisplay: React.FC<ResumeDataDisplayProps> = ({ candidateId }) => {
  const [resumeData, setResumeData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResumeData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/candidates/${candidateId}/resume-data`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch resume data');
        }
        
        const data = await response.json();
        console.log('Resume data fetched:', data);
        setResumeData(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching resume data:', err);
        setError('Failed to load resume data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (candidateId) {
      fetchResumeData();
    }
  }, [candidateId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Resume Data
          </CardTitle>
          <CardDescription>Loading resume information...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-4 w-1/3 bg-muted animate-pulse rounded"></div>
            <div className="h-4 w-1/2 bg-muted animate-pulse rounded"></div>
            <div className="h-4 w-2/3 bg-muted animate-pulse rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Briefcase className="h-5 w-5" />
            Resume Data Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!resumeData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Resume Data
          </CardTitle>
          <CardDescription>No resume data available</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">This candidate does not have any resume data available. Try uploading a resume.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Resume Data
        </CardTitle>
        <CardDescription>Information extracted from candidate's resume</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="experience" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="experience">Experience</TabsTrigger>
            <TabsTrigger value="education">Education</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
          </TabsList>
          
          <TabsContent value="experience" className="space-y-4">
            {resumeData.clientNames && resumeData.clientNames.length > 0 ? (
              resumeData.clientNames.map((company: string, index: number) => (
                <div key={`exp-${index}`} className="border rounded-md p-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-primary/10 p-2 rounded-full">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{company}</h4>
                        {resumeData.relevantDates && resumeData.relevantDates[index] && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {resumeData.relevantDates[index]}
                          </Badge>
                        )}
                      </div>
                      {resumeData.jobTitles && resumeData.jobTitles[index] && (
                        <p className="text-sm text-muted-foreground">{resumeData.jobTitles[index]}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No employment history available</p>
            )}
          </TabsContent>
          
          <TabsContent value="education" className="space-y-4">
            {resumeData.education && resumeData.education.length > 0 ? (
              resumeData.education.map((edu: string, index: number) => (
                <div key={`edu-${index}`} className="border rounded-md p-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-full">
                      <GraduationCap className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                    </div>
                    <div>
                      <p>{edu}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No education information available</p>
            )}
          </TabsContent>
          
          <TabsContent value="skills" className="space-y-4">
            <div className="border rounded-md p-4">
              <h4 className="font-medium mb-2">Technical Skills</h4>
              <div className="flex flex-wrap gap-2">
                {resumeData.skills && resumeData.skills.length > 0 ? (
                  resumeData.skills.map((skill: string, index: number) => (
                    <Badge key={`skill-${index}`} variant="secondary">{skill}</Badge>
                  ))
                ) : (
                  <p className="text-muted-foreground">No technical skills available</p>
                )}
              </div>
            </div>
            
            <div className="border rounded-md p-4">
              <h4 className="font-medium mb-2">Soft Skills</h4>
              <div className="flex flex-wrap gap-2">
                {resumeData.softSkills && resumeData.softSkills.length > 0 ? (
                  resumeData.softSkills.map((skill: string, index: number) => (
                    <Badge key={`soft-${index}`} variant="outline">{skill}</Badge>
                  ))
                ) : (
                  <p className="text-muted-foreground">No soft skills available</p>
                )}
              </div>
            </div>
            
            <div className="border rounded-md p-4">
              <h4 className="font-medium mb-2">Certifications</h4>
              <div className="space-y-2">
                {resumeData.certifications && resumeData.certifications.length > 0 ? (
                  resumeData.certifications.map((cert: string, index: number) => (
                    <div key={`cert-${index}`} className="flex items-center gap-2">
                      <Badge variant="default" className="h-2 w-2 p-0 rounded-full" />
                      <span>{cert}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">No certifications available</p>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default ResumeDataDisplay;