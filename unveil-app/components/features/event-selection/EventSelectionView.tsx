import { formatEventDate } from '@/lib/utils/date';
import { isDateUpcoming, formatRelativeDate } from '@/lib/utils/date-helpers';
import { cn } from '@/lib/utils';
import { SkeletonLoader } from '@/components/ui';
import { MobileShell } from '@/components/layout';
import { SupportFooter } from '@/components/shared';
import { UserAvatarButton } from '@/components/common/UserAvatar';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface Event {
  event_id: string;
  user_role: string;
  title: string;
  event_date: string;
  location?: string | null;
}

interface EventSelectionViewProps {
  events: Event[] | null;
  loading: boolean;
  error: { message?: string } | null;
  authLoading: boolean;
  isAuthenticated: boolean;
  onEventSelect: (event: Event) => void;
  onProfile: () => void;
  onRefetch: () => void;
}

/**
 * Server component for event selection UI - optimized for fast initial render
 */
export function EventSelectionView({
  events,
  loading,
  error,
  authLoading,
  isAuthenticated,
  onEventSelect,
  onProfile,
  onRefetch,
}: EventSelectionViewProps) {
  const { user: currentUser, loading: userLoading } = useCurrentUser();
  // Show loading while auth is being checked
  if (authLoading || (!isAuthenticated && !authLoading)) {
    return (
      <MobileShell>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </MobileShell>
    );
  }

  if (loading) {
    const header = (
      <div className="max-w-md mx-auto px-4 pt-6 w-full">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="h-8 w-32 bg-gray-200 rounded animate-pulse mb-2"></div>
            <div className="h-4 w-48 bg-gray-200 rounded animate-pulse"></div>
          </div>
          <div className="w-12 h-12 bg-gray-200 rounded-full animate-pulse"></div>
        </div>
      </div>
    );

    const footer = <SupportFooter />;

    return (
      <MobileShell header={header} footer={footer}>
        <div className="max-w-md mx-auto px-4 py-8 w-full">
          <SkeletonLoader variant="card" count={3} />
        </div>
      </MobileShell>
    );
  }

  if (error) {
    const header = (
      <div className="max-w-md mx-auto px-4 pt-6 w-full">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Error Loading Events
          </h1>
          <p className="text-lg text-gray-600">Something went wrong</p>
        </div>
      </div>
    );

    const footer = <SupportFooter />;

    return (
      <MobileShell header={header} footer={footer}>
        <div className="max-w-md mx-auto px-4 py-8 w-full flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="text-6xl">⚠️</div>
            <p className="text-gray-600 break-words">
              {error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={onRefetch}
              className="px-6 py-3 bg-rose-500 text-white rounded-xl font-semibold hover:bg-rose-600 transition-colors min-h-[44px] min-w-[44px]"
            >
              Try Again
            </button>
          </div>
        </div>
      </MobileShell>
    );
  }

  // Group events by user role for better organization
  const hostEvents =
    events?.filter((event) => event.user_role === 'host') || [];
  const guestEvents =
    events?.filter((event) => event.user_role === 'guest') || [];

  // Split events into upcoming and past for each role
  const upcomingHostEvents = hostEvents.filter((event) => 
    isDateUpcoming(event.event_date)
  ).sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
  
  const pastHostEvents = hostEvents.filter((event) => 
    !isDateUpcoming(event.event_date)
  ).sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());

  const upcomingGuestEvents = guestEvents.filter((event) => 
    isDateUpcoming(event.event_date)
  ).sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
  
  const pastGuestEvents = guestEvents.filter((event) => 
    !isDateUpcoming(event.event_date)
  ).sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());

  const header = (
    <div className="max-w-md mx-auto px-4 pt-6 w-full">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h1 className="text-4xl font-bold text-rose-500 mb-2 break-words">
            Welcome!
          </h1>
          <p className="text-lg text-gray-600">Choose an event to continue.</p>
        </div>
        {userLoading || !currentUser ? (
          <div className="w-12 h-12 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
        ) : (
          <UserAvatarButton
            id={currentUser.id}
            name={currentUser.fullName}
            imageUrl={currentUser.avatarUrl}
            size="lg"
            onClick={onProfile}
            buttonAriaLabel="Open profile settings"
            hasPopup={false}
            className="flex-shrink-0"
          />
        )}
      </div>
    </div>
  );

  const footer = <SupportFooter />;

  return (
    <div id="select-event">
      <MobileShell header={header} footer={footer} className="scroll-container">
        <div className="max-w-md mx-auto px-4 py-8 w-full space-y-8">
          {/* Events List */}
          <div className="space-y-8">
            {/* Upcoming Host Events */}
            {upcomingHostEvents.length > 0 && (
              <EventSection
                title="Your Upcoming Wedding"
                emoji="💍"
                events={upcomingHostEvents}
                onEventSelect={onEventSelect}
                formatDate={formatEventDate}
              />
            )}

            {/* Past Host Events */}
            {pastHostEvents.length > 0 && (
              <EventSection
                title="Your Past Wedding"
                emoji="💍"
                events={pastHostEvents}
                onEventSelect={onEventSelect}
                formatDate={formatRelativeDate}
                isPast
              />
            )}

            {/* Upcoming Guest Events */}
            {upcomingGuestEvents.length > 0 && (
              <EventSection
                title="Upcoming Weddings You're Invited To"
                emoji="🍾"
                events={upcomingGuestEvents}
                onEventSelect={onEventSelect}
                formatDate={formatEventDate}
              />
            )}

            {/* Past Guest Events */}
            {pastGuestEvents.length > 0 && (
              <EventSection
                title="Past Weddings You Attended"
                emoji="🍾"
                events={pastGuestEvents}
                onEventSelect={onEventSelect}
                formatDate={formatRelativeDate}
                isPast
              />
            )}

            {/* Empty State - No Events */}
            {(!events || events.length === 0) && (
              <div className="text-center py-12 space-y-6">
                <div className="text-6xl">💒</div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    No events yet
                  </h3>
                  <p className="text-gray-600 break-words">
                    You don&apos;t have any events to view at this time.
                  </p>
                </div>
              </div>
            )}

            {/* Empty State - No Upcoming Events */}
            {events && events.length > 0 && 
             upcomingHostEvents.length === 0 && 
             upcomingGuestEvents.length === 0 && 
             (pastHostEvents.length > 0 || pastGuestEvents.length > 0) && (
              <div className="text-center py-8 space-y-4">
                <div className="text-4xl">📅</div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No upcoming events
                  </h3>
                  <p className="text-gray-600 break-words">
                    All your events have already happened. You can still access them below.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </MobileShell>
    </div>
  );
}

interface EventSectionProps {
  title: string;
  emoji: string;
  events: Event[];
  onEventSelect: (event: Event) => void;
  formatDate: (date: string) => string;
  isPast?: boolean;
}

function EventSection({ 
  title, 
  emoji, 
  events, 
  onEventSelect, 
  formatDate, 
  isPast = false 
}: EventSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{emoji}</span>
        <h2 className="text-xl font-bold text-gray-800">{title}</h2>
      </div>

      <div className="space-y-3">
        {events.map((event) => {
          const formattedDate = formatDate(event.event_date);

          return (
            <div key={event.event_id} className="relative">
              <button
                onClick={() => onEventSelect(event)}
                data-testid="event-card"
                aria-label={isPast ? `Past event — ${event.title}` : undefined}
                className={cn(
                  'w-full p-5 bg-white border border-gray-200 rounded-xl shadow-sm',
                  'transition-all duration-200 hover:shadow-md hover:border-rose-300',
                  'focus:outline-none focus:ring-2 focus:ring-rose-300 focus:ring-offset-2',
                  'active:scale-[0.98]',
                  'group',
                  isPast && 'opacity-70',
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 text-left min-w-0">
                    {isPast && (
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900 break-words">
                          {event.title}
                        </h3>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Completed
                        </span>
                      </div>
                    )}
                    {!isPast && (
                      <h3 className="text-lg font-semibold text-gray-900 mb-1 break-words">
                        {event.title}
                      </h3>
                    )}
                    {event.location && (
                      <p className="text-gray-600 italic mb-2 break-words">
                        {event.location}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-gray-600">
                      <span>📅</span>
                      <span className="font-medium break-words">
                        {formattedDate}
                      </span>
                    </div>
                  </div>

                  <div className="text-gray-400 group-hover:text-rose-500 transition-colors ml-4">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
