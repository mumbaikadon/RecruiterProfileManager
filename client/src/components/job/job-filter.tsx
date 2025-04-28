import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DatePicker from "@/components/date-picker";
import { Calendar, Filter, Search, X } from "lucide-react";

interface JobFilterProps {
  onFilterChange: (filters: { status?: string; date?: string; search?: string }) => void;
}

const JobFilter: React.FC<JobFilterProps> = ({ onFilterChange }) => {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [search, setSearch] = useState<string>("");

  const handleStatusChange = (value: string) => {
    setStatus(value === "all" ? undefined : value);
    applyFilters(value === "all" ? undefined : value, date, search);
  };

  const handleDateChange = (newDate: Date | undefined) => {
    setDate(newDate);
    applyFilters(
      status,
      newDate ? newDate.toISOString().split("T")[0] : undefined,
      search
    );
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    applyFilters(
      status,
      date ? date.toISOString().split("T")[0] : undefined,
      e.target.value
    );
  };

  const handleClearFilters = () => {
    setStatus(undefined);
    setDate(undefined);
    setSearch("");
    onFilterChange({});
  };

  const applyFilters = (
    statusFilter?: string,
    dateFilter?: string,
    searchFilter?: string
  ) => {
    const filters: { status?: string; date?: string; search?: string } = {};
    if (statusFilter) filters.status = statusFilter;
    if (dateFilter) filters.date = dateFilter;
    if (searchFilter && searchFilter.trim() !== "") filters.search = searchFilter;
    onFilterChange(filters);
  };

  return (
    <div className="flex flex-col space-y-4 md:flex-row md:items-end md:space-y-0 md:space-x-4">
      <div className="w-full md:w-40">
        <Select value={status || "all"} onValueChange={handleStatusChange}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="reviewing">Reviewing</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-full md:w-60">
        <DatePicker 
          date={date} 
          onDateChange={handleDateChange} 
          placeholder="Filter by date"
        />
      </div>

      <div className="w-full md:w-64 relative">
        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={handleSearchChange}
          placeholder="Search jobs..."
          className="pl-8"
        />
      </div>

      {(status || date || search) && (
        <Button variant="ghost" size="sm" onClick={handleClearFilters}>
          <X className="h-4 w-4 mr-2" />
          Clear
        </Button>
      )}
    </div>
  );
};

export default JobFilter;
