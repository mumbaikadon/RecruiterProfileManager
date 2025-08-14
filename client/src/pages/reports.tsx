import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Download, TrendingUp, Users, Briefcase, Clock } from "lucide-react";
import { formatDate } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { addDays, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

interface RecruiterStats {
  recruiterId: number;
  recruiterName: string;
  totalSubmissions: number;
  activeSubmissions: number;
  approvedSubmissions: number;
  rejectedSubmissions: number;
  successRate: number;
  rejectedRate: number;
  avgTimeToSubmit: number;
  jobsWorked: number;
}

interface AnalyticsData {
  recruiters: RecruiterStats[];
  totalSubmissions: number;
  periodSubmissions: number;
  topPerformers: RecruiterStats[];
  submissionTrends: Array<{
    date: string;
    submissions: number;
    recruiterId?: number;
  }>;
}

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));
  const [selectedRecruiter, setSelectedRecruiter] = useState<string>("all");
  
  // Fetch analytics data
  const { data: analyticsData, isLoading: isLoadingAnalytics, refetch } = useQuery<AnalyticsData>({
    queryKey: ['/api/analytics/recruiters', dateFrom, dateTo, selectedRecruiter],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
        ...(selectedRecruiter !== 'all' && { recruiterId: selectedRecruiter })
      });
      
      const response = await fetch(`/api/analytics/recruiters?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }
      return response.json();
    }
  });

  // Fetch recruiters for the dropdown
  const { data: recruiters } = useQuery({
    queryKey: ['/api/recruiters'],
    queryFn: async () => {
      const response = await fetch('/api/recruiters');
      if (!response.ok) throw new Error('Failed to fetch recruiters');
      return response.json();
    }
  });

  const handleDateRangeSelect = (range: string) => {
    const now = new Date();
    switch (range) {
      case 'this-week':
        setDateFrom(startOfWeek(now));
        setDateTo(endOfWeek(now));
        break;
      case 'this-month':
        setDateFrom(startOfMonth(now));
        setDateTo(endOfMonth(now));
        break;
      case 'last-month':
        const lastMonth = addDays(startOfMonth(now), -1);
        setDateFrom(startOfMonth(lastMonth));
        setDateTo(endOfMonth(lastMonth));
        break;
      case 'last-30-days':
        setDateFrom(addDays(now, -30));
        setDateTo(now);
        break;
      case 'last-90-days':
        setDateFrom(addDays(now, -90));
        setDateTo(now);
        break;
    }
  };

  const exportReport = () => {
    if (!analyticsData) return;
    
    const csvContent = [
      'Recruiter,Total Submissions,Active,Approved,Rejected,Success Rate (%),Rejected Rate (%),Jobs Worked',
      ...analyticsData.recruiters.map(r => 
        `${r.recruiterName},${r.totalSubmissions},${r.activeSubmissions},${r.approvedSubmissions},${r.rejectedSubmissions},${r.successRate.toFixed(1)},${r.rejectedRate.toFixed(1)},${r.jobsWorked}`
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recruiter-analytics-${format(dateFrom, 'yyyy-MM-dd')}-to-${format(dateTo, 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground">
            Track recruiter performance and submission analytics
          </p>
        </div>
        <Button onClick={exportReport} disabled={!analyticsData} className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Tabs defaultValue="analytics" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="space-y-6">
          {/* Date Range and Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filter Options</CardTitle>
              <CardDescription>Select date range and recruiter to analyze</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4 items-end">
                {/* Quick Date Range Buttons */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Quick Select</label>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDateRangeSelect('this-week')}
                    >
                      This Week
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDateRangeSelect('this-month')}
                    >
                      This Month
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDateRangeSelect('last-month')}
                    >
                      Last Month
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDateRangeSelect('last-30-days')}
                    >
                      Last 30 Days
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDateRangeSelect('last-90-days')}
                    >
                      Last 90 Days
                    </Button>
                  </div>
                </div>

                {/* Custom Date Range */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">From Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[240px] justify-start text-left font-normal",
                          !dateFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={(date) => date && setDateFrom(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">To Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[240px] justify-start text-left font-normal",
                          !dateTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={(date) => date && setDateTo(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Recruiter Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Recruiter</label>
                  <Select value={selectedRecruiter} onValueChange={setSelectedRecruiter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select recruiter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Recruiters</SelectItem>
                      {recruiters?.map((recruiter: any) => (
                        <SelectItem key={recruiter.id} value={recruiter.id.toString()}>
                          {recruiter.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={() => refetch()}>
                  Apply Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {isLoadingAnalytics ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : analyticsData ? (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analyticsData.periodSubmissions}</div>
                    <p className="text-xs text-muted-foreground">
                      {format(dateFrom, "MMM d")} - {format(dateTo, "MMM d, yyyy")}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Recruiters</CardTitle>
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {analyticsData.recruiters.filter(r => r.totalSubmissions > 0).length}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Out of {analyticsData.recruiters.length} total
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Success Rate</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {analyticsData.recruiters.length > 0 
                        ? (analyticsData.recruiters.reduce((sum, r) => sum + r.successRate, 0) / analyticsData.recruiters.length).toFixed(1)
                        : 0}%
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Approval rate average
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {analyticsData.topPerformers[0]?.recruiterName || 'N/A'}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {analyticsData.topPerformers[0]?.totalSubmissions || 0} submissions
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Recruiter Performance Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Recruiter Performance</CardTitle>
                  <CardDescription>
                    Detailed breakdown of each recruiter's submission metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3">Recruiter</th>
                          <th className="text-center p-3">Total</th>
                          <th className="text-center p-3">Active</th>
                          <th className="text-center p-3">Approved</th>
                          <th className="text-center p-3">Rejected</th>
                          <th className="text-center p-3">Success Rate</th>
                          <th className="text-center p-3">Rejected Rate</th>
                          <th className="text-center p-3">Jobs Worked</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analyticsData.recruiters.map((recruiter) => (
                          <tr key={recruiter.recruiterId} className="border-b hover:bg-muted/50">
                            <td className="p-3 font-medium">{recruiter.recruiterName}</td>
                            <td className="text-center p-3">
                              <Badge variant="secondary">{recruiter.totalSubmissions}</Badge>
                            </td>
                            <td className="text-center p-3">
                              <Badge variant="outline">{recruiter.activeSubmissions}</Badge>
                            </td>
                            <td className="text-center p-3">
                              <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-200">
                                {recruiter.approvedSubmissions}
                              </Badge>
                            </td>
                            <td className="text-center p-3">
                              <Badge variant="destructive">{recruiter.rejectedSubmissions}</Badge>
                            </td>
                            <td className="text-center p-3">
                              <Badge 
                                variant={recruiter.successRate >= 70 ? "default" : recruiter.successRate >= 50 ? "secondary" : "destructive"}
                                className={
                                  recruiter.successRate >= 70 
                                    ? "bg-green-100 text-green-800 hover:bg-green-200"
                                    : recruiter.successRate >= 50 
                                    ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                                    : ""
                                }
                              >
                                {recruiter.successRate.toFixed(1)}%
                              </Badge>
                            </td>
                            <td className="text-center p-3">
                              <Badge 
                                variant={recruiter.rejectedRate <= 30 ? "default" : recruiter.rejectedRate <= 50 ? "secondary" : "destructive"}
                                className={
                                  recruiter.rejectedRate <= 30 
                                    ? "bg-green-100 text-green-800 hover:bg-green-200"
                                    : recruiter.rejectedRate <= 50 
                                    ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                                    : ""
                                }
                              >
                                {recruiter.rejectedRate.toFixed(1)}%
                              </Badge>
                            </td>
                            <td className="text-center p-3">{recruiter.jobsWorked}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="h-80 flex items-center justify-center">
                <p className="text-muted-foreground">No data available for the selected period</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="performance">
          <Card>
            <CardContent className="h-80 flex items-center justify-center">
              <p className="text-muted-foreground">Performance trends charts coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends">
          <Card>
            <CardContent className="h-80 flex items-center justify-center">
              <p className="text-muted-foreground">Submission trends analysis coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}