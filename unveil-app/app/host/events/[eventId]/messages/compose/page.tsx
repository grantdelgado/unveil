import { redirect } from 'next/navigation';

interface ComposePageProps {
  params: Promise<{
    eventId: string;
  }>;
}

export default async function ComposePage({ params }: ComposePageProps) {
  const { eventId } = await params;
  
  // Redirect to the main messages page
  redirect(`/host/events/${eventId}/messages`);
}
