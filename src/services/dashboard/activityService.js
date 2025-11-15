// src/services/dashboard/activityService.js - Supabase version
import { supabase } from '../../config/supabase';
import notificationService from '../notificationService';

class ActivityService {
  // Create new activity (for CRs)
  async createActivity(activityData) {
    try {
      console.log('Creating activity with data:', activityData);

      const {
        sectionId,
        crId,
        crName,
        title,
        description,
        type,
        dueDate,
        submissionType,
        submissionLink,
        submissionLocation,
        status = 'active'
      } = activityData;

      // Validate required fields
      if (!title?.trim()) throw new Error('Activity title is required');
      if (!description?.trim()) throw new Error('Activity description is required');
      if (!sectionId) throw new Error('Section ID is required');
      if (!crId) throw new Error('CR ID is required');
      if (!dueDate) throw new Error('Due date is required');

      const processedActivityData = {
        section_id: sectionId,
        cr_id: crId,
        title: title.trim(),
        description: description.trim(),
        type: type || 'assignment',
        due_date: new Date(dueDate).toISOString(),
        submission_type: submissionType || 'physical',
        submission_link: submissionType === 'online' && submissionLink ? submissionLink.trim() : null,
        submission_location: submissionType === 'physical' && submissionLocation ? submissionLocation.trim() : null,
        status: status,
        submission_count: 0,
        completed_count: 0
      };

      const { data: activity, error } = await supabase
        .from('activities')
        .insert([processedActivityData])
        .select()
        .single();

      if (error) throw error;

      console.log('Activity created successfully:', activity);

      // Create notifications for students (only for active activities)
      if (status === 'active') {
        try {
          // Get enrolled students
          const { data: enrollments } = await supabase
            .from('enrollments')
            .select('student_id')
            .eq('section_id', sectionId);

          if (enrollments && enrollments.length > 0) {
            const studentIds = enrollments.map(e => e.student_id);
            const dueDateFormatted = new Date(dueDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });

            const typeLabels = {
              'assignment': 'Assignment',
              'quiz': 'Quiz',
              'lab': 'Lab Report',
              'presentation': 'Presentation'
            };

            const typeLabel = typeLabels[type] || 'Task';

            await notificationService.createNotificationForSection({
              sectionId: sectionId,
              crId: crId,
              crName: crName || 'Class Representative',
              title: `New ${typeLabel} Assigned`,
              message: `${title.trim()} - Due: ${dueDateFormatted}`,
              type: 'task',
              relatedId: activity.id,
              studentIds: studentIds,
              notifyCR: true
            });
          }
        } catch (notificationError) {
          console.error('Error creating notifications for activity:', notificationError);
        }
      }

      return { success: true, activity: this.formatActivity(activity) };
    } catch (error) {
      console.error('Error creating activity:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  // Get activities for a section
  async getActivitiesBySection(sectionId, includeArchived = false) {
    try {
      console.log('Loading activities for section:', sectionId);

      if (!sectionId) {
        return { success: true, activities: [] };
      }

      let query = supabase
        .from('activities')
        .select('*')
        .eq('section_id', sectionId)
        .order('due_date', { ascending: true });

      if (!includeArchived) {
        query = query.neq('status', 'archived');
      }

      const { data: activities, error } = await query;

      if (error) throw error;

      console.log('Found activities:', activities?.length || 0);
      return { success: true, activities: activities.map(a => this.formatActivity(a)) };
    } catch (error) {
      console.error('Error getting activities:', error);
      return { success: false, error: this.getErrorMessage(error), activities: [] };
    }
  }

  // Real-time listener for activities
  subscribeToActivities(sectionId, callback, includeArchived = false) {
    try {
      if (!sectionId) {
        callback({ success: true, activities: [] });
        return null;
      }

      let query = supabase
        .channel('activities-changes')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'activities',
            filter: `section_id=eq.${sectionId}`
          }, 
          async (payload) => {
            console.log('Activity change detected:', payload);
            // Refetch all activities
            const result = await this.getActivitiesBySection(sectionId, includeArchived);
            callback(result);
          }
        )
        .subscribe();

      // Initial load
      this.getActivitiesBySection(sectionId, includeArchived).then(callback);

      return () => {
        supabase.removeChannel(query);
      };
    } catch (error) {
      console.error('Error setting up activities subscription:', error);
      return null;
    }
  }

  // Update activity
  async updateActivity(activityId, updates) {
    try {
      const updateData = { ...updates };

      // Format field names for database
      if (updates.title !== undefined) updateData.title = updates.title.trim();
      if (updates.description !== undefined) updateData.description = updates.description.trim();
      if (updates.submissionLink !== undefined) {
        updateData.submission_link = updates.submissionLink ? updates.submissionLink.trim() : null;
        delete updateData.submissionLink;
      }
      if (updates.submissionLocation !== undefined) {
        updateData.submission_location = updates.submissionLocation ? updates.submissionLocation.trim() : null;
        delete updateData.submissionLocation;
      }
      if (updates.dueDate) {
        updateData.due_date = new Date(updates.dueDate).toISOString();
        delete updateData.dueDate;
      }

      const { error } = await supabase
        .from('activities')
        .update(updateData)
        .eq('id', activityId);

      if (error) throw error;

      console.log('Activity updated successfully');
      return { success: true };
    } catch (error) {
      console.error('Error updating activity:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  // Delete activity
  async deleteActivity(activityId, sectionId) {
    try {
      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', activityId);

      if (error) throw error;

      console.log('Activity deleted successfully');
      return { success: true };
    } catch (error) {
      console.error('Error deleting activity:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  // Get activity statistics for dashboard
  async getActivityStats(sectionId) {
    try {
      if (!sectionId) {
        return {
          success: true,
          stats: {
            total: 0,
            active: 0,
            overdue: 0,
            dueToday: 0,
            dueThisWeek: 0,
            byType: { assignment: 0, quiz: 0, lab: 0, presentation: 0 }
          }
        };
      }

      const { data: activities, error } = await supabase
        .from('activities')
        .select('*')
        .eq('section_id', sectionId)
        .neq('status', 'archived');

      if (error) throw error;

      const now = new Date();
      let stats = {
        total: 0,
        active: 0,
        overdue: 0,
        dueToday: 0,
        dueThisWeek: 0,
        byType: {
          assignment: 0,
          quiz: 0,
          lab: 0,
          presentation: 0
        }
      };

      activities.forEach(activity => {
        const dueDate = new Date(activity.due_date);

        stats.total++;
        stats.byType[activity.type] = (stats.byType[activity.type] || 0) + 1;

        if (activity.status === 'active') {
          stats.active++;

          const diffTime = dueDate.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays < 0) {
            stats.overdue++;
          } else if (diffDays === 0) {
            stats.dueToday++;
          } else if (diffDays <= 7) {
            stats.dueThisWeek++;
          }
        }
      });

      return { success: true, stats };
    } catch (error) {
      console.error('Error getting activity stats:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  // Get single activity by ID
  async getActivity(activityId) {
    try {
      const { data: activity, error } = await supabase
        .from('activities')
        .select('*')
        .eq('id', activityId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: false, error: 'Activity not found' };
        }
        throw error;
      }

      return { success: true, activity: this.formatActivity(activity) };
    } catch (error) {
      console.error('Error getting activity:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  // Helper: Format activity data
  formatActivity(activity) {
    if (!activity) return null;

    return {
      id: activity.id,
      sectionId: activity.section_id,
      crId: activity.cr_id,
      title: activity.title,
      description: activity.description,
      type: activity.type,
      dueDate: activity.due_date,
      submissionType: activity.submission_type,
      submissionLink: activity.submission_link,
      submissionLocation: activity.submission_location,
      status: activity.status,
      submissionCount: activity.submission_count,
      completedCount: activity.completed_count,
      createdAt: activity.created_at,
      updatedAt: activity.updated_at
    };
  }

  // Helper method to format error messages
  getErrorMessage(error) {
    console.error('Supabase error details:', error);

    if (error.code) {
      switch (error.code) {
        case '23505':
          return 'This record already exists.';
        case '23503':
          return 'Related record not found.';
        case '42501':
        case 'PGRST301':
          return 'Permission denied. Please make sure you are logged in and have the right permissions.';
        case 'PGRST116':
          return 'The requested data was not found.';
        default:
          return error.message || 'An unexpected error occurred. Please try again.';
      }
    }

    return error.message || 'An unexpected error occurred. Please try again.';
  }
}

export default new ActivityService();
