import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect to the dynamic preview demo
  redirect('/preview/lumenis');
}
