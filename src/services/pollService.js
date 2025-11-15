// src/services/pollService.js - Supabase version with Realtime subscriptions
import { supabase } from '../config/supabase';
import notificationService from './notificationService';

class PollService {
  // Create new poll (for CRs)
  async createPoll({ sectionId, crId, question, options, crName, allowMultiple = false }) {
    try {
      console.log('Creating poll:', { sectionId, crId, question, options });

      // Validate required fields
      if (!question?.trim()) throw new Error('Poll question is required');
      if (!options || options.length < 2) throw new Error('Poll must have at least 2 options');
      if (!sectionId || !crId) throw new Error('Section ID and CR ID are required');

      // Create poll data
      const pollData = {
        section_id: sectionId,
        cr_id: crId,
        cr_name: crName || 'Unknown CR',
        question: question.trim(),
        options: options.map((option, index) => ({
          id: index,
          text: option.trim(),
          votes: 0
        })),
        allow_multiple: allowMultiple,
        status: 'active',
        total_responses: 0,
        responded_users: []
      };

      const { data: poll, error } = await supabase
        .from('polls')
        .insert([pollData])
        .select()
        .single();

      if (error) throw error;

      console.log('Poll created successfully:', poll);

      // Create notifications for students
      try {
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('student_id')
          .eq('section_id', sectionId);

        if (enrollments && enrollments.length > 0) {
          const studentIds = enrollments.map(e => e.student_id);

          await notificationService.createNotificationForSection({
            sectionId: sectionId,
            crId: crId,
            crName: crName || 'Class Representative',
            title: 'New Poll Created',
            message: question.trim(),
            type: 'poll',
            relatedId: poll.id,
            studentIds: studentIds,
            notifyCR: true
          });
        }
      } catch (notificationError) {
        console.error('Error creating notifications for poll:', notificationError);
      }

      return { success: true, pollId: poll.id, poll: this.formatPoll(poll) };

    } catch (error) {
      console.error('Error creating poll:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  // Get polls for a section
  async getPollsBySection(sectionId, includeInactive = false) {
    try {
      console.log('Loading polls for section:', sectionId);

      if (!sectionId) {
        return { success: true, polls: [] };
      }

      let query = supabase
        .from('polls')
        .select('*')
        .eq('section_id', sectionId)
        .order('created_at', { ascending: false });

      if (!includeInactive) {
        query = query.eq('status', 'active');
      }

      const { data: polls, error } = await query;

      if (error) throw error;

      console.log('Found polls:', polls?.length || 0);
      return { success: true, polls: polls.map(p => this.formatPoll(p)) };

    } catch (error) {
      console.error('Error getting polls:', error);
      return { success: false, error: this.getErrorMessage(error), polls: [] };
    }
  }

  // Submit poll response (for students)
  async submitPollResponse({ pollId, studentId, studentName, selectedOptions }) {
    try {
      console.log('Submitting poll response:', { pollId, studentId, selectedOptions });

      // Validate input
      if (!pollId || !studentId || !selectedOptions || selectedOptions.length === 0) {
        throw new Error('Missing required data for poll response');
      }

      // Get current poll data
      const { data: poll, error: pollError } = await supabase
        .from('polls')
        .select('*')
        .eq('id', pollId)
        .single();

      if (pollError) throw pollError;

      // Check if poll is active
      if (poll.status !== 'active') {
        throw new Error('This poll is no longer active');
      }

      // Check if user already responded
      const respondedUsers = poll.responded_users || [];
      if (respondedUsers.includes(studentId)) {
        throw new Error('You have already responded to this poll');
      }

      // Validate selected options
      if (!poll.allow_multiple && selectedOptions.length > 1) {
        throw new Error('This poll allows only one selection');
      }

      // Update options with new votes
      const updatedOptions = poll.options.map(option => {
        if (selectedOptions.includes(option.id)) {
          return { ...option, votes: (option.votes || 0) + 1 };
        }
        return option;
      });

      // Update poll
      const { error: updateError } = await supabase
        .from('polls')
        .update({
          options: updatedOptions,
          responded_users: [...respondedUsers, studentId],
          total_responses: (poll.total_responses || 0) + 1
        })
        .eq('id', pollId);

      if (updateError) throw updateError;

      // Create poll response record
      const { error: responseError } = await supabase
        .from('poll_responses')
        .insert([{
          poll_id: pollId,
          student_id: studentId,
          student_name: studentName,
          selected_options: selectedOptions
        }]);

      if (responseError) {
        // Check if already responded (unique constraint)
        if (responseError.code !== '23505') {
          throw responseError;
        }
      }

      console.log('Poll response submitted successfully');
      return { success: true };

    } catch (error) {
      console.error('Error submitting poll response:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  // Update poll status (close/reopen poll)
  async updatePollStatus(pollId, status) {
    try {
      const { error } = await supabase
        .from('polls')
        .update({ status: status })
        .eq('id', pollId);

      if (error) throw error;

      console.log('Poll status updated successfully');
      return { success: true };

    } catch (error) {
      console.error('Error updating poll status:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  // Delete poll (for CRs)
  async deletePoll(pollId) {
    try {
      console.log('Deleting poll:', pollId);

      const { error } = await supabase
        .from('polls')
        .delete()
        .eq('id', pollId);

      if (error) throw error;

      console.log('Poll deleted successfully');
      return { success: true };

    } catch (error) {
      console.error('Error deleting poll:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  // Get poll responses (for CRs)
  async getPollResponses(pollId) {
    try {
      const { data: responses, error } = await supabase
        .from('poll_responses')
        .select('*')
        .eq('poll_id', pollId)
        .order('responded_at', { ascending: false });

      if (error) throw error;

      return { success: true, responses: responses || [] };
    } catch (error) {
      console.error('Error getting poll responses:', error);
      return { success: false, error: this.getErrorMessage(error), responses: [] };
    }
  }

  // Real-time listener for polls
  subscribeToPollsBySection(sectionId, callback, includeInactive = false) {
    try {
      const channel = supabase
        .channel('polls-changes')
        .on('postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'polls',
            filter: `section_id=eq.${sectionId}`
          },
          async (payload) => {
            console.log('Poll change detected:', payload);
            // Refetch all polls
            const result = await this.getPollsBySection(sectionId, includeInactive);
            callback(result);
          }
        )
        .subscribe();

      // Initial load
      this.getPollsBySection(sectionId, includeInactive).then(callback);

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (error) {
      console.error('Error setting up polls subscription:', error);
      return null;
    }
  }

  // Helper: Format poll data
  formatPoll(poll) {
    if (!poll) return null;

    return {
      id: poll.id,
      sectionId: poll.section_id,
      crId: poll.cr_id,
      crName: poll.cr_name,
      question: poll.question,
      options: poll.options,
      allowMultiple: poll.allow_multiple,
      status: poll.status,
      totalResponses: poll.total_responses,
      respondedUsers: poll.responded_users || [],
      createdAt: poll.created_at,
      updatedAt: poll.updated_at
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
        case '23505':
          return 'You have already responded to this poll.';
        default:
          return error.message || 'An unexpected error occurred. Please try again.';
      }
    }

    return error.message || 'An unexpected error occurred. Please try again.';
  }
}

export default new PollService();
