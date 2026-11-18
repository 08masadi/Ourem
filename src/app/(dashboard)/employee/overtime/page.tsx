import { getCurrentUserProfile } from '@/actions/auth';
import { redirect } from 'next/navigation';
import OvertimeForm from '@/components/requests/OvertimeForm';

export default async function EmployeeOvertimePage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect('/login');
  }

  return (
    <div className="space-y-6">
      <OvertimeForm userProfile={profile} />
    </div>
  );
}
