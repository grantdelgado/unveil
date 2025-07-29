'use client';

import { Button } from '@/components/ui';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Unveil Dashboard</h1>
          <p className="text-gray-600 mb-6">MVP messaging platform ready for development</p>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900">Authentication</h3>
                <p className="text-sm text-blue-700 mt-1">useAuth hook ready</p>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900">Messaging</h3>
                <p className="text-sm text-green-700 mt-1">Real-time messaging ready</p>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="font-semibold text-purple-900">Media</h3>
                <p className="text-sm text-purple-700 mt-1">Photo upload ready</p>
              </div>
            </div>
            
            <Button className="w-full md:w-auto">
              Start Building Features
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
