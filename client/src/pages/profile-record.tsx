import React from "react";
import { Card } from "@/components/ui/card";

const ProfileRecordPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Profile Record</h2>
          <p className="mt-1 text-sm text-muted-foreground">Manage and view profile records</p>
        </div>
      </div>

      <Card className="p-6">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-foreground mb-2">Profile Record Management</h3>
          <p className="text-muted-foreground">Profile record functionality will be implemented here.</p>
        </div>
      </Card>
    </div>
  );
};

export default ProfileRecordPage;