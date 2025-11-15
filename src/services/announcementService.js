// src/services/announcementService.js - Supabase version
import { supabase } from '../config/supabase';
import notificationService from './notificationService';

class AnnouncementService {
  // Create new announcement (for CRs)
  async createAnnouncement({ sectionId, crId, title, content, priority = 'medium', crName }) {
    try {
      console.log('Creating announcement:', { sectionId, crId, title, priority });

      // Validate required fields
      if (!title?.trim()) throw new Error('Announcement title is required');
      if (!content?.trim()) throw new Error('Announcement content is required');
      if (!sectionId) throw new Error('Section ID is required');
      if (!crId) throw new Error('CR ID is required');

      const announcementData = {
        section_id: sectionId,
        cr_id: crId,
        cr_name: crName || 'Unknown CR',
        title: title.trim(),
        content: content.trim(),
        priority: priority,
        status: 'active',
        read_by: []
      };

      const { data: announcement, error } = await supabase
        .from('announcements')
        .insert([announcementData])
        .select()
        .single();

      if (error) throw error;

      console.log('Announcement created successfully:', announcement);

      // Create notifications for students
      try {
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('student_id')
          .eq('section_id', sectionId);

        if (enrollments && enrollments.length > 0) {
          const studentIds = enrollments.map(e => e.student_id);
          const priorityLabels = {
            'high': 'Important',
            'medium': 'New',
            'low': 'New'
          };

          const priorityLabel = priorityLabels[priority] || 'New';

          await notificationService.createNotificationForSection({
            sectionId: sectionId,
            crId: crId,
            crName: crName || 'Class Representative',
            title: `${priorityLabel} Announcement`,
            message: title.trim(),
            type: 'announcement',
            relatedId: announcement.id,
            studentIds: studentIds,
            notifyCR: true
          });
        }
      } catch (notificationError) {
        console.error('Error creating notifications for announcement:', notificationError);
      }

      return { success: true, announcement: this.formatAnnouncement(announcement) };

    } catch (error) {
      console.error('Error creating announcement:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  // Get announcements for a section
  async getAnnouncementsBySection(sectionId, includeArchived = false) {
    try {
      console.log('Loading announcements for section:', sectionId);

      if (!sectionId) {
        return { success: true, announcements: [] };
      }

      let query = supabase
        .from('announcements')
        .select('*')
        .eq('section_id', sectionId)
        .order('created_at', { ascending: false });

      if (!includeArchived) {
        query = query.eq('status', 'active');
      }

      const { data: announcements, error } = await query;

      if (error) throw error;

      console.log('Found announcements:', announcements?.length || 0);
      return { success: true, announcements: announcements.map(a => this.formatAnnouncement(a)) };

    } catch (error) {
      console.error('Error getting announcements:', error);
      return { success: false, error: this.getErrorMessage(error), announcements: [] };
    }
  }

  // Update announcement
  async updateAnnouncement(announcementId, updates) {
    try {
      console.log('Updating announcement:', announcementId, updates);

      const updateData = {};
      if (updates.title !== undefined) updateData.title = updates.title.trim();
      if (updates.content !== undefined) updateData.content = updates.content.trim();
      if (updates.priority !== undefined) updateData.priority = updates.priority;
      if (updates.status !== undefined) updateData.status = updates.status;

      const { error } = await supabase
        .from('announcements')
        .update(updateData)
        .eq('id', announcementId);

      if (error) throw error;

      console.log('Announcement updated successfully');
      return { success: true };

    } catch (error) {
      console.error('Error updating announcement:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  // Delete announcement
  async deleteAnnouncement(announcementId) {
    try {
      console.log('Deleting announcement:', announcementId);

      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', announcementId);

      if (error) throw error;

      console.log('Announcement deleted successfully');
      return { success: true };

    } catch (error) {
      console.error('Error deleting announcement:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  // Mark announcement as read (for students)
  async markAsRead(announcementId, studentId) {
    try {
      // Get current announcement
      const { data: announcement, error: fetchError } = await supabase
        .from('announcements')
        .select('read_by')
        .eq('id', announcementId)
        .single();

      if (fetchError) throw fetchError;

      const readBy = announcement.read_by || [];

      if (!readBy.includes(studentId)) {
        const { error: updateError } = await supabase
          .from('announcements')
          .update({ read_by: [...readBy, studentId] })
          .eq('id', announcementId);

        if (updateError) throw updateError;
      }

      return { success: true };
    } catch (error) {
      console.error('Error marking announcement as read:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  // Get single announcement by ID
  async getAnnouncement(announcementId) {
    try {
      const { data: announcement, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('id', announcementId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: false, error: 'Announcement not found' };
        }
        throw error;
      }

      return { success: true, announcement: this.formatAnnouncement(announcement) };
    } catch (error) {
      console.error('Error getting announcement:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  // Helper: Format announcement data
  formatAnnouncement(announcement) {
    if (!announcement) return null;

    return {
      id: announcement.id,
      sectionId: announcement.section_id,
      crId: announcement.cr_id,
      crName: announcement.cr_name,
      title: announcement.title,
      content: announcement.content,
      priority: announcement.priority,
      status: announcement.status,
      readBy: announcement.read_by || [],
      createdAt: announcement.created_at,
      updatedAt: announcement.updated_at
    };
  }

  // Helper method to format error messages
  getErrorMessage(error) {
    console.error('Supabase error details:', error);

    if (error.code) {
      switch (error.code) {
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

export default new AnnouncementService();
