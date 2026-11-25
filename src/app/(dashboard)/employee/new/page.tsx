import RequestForm from '@/components/requests/RequestForm';
import { getCurrentUserProfile } from '@/actions/auth';

export default async function NewReimbursementPage() {
  const profile = await getCurrentUserProfile();

  return (
    <div className="py-2">
      <RequestForm initialProfile={profile} />
    </div>
  );
}
