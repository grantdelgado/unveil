# Privacy Policy iOS Updates - Draft Patch
**Date:** October 1, 2025  
**Project:** Unveil Wedding App  
**Purpose:** Required privacy policy additions for iOS App Store compliance  

## Instructions for Implementation

**DO NOT commit these changes to the live site yet.** This is a draft patch to be reviewed by legal counsel and integrated into the existing privacy policy at `https://sendunveil.com/privacy`.

## Required New Sections

### Section: iOS App Privacy

Add this section after the main "Information We Collect" section:

---

## iOS App Privacy

### Data Linked to You

When you use the Unveil iOS app, we collect the following data that is linked to your identity:

**Contact Information:**
- Phone numbers for account authentication and SMS notifications
- Email addresses (optional) for account recovery and communication
- Name for profile display and event personalization

**User Content:**
- Photos and videos you voluntarily upload to share at wedding events
- Messages you send to hosts and other guests
- Event information you create or contribute to

**Identifiers:**
- Account identifiers (UUIDs) for app functionality and data association
- Device identifiers for app optimization and support

**Usage Data:**
- App feature interactions for improving user experience (no personal content)
- Performance metrics to optimize app functionality

**Sensitive Information:**
- SMS consent records and timestamps for legal compliance
- IP addresses captured during consent for audit purposes

### Data Not Linked to You

We collect the following data that is not linked to your identity:

**Diagnostics:**
- Error reports and crash logs (with personal information removed)
- Performance metrics and app usage analytics (aggregated and anonymized)
- Device information for compatibility and optimization (no personal identifiers)

### No Tracking

This app does not track you across apps and websites owned by other companies for advertising or advertising measurement purposes. We do not share your personal information with advertising networks or data brokers.

---

### Section: Mobile App Data Collection

Add this section after the iOS App Privacy section:

---

## Mobile App Data Collection

### iOS-Specific Data Practices

**Device Information Collection:**
- iOS version information for app compatibility and feature support
- Device model information for performance optimization
- App version information for customer support and troubleshooting
- Push notification tokens (when you enable notifications)

**Local Storage Practices:**
- Cached event data stored on your device for offline functionality
- User preferences and app settings stored locally
- Session information for maintaining your login state
- Draft messages and content stored temporarily on your device

**Native App Permissions:**

When you use certain features, the iOS app may request the following permissions:

- **Camera Access:** To capture photos and videos for sharing at wedding events
- **Photo Library Access:** To select existing photos from your device to share
- **Photo Library Add:** To save wedding photos and videos to your device
- **Microphone Access:** To record audio when capturing videos
- **Contacts Access:** (Future feature) To help invite guests from your contacts
- **Push Notifications:** To receive event updates and messages

You can manage these permissions in your iOS Settings app at any time.

**Data Synchronization:**
- Changes made offline are synchronized when internet connection is restored
- Synchronization includes only data you have permission to access
- Conflicts are resolved with user notification and choice

---

### Section: Third-Party Services (iOS App)

Add this subsection to the existing Third-Party Services section:

---

### iOS App Third-Party Services

**Capacitor Framework:**
- Provides native iOS functionality and device integration
- Enables camera access, file storage, and other native features
- No data is shared with Ionic (Capacitor's creator) beyond standard app analytics

**iOS System Integration:**
- Apple's iOS APIs for camera, photo library, and notification services
- Data processed locally on your device according to Apple's privacy standards
- No data shared with Apple beyond standard iOS system functions

---

### Section: Data Retention (Mobile App)

Add this subsection to the existing Data Retention section:

---

### Mobile App Data Retention

**Local Device Storage:**
- App cache is automatically cleared periodically by iOS
- You can manually clear app data in iOS Settings > General > iPhone Storage
- Uninstalling the app removes all local data immediately

**Account Data:**
- Account information is retained until you request account deletion
- To delete your account, contact support@sendunveil.com
- Account deletion is processed within 30 days of request

**Backup Considerations:**
- App data may be included in your device's iCloud or iTunes backups
- You can exclude the Unveil app from backups in iOS Settings
- Backup data is encrypted if your device backup is encrypted

---

### Section: Children's Privacy (Updated)

Replace or update the existing Children's Privacy section:

---

## Children's Privacy

**Age Rating:** The Unveil iOS app is rated 12+ due to social networking features and user-generated content.

**Children Under 13:**
- Our app is not directed at children under 13 years of age
- We do not knowingly collect personal information from children under 13
- If we learn we have collected information from a child under 13, we will delete it immediately

**Parental Guidance:**
- We recommend parental supervision for users under 17
- Parents can review and manage their child's app usage through iOS Screen Time controls
- Contact us immediately if you believe a child under 13 has provided personal information

**Content Moderation:**
- All user-generated content is moderated by event hosts
- We provide tools for reporting inappropriate content
- Family-friendly events are encouraged through our community guidelines

---

## Updated Contact Information

Add to the existing Contact section:

**iOS App Privacy Questions:** privacy@sendunveil.com  
**App Store Privacy Concerns:** appstore-privacy@sendunveil.com  
**Data Deletion Requests:** support@sendunveil.com  

## Implementation Checklist

### Legal Review Required
- [ ] Review all new sections with legal counsel
- [ ] Ensure compliance with COPPA (children under 13)
- [ ] Verify GDPR compliance for EU users
- [ ] Confirm CCPA compliance for California users

### Technical Validation
- [ ] Verify all described data collection practices are accurate
- [ ] Confirm third-party service descriptions match actual usage
- [ ] Validate data retention periods match actual implementation
- [ ] Ensure contact information is current and monitored

### App Store Alignment
- [ ] Confirm policy matches App Store privacy questionnaire responses
- [ ] Verify age rating justification aligns with content
- [ ] Ensure all iOS-specific practices are covered
- [ ] Check that tracking disclosure is accurate (currently "No")

### Deployment Process
1. **Legal Approval:** Get written approval from legal counsel
2. **Staging Update:** Deploy to staging environment first
3. **Team Review:** Internal review of updated policy
4. **Production Update:** Deploy to live site before App Store submission
5. **App Store Submission:** Reference updated policy URL in submission

## Risk Assessment

### High Risk Items
- **Age Rating Compliance:** 12+ rating must be supported by policy content
- **Data Collection Accuracy:** Policy must exactly match app behavior
- **Third-Party Disclosures:** All SDKs and services must be disclosed

### Medium Risk Items
- **Contact Information:** Must be monitored and responsive
- **Data Retention:** Periods must be realistic and enforceable
- **User Rights:** Deletion and access procedures must work as described

### Compliance Notes
- **Apple Requirements:** Policy must be accessible without app download
- **GDPR Requirements:** Must include legal basis for data processing
- **CCPA Requirements:** Must include California-specific user rights
- **COPPA Requirements:** Must address children's privacy appropriately

---

**Status:** Draft ready for legal review  
**Next Steps:** Legal counsel review → staging deployment → production update  
**Timeline:** Complete before App Store submission (Week 6 of launch plan)  
**Owner:** Product Manager + Legal Team
