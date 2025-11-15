# ClassSync - Firebase to Supabase Migration Guide

## 📋 Overview

This document provides complete instructions for migrating ClassSync from Firebase to Supabase, including:
- Complete Supabase PostgreSQL schema
- OneSignal push notifications (replacing Firebase Cloud Messaging)
- Email verification enforcement
- CR single-section restriction
- All service migrations

## ⚠️ Important Changes

### 1. **Authentication**
- Migrated from Firebase Auth to Supabase Auth
- **NEW:** Email verification is now required before users can access the app
- Users will see a verification page until they confirm their email

### 2. **Section Management**
- **NEW:** CRs can now create only ONE section at a time
- Must delete existing section before creating a new one
- Prevents multiple section management confusion

### 3. **Push Notifications**
- Migrated from Firebase Cloud Messaging (FCM) to OneSignal
- No need for cloud functions
- Simpler implementation and better reliability

### 4. **Database**
- Migrated from Firestore to PostgreSQL
- Better performance and relational integrity
- Row Level Security (RLS) for data protection

## 🚀 Migration Steps

### Step 1: Set Up Supabase Database

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the entire contents of `supabase-schema.sql`
4. Click **Run** to execute the SQL

This will create:
- All tables with proper relationships
- Row Level Security (RLS) policies
- Automatic triggers for timestamps and counters
- Indexes for performance

### Step 2: Create Supabase Storage Bucket

1. Go to **Storage** in Supabase dashboard
2. Click **New bucket**
3. Name it `resources`
4. Set it to **Public**
5. Configure settings:
   - File size limit: 10MB
   - Allowed MIME types: `application/pdf`

### Step 3: Enable Realtime for Tables

1. Go to **Database** > **Replication** in Supabase dashboard
2. Enable replication for these tables:
   - `notifications`
   - `polls`
   - `announcements`
   - `activities`

### Step 4: Set Up OneSignal

1. Create a OneSignal account at https://onesignal.com
2. Create a new Web Push app
3. Follow OneSignal's setup wizard for Web Push
4. Note down:
   - **App ID**
   - **REST API Key**

5. Configure OneSignal in your site settings:
   - Add your site URL
   - Configure prompts and appearance

### Step 5: Environment Variables

Create or update `.env` file in your project root:

```env
# Supabase Configuration
REACT_APP_SUPABASE_URL=https://grrmkhffntyoqxvzwjkz.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key

# OneSignal Configuration
REACT_APP_ONESIGNAL_APP_ID=your_onesignal_app_id
REACT_APP_ONESIGNAL_API_KEY=your_onesignal_rest_api_key
```

### Step 6: Replace Service Files

Replace the old Firebase service files with the new Supabase versions:

```bash
# Section Service
mv src/services/sectionService.new.js src/services/sectionService.js

# Activity Service
mv src/services/dashboard/activityService.new.js src/services/dashboard/activityService.js

# Announcement Service
mv src/services/announcementService.new.js src/services/announcementService.js

# Poll Service
mv src/services/pollService.new.js src/services/pollService.js

# Notification Service
mv src/services/notificationService.new.js src/services/notificationService.js
```

### Step 7: Delete Firebase Files

1. Delete `src/config/firebase.js`
2. Delete `public/firebase-messaging-sw.js`
3. Delete `src/services/fcmService.js`

### Step 8: Install Dependencies

```bash
npm install
```

This will:
- Remove `firebase` package
- Keep `@supabase/supabase-js`
- Add `react-onesignal` for push notifications

### Step 9: Update App Entry Point

Update your `src/App.js` or main component to:
1. Initialize OneSignal on app load
2. Check email verification status
3. Show EmailVerification page if not verified

Example integration in your main component:

```javascript
import oneSignalService from './services/oneSignalService';
import EmailVerification from './pages/EmailVerification';

// In useEffect
useEffect(() => {
  // Initialize OneSignal
  oneSignalService.initialize();
}, []);

// In your render logic
if (currentUser && userData && !userData.email_verified) {
  return <EmailVerification onVerified={refreshUserData} />;
}
```

### Step 10: Test the Migration

1. **Test Authentication:**
   - Sign up a new user
   - Check email for verification link
   - Verify email and confirm access is granted

2. **Test CR Functionality:**
   - Create a section as CR
   - Try to create a second section (should be blocked)
   - Delete section and create a new one

3. **Test Student Functionality:**
   - Enroll in section using section key
   - View activities, announcements, polls

4. **Test Push Notifications:**
   - Grant notification permission
   - Create announcement/activity/poll as CR
   - Check if students receive push notifications

## 📁 File Structure After Migration

```
src/
├── config/
│   └── supabase.js                    # Supabase client config
├── services/
│   ├── authService.js                 # ✅ Migrated to Supabase Auth
│   ├── sectionService.js              # ✅ Migrated with CR restriction
│   ├── resourceService.js             # ✅ Already using Supabase
│   ├── announcementService.js         # ✅ Migrated to PostgreSQL
│   ├── pollService.js                 # ✅ Migrated with Realtime
│   ├── notificationService.js         # ✅ Migrated with OneSignal
│   ├── oneSignalService.js            # ✨ NEW - Push notifications
│   └── dashboard/
│       └── activityService.js         # ✅ Migrated to PostgreSQL
├── contexts/
│   └── AuthContext.js                 # ✅ Updated for Supabase Auth
└── pages/
    └── EmailVerification.jsx          # ✨ NEW - Email verification page
```

## 🔧 Configuration Files

### Supabase Config (`src/config/supabase.js`)
Already configured - no changes needed.

### Package.json
Updated to remove Firebase and add OneSignal support.

## 🎯 Key Features

### Email Verification
- **Automatic:** Verification emails sent on signup
- **Blocking:** Users cannot access app until verified
- **UI:** Clean verification page with resend option
- **Polling:** Auto-checks verification status every 5 seconds

### CR Single-Section Restriction
- **Database-level:** RLS policy prevents multiple sections
- **Service-level:** Additional check in sectionService
- **User-friendly:** Clear error message explaining the restriction

### OneSignal Push Notifications
- **No cloud functions needed**
- **Easy setup:** Just configure App ID and API Key
- **Reliable:** Industry-standard notification service
- **Targeting:** Send to specific users/sections

## 🐛 Troubleshooting

### Email Verification Issues
**Problem:** Verification emails not received
**Solution:** 
- Check Supabase Auth settings for email configuration
- Verify SMTP settings are correct
- Check spam folder

### OneSignal Not Working
**Problem:** Push notifications not sending
**Solution:**
- Verify App ID and API Key in .env
- Check OneSignal dashboard for delivery status
- Ensure users have granted permission
- Check browser console for errors

### CR Can Still Create Multiple Sections
**Problem:** RLS policy not working
**Solution:**
- Verify SQL schema was executed correctly
- Check Supabase logs for policy violations
- Ensure user is properly authenticated

### Database Connection Issues
**Problem:** "relation does not exist" errors
**Solution:**
- Ensure SQL schema was executed in correct database
- Check table names match exactly (lowercase with underscores)
- Verify RLS is enabled

## 📊 Data Migration (Optional)

If you have existing Firebase data to migrate:

### Export from Firebase
1. Go to Firebase Console
2. Firestore Database > Import/Export
3. Export data

### Transform and Import to Supabase
You'll need to write custom scripts to:
1. Transform Firebase document structure to PostgreSQL rows
2. Handle ID conversions (Firebase IDs → UUIDs)
3. Update foreign key relationships
4. Import using Supabase client or SQL

**Note:** Data migration scripts are not included due to unique data structures.

## ✅ Migration Checklist

- [ ] Execute SQL schema in Supabase
- [ ] Create `resources` storage bucket
- [ ] Enable Realtime for tables
- [ ] Set up OneSignal account and app
- [ ] Configure environment variables
- [ ] Replace all service files
- [ ] Delete Firebase files
- [ ] Install dependencies
- [ ] Update app entry point
- [ ] Test authentication flow
- [ ] Test email verification
- [ ] Test CR single-section restriction
- [ ] Test push notifications
- [ ] Test all major features

## 🎉 Post-Migration

After successful migration:

1. **Remove Firebase from package.json manually** if not auto-removed:
   ```bash
   npm uninstall firebase
   ```

2. **Clean up unused Firebase files**

3. **Update documentation** for your team

4. **Monitor Supabase dashboard** for:
   - Database usage
   - API calls
   - Storage usage
   - Auth activity

5. **Monitor OneSignal dashboard** for:
   - Delivery rates
   - Click rates
   - Subscription growth

## 📞 Support

If you encounter issues:
1. Check Supabase logs in dashboard
2. Check browser console for errors
3. Review this migration guide
4. Check Supabase and OneSignal documentation

## 🔐 Security Notes

1. **Never commit `.env` file** to version control
2. **Keep API keys secure**
3. **Review RLS policies** to ensure data access is properly restricted
4. **Test with different user roles** (CR and Student) to verify permissions

## 🚨 Breaking Changes

### For Developers
- All service imports remain the same
- Function signatures are mostly unchanged
- Field names in returned objects may differ (camelCase vs snake_case)
- Timestamp fields are ISO strings instead of Firebase Timestamps

### For Users
- **Must verify email** before accessing app
- **CRs limited to one section** at a time
- **OneSignal permission** required for notifications

---

**Migration completed! Your ClassSync app is now running fully on Supabase with OneSignal push notifications. 🎊**
