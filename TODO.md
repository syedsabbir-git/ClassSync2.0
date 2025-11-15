# ✅ Manual TODO Checklist for ClassSync Migration

## 🎯 Critical TODOs (Must Complete)

### 1. Execute SQL Schema in Supabase
**What:** Create all database tables, RLS policies, and triggers
**Where:** Supabase Dashboard → SQL Editor
**File:** `supabase-schema.sql`
**Steps:**
1. Open Supabase project dashboard
2. Go to SQL Editor
3. Copy entire contents of `supabase-schema.sql`
4. Paste and click "Run"
5. Verify all tables created under Database → Tables

---

### 2. Create Storage Bucket
**What:** Create bucket for PDF file uploads
**Where:** Supabase Dashboard → Storage
**Steps:**
1. Click "New bucket"
2. Name: `resources`
3. Public: ✅ Yes
4. File size limit: 10MB
5. Allowed MIME types: `application/pdf`
6. Create bucket

---

### 3. Enable Realtime for Tables
**What:** Enable real-time subscriptions for live updates
**Where:** Supabase Dashboard → Database → Publications

⚠️ **Note:** Free tier uses Supabase Realtime (broadcast/presence), not Database Replication. Good news - **the code already uses the correct free-tier method!**

**For Free Tier (No Action Needed):**
- Your services already use `supabase.channel()` which works on free tier
- Real-time updates will work without enabling replication
- Supabase Realtime is automatically enabled for all projects

**For Paid Tier (Optional - Better Performance):**
If you upgrade to a paid plan, you can enable Database Replication for better performance:
1. Go to Database → Replication (requires paid plan)
2. Enable replication for tables: `notifications`, `polls`, `announcements`, `activities`
3. Update services to use `.on('postgres_changes')` instead of `.channel()`

**Conclusion:** ✅ Skip this step on free tier - your real-time features will work as-is!

---

### 4. Set Up OneSignal Account
**What:** Create OneSignal account and Web Push app
**Where:** https://onesignal.com
**Steps:**
1. Sign up for free OneSignal account
2. Create new app → Select "Web Push"
3. Follow setup wizard
4. Configure:
   - Site URL: Your production/dev URL
   - Prompt settings
   - Appearance preferences
5. Save these credentials:
   - **App ID**: Found in Settings → Keys & IDs
   - **REST API Key**: Found in Settings → Keys & IDs

---

### 5. Configure Environment Variables
**What:** Add Supabase and OneSignal credentials
**File:** Create `.env` in project root
**Content:**
```env
# Supabase - Already configured
REACT_APP_SUPABASE_URL=https://grrmkhffntyoqxvzwjkz.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdycm1raGZmbnR5b3F4dnp3amt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxMzE4ODQsImV4cCI6MjA3MzcwNzg4NH0.AxTCM_GnMGLhTOCObawI3hxvgMQTolVmEqyTcphGHuw

# OneSignal - YOU NEED TO ADD THESE
REACT_APP_ONESIGNAL_APP_ID=YOUR_ONESIGNAL_APP_ID_HERE
REACT_APP_ONESIGNAL_API_KEY=YOUR_ONESIGNAL_REST_API_KEY_HERE
```

⚠️ **Important:** Never commit `.env` to Git. Add to `.gitignore`.

---

### 6. Replace Service Files
**What:** Rename migrated service files to replace old Firebase versions
**Location:** `src/services/`

**Commands to run in terminal:**
```powershell
# Navigate to project root
cd "c:\Users\Syed Rafi\Desktop\DEV\Suprbase\ClassSync"

# Replace service files
Move-Item -Path "src/services/sectionService.new.js" -Destination "src/services/sectionService.js" -Force
Move-Item -Path "src/services/dashboard/activityService.new.js" -Destination "src/services/dashboard/activityService.js" -Force
Move-Item -Path "src/services/announcementService.new.js" -Destination "src/services/announcementService.js" -Force
Move-Item -Path "src/services/pollService.new.js" -Destination "src/services/pollService.js" -Force
Move-Item -Path "src/services/notificationService.new.js" -Destination "src/services/notificationService.js" -Force
```

---

### 7. Delete Firebase Files
**What:** Remove all Firebase-related files
**Files to delete:**
1. `src/config/firebase.js`
2. `public/firebase-messaging-sw.js`
3. `src/services/fcmService.js`

**PowerShell commands:**
```powershell
Remove-Item "src/config/firebase.js" -Force
Remove-Item "public/firebase-messaging-sw.js" -Force
Remove-Item "src/services/fcmService.js" -Force
```

---

### 8. Install Dependencies
**What:** Install new dependencies and remove Firebase
**Command:**
```powershell
npm install
```

This will:
- Remove `firebase` package (already removed from package.json)
- Keep `@supabase/supabase-js`
- Add `react-onesignal`

---

### 9. Update Main App Component
**What:** Initialize OneSignal and handle email verification
**File:** `src/App.js` or your main app component
**Changes needed:**

```javascript
import { useEffect } from 'react';
import oneSignalService from './services/oneSignalService';
import EmailVerification from './pages/EmailVerification';
import { useAuth } from './contexts/AuthContext';

function App() {
  const { currentUser, userData, refreshUserData } = useAuth();

  // Initialize OneSignal
  useEffect(() => {
    oneSignalService.initialize();
  }, []);

  // Show email verification page if not verified
  if (currentUser && userData && !userData.email_verified) {
    return <EmailVerification onVerified={refreshUserData} />;
  }

  // Rest of your app...
  return (
    <div className="App">
      {/* Your existing app structure */}
    </div>
  );
}

export default App;
```

---

### 10. Update Enrollment Flow (Optional Enhancement)
**What:** Request OneSignal permission when students enroll
**File:** `src/pages/EnrollSection.jsx` or enrollment component
**Add after successful enrollment:**

```javascript
import oneSignalService from '../services/oneSignalService';
import notificationService from '../services/notificationService';

// After successful enrollment
const handleEnrollmentSuccess = async (sectionId) => {
  // Request OneSignal permission
  const result = await oneSignalService.requestPermissionAndSubscribe(
    userData.uid, 
    sectionId
  );

  if (result.success && result.playerId) {
    // Save subscription to database
    await notificationService.saveOneSignalSubscription(
      userData.uid,
      sectionId,
      result.playerId
    );
  }
};
```

---

### 11. Configure Supabase Auth Email Templates (Optional)
**What:** Customize verification and password reset emails
**Where:** Supabase Dashboard → Authentication → Email Templates
**Templates to customize:**
- **Confirm signup**: Email verification
- **Reset password**: Password reset emails
- **Change email**: Email change confirmation

---

### 12. Set Up Supabase Email Provider (If needed)
**What:** Configure SMTP for production email sending
**Where:** Supabase Dashboard → Project Settings → Auth
**Note:** Development uses Supabase's built-in email. For production, you may want to configure custom SMTP.

---

## 🧪 Testing Checklist

After completing all TODOs, test these features:

### Authentication Tests
- [ ] Sign up new user
- [ ] Receive verification email
- [ ] Click verification link
- [ ] Verify email confirmed
- [ ] Login after verification
- [ ] Try login before verification (should block)
- [ ] Password reset flow
- [ ] Sign out

### CR Tests
- [ ] Create section (should succeed)
- [ ] Try to create second section (should fail with error)
- [ ] Delete section
- [ ] Create new section after deletion (should succeed)
- [ ] View section students
- [ ] Unenroll a student

### Student Tests
- [ ] Enroll in section with valid key
- [ ] Try to enroll in same section again (should fail)
- [ ] View enrolled sections
- [ ] View activities
- [ ] View announcements
- [ ] View polls
- [ ] Submit poll response

### Push Notification Tests
- [ ] Grant notification permission
- [ ] Create activity as CR
- [ ] Verify students receive notification
- [ ] Create announcement as CR
- [ ] Verify students receive notification
- [ ] Create poll as CR
- [ ] Verify students receive notification
- [ ] Check OneSignal dashboard for delivery stats

### Real-time Tests
- [ ] Open app in two windows (CR and Student)
- [ ] Create activity as CR
- [ ] Verify it appears immediately for student
- [ ] Submit poll as student
- [ ] Verify votes update immediately

---

## 🚨 Warnings and Important Notes

### ⚠️ Database Schema
- **Must execute SQL schema FIRST** before anything else
- All tables must exist before app starts
- RLS policies are critical for security

### ⚠️ Email Verification
- **Blocks all users** until email verified
- Make sure SMTP is configured in production
- Test email delivery in development

### ⚠️ CR Single-Section Restriction
- **Breaking change** for existing CRs with multiple sections
- If migrating existing data, CRs must choose which section to keep
- Database policy will prevent multiple sections

### ⚠️ OneSignal Setup
- **Must complete** before push notifications work
- Free tier has limits (check OneSignal pricing)
- Requires HTTPS in production

### ⚠️ Environment Variables
- **Never commit** `.env` to Git
- Different values for dev/staging/production
- Restart dev server after changing `.env`

---

## 📞 Need Help?

If you encounter issues:

1. **Check logs:**
   - Browser console (F12)
   - Supabase Dashboard → Logs
   - OneSignal Dashboard → Delivery

2. **Common issues:**
   - SQL schema errors: Check syntax, run again
   - RLS errors: Verify user is authenticated
   - OneSignal not working: Check App ID/API Key
   - Email not sending: Check Supabase Auth settings

3. **Resources:**
   - Supabase Docs: https://supabase.com/docs
   - OneSignal Docs: https://documentation.onesignal.com
   - Migration Guide: `MIGRATION_GUIDE.md`

---

## 🎉 When Everything is Done

You should have:
- ✅ Fully functional Supabase database
- ✅ Email verification enforced
- ✅ CR single-section restriction
- ✅ OneSignal push notifications
- ✅ No Firebase dependencies
- ✅ All features working

**Congratulations! Your migration is complete! 🚀**
