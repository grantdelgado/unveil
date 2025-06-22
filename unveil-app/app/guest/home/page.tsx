// app/guest/home/page.tsx
'use client';

import {
  PageWrapper,
  CardContainer,
  PageTitle,
  SectionTitle,
  PrimaryButton,
  SecondaryButton,
  DevModeBox
} from '@/components/ui';

export default function GuestHome() {
  return (
    <PageWrapper>
      <CardContainer maxWidth="md">
        <div className="text-center space-y-8">
          <div className="space-y-4">
            <div className="text-4xl">🎉</div>
            <PageTitle>Guest Home</PageTitle>
          </div>

          {/* RSVP Section */}
          <div className="space-y-4">
            <SectionTitle>RSVP</SectionTitle>
            <PrimaryButton fullWidth={false}>
              RSVP Now
            </PrimaryButton>
          </div>

          {/* Upload Media Section */}
          <div className="space-y-4">
            <SectionTitle>Share Memories</SectionTitle>
            <SecondaryButton fullWidth={false}>
              Upload a Photo/Video
            </SecondaryButton>
          </div>
        </div>

        <DevModeBox>
          <p><strong>Guest Home State:</strong></p>
          <p>Simple landing page for guest functionality</p>
          <p>Shows RSVP and media upload options</p>
          <p>Ready for future functionality integration</p>
        </DevModeBox>
      </CardContainer>
    </PageWrapper>
  );
}
