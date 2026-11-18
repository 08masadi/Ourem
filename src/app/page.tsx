import { getCurrentUserProfile } from '@/actions/auth';
import { redirect } from 'next/navigation';


export default async function HomePage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect('/login');
  }

  const role = profile.role;
  if (role === 'director') {
    redirect('/director');
  } else if (role === 'finance') {
    redirect('/finance');
  } else {
    redirect('/employee');
  }
}
