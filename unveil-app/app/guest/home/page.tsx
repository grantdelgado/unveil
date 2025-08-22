// app/guest/home/page.tsx
'use client';

import {
  PageWrapper,
  CardContainer,
  PageTitle,
  SectionTitle,
  PrimaryButton,
  SecondaryButton,
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
            <PrimaryButton fullWidth={false}>RSVP Now</PrimaryButton>
          </div>

          {/* Upload Media Section */}
          <div className="space-y-4">
            <SectionTitle>Share Memories</SectionTitle>
            <SecondaryButton fullWidth={false}>
              Upload a Photo/Video
            </SecondaryButton>
          </div>
        </div>
      </CardContainer>
    </PageWrapper>
  );
}
