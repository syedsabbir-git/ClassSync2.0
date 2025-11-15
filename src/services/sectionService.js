// src/services/sectionService.js - Supabase version with CR single-section restriction
import { supabase } from '../config/supabase';
import { generateSectionKey } from '../utils/helpers';
import oneSignalService from './oneSignalService';

class SectionService {
  // Create new section (for CRs) - Enforces ONE section per CR
  async createSection({ crId, departmentName, batchNumber, crName }) {
    try {
      // Check if CR already has a section
      const { data: existingSections, error: checkError } = await supabase
        .from('sections')
        .select('id')
        .eq('cr_id', crId);

      if (checkError) throw checkError;

      if (existingSections && existingSections.length > 0) {
        return { 
          success: false, 
          error: 'You can only create one section at a time. Please delete your existing section before creating a new one.' 
        };
      }

      const sectionKey = generateSectionKey();

      const sectionData = {
        section_key: sectionKey,
        department_name: departmentName,
        batch_number: batchNumber,
        cr_id: crId,
        cr_name: crName,
        student_count: 0,
        activity_count: 0
      };

      const { data: section, error: insertError } = await supabase
        .from('sections')
        .insert([sectionData])
        .select()
        .single();

      if (insertError) throw insertError;

      console.log('Section created successfully:', section);
      return { success: true, sectionKey, sectionData: this.formatSection(section) };
    } catch (error) {
      console.error('Error creating section:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  // Get single section by ID
  async getSectionById(sectionId) {
    try {
      console.log('Getting section by ID:', sectionId);

      if (!sectionId) {
        return { success: false, error: 'Section ID is required' };
      }

      const { data: section, error } = await supabase
        .from('sections')
        .select('*')
        .eq('id', sectionId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: false, error: 'Section not found' };
        }
        throw error;
      }

      console.log('Section found:', section);
      return { success: true, section: this.formatSection(section) };

    } catch (error) {
      console.error('Error getting section by ID:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  // Delete entire section (for CRs only) - Cascading delete handled by DB
  async deleteSection(sectionId, crId) {
    try {
      console.log('Deleting section and all related data:', { sectionId, crId });

      // Verify section exists and user is the CR
      const { data: section, error: fetchError } = await supabase
        .from('sections')
        .select('cr_id')
        .eq('id', sectionId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          return { success: false, error: 'Section not found' };
        }
        throw fetchError;
      }

      if (section.cr_id !== crId) {
        return { success: false, error: 'Only the CR can delete this section' };
      }

      // Delete section (cascading will handle related records)
      const { error: deleteError } = await supabase
        .from('sections')
        .delete()
        .eq('id', sectionId);

      if (deleteError) throw deleteError;

      console.log('Section deleted successfully');

      // Remove OneSignal tags for this section
      try {
        await oneSignalService.removeTags(['section_id']);
      } catch (osError) {
        console.error('Error removing OneSignal tags:', osError);
      }

      return {
        success: true,
        message: 'Section deleted successfully.'
      };

    } catch (error) {
      console.error('Error deleting section:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  // Enroll student in section (for Students)
  async enrollInSection({ studentId, sectionKey, studentName }) {
    try {
      console.log('Starting enrollment process for:', { studentId, sectionKey, studentName });

      // Find section by key
      const { data: section, error: sectionError } = await supabase
        .from('sections')
        .select('*')
        .eq('section_key', sectionKey.toUpperCase())
        .single();

      if (sectionError) {
        if (sectionError.code === 'PGRST116') {
          return { success: false, error: 'Invalid section key. Please check the key and try again.' };
        }
        throw sectionError;
      }

      const sectionId = section.id;

      // Check if student is already enrolled
      const { data: existingEnrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('student_id', studentId)
        .eq('section_id', sectionId)
        .single();

      if (existingEnrollment) {
        return { success: false, error: 'You are already enrolled in this section.' };
      }

      // Create enrollment
      const enrollmentData = {
        student_id: studentId,
        student_name: studentName,
        section_id: sectionId,
        section_key: sectionKey.toUpperCase()
      };

      const { error: enrollError } = await supabase
        .from('enrollments')
        .insert([enrollmentData]);

      if (enrollError) {
        if (enrollError.code === '23505') {
          // Unique constraint violation
          return { success: false, error: 'You are already enrolled in this section.' };
        }
        throw enrollError;
      }

      console.log('Enrollment completed successfully');

      // Update OneSignal tags for this user
      try {
        await oneSignalService.updateTags({ section_id: sectionId });
      } catch (osError) {
        console.error('Error updating OneSignal tags:', osError);
      }

      return { success: true, sectionData: this.formatSection(section) };

    } catch (error) {
      console.error('Error enrolling in section:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  // Get CR's sections
  async getCRSections(crId) {
    try {
      console.log('Loading sections for CR:', crId);

      const { data: sections, error } = await supabase
        .from('sections')
        .select('*')
        .eq('cr_id', crId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('Found sections for CR:', sections);
      return { success: true, sections: sections.map(s => this.formatSection(s)) };
    } catch (error) {
      console.error('Error getting CR sections:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  // Get student's sections
  async getStudentSections(studentId) {
    try {
      console.log('Loading sections for student:', studentId);

      // Get enrollments with section data
      const { data: enrollments, error } = await supabase
        .from('enrollments')
        .select(`
          *,
          sections (*)
        `)
        .eq('student_id', studentId);

      if (error) throw error;

      const sections = enrollments
        .filter(e => e.sections)
        .map(e => this.formatSection(e.sections));

      console.log('Found sections for student:', sections);
      return { success: true, sections };
    } catch (error) {
      console.error('Error getting student sections:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  // Get students enrolled in a specific section
  async getSectionStudents(sectionId) {
    try {
      console.log('Loading students for section:', sectionId);

      const { data: enrollments, error } = await supabase
        .from('enrollments')
        .select(`
          *,
          users (
            id,
            name,
            email,
            phone,
            student_id
          )
        `)
        .eq('section_id', sectionId)
        .order('enrolled_at', { ascending: false });

      if (error) throw error;

      const students = enrollments
        .filter(e => e.users)
        .map(e => ({
          uid: e.users.id,
          name: e.users.name || 'Unknown',
          email: e.users.email || '',
          phone: e.users.phone || '',
          studentId: e.users.student_id || '',
          enrolledAt: e.enrolled_at
        }));

      console.log('Found students for section:', students);
      return { success: true, students };
    } catch (error) {
      console.error('Error getting section students:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  // Unenroll a student from a section
  async unenrollStudent(sectionId, studentId) {
    try {
      console.log('Unenrolling student:', { sectionId, studentId });

      // Delete enrollment
      const { error } = await supabase
        .from('enrollments')
        .delete()
        .eq('section_id', sectionId)
        .eq('student_id', studentId);

      if (error) throw error;

      console.log('Student unenrolled successfully');

      // Remove OneSignal section tag if no other enrollments
      try {
        const { data: otherEnrollments } = await supabase
          .from('enrollments')
          .select('id')
          .eq('student_id', studentId);

        if (!otherEnrollments || otherEnrollments.length === 0) {
          await oneSignalService.removeTags(['section_id']);
        }
      } catch (osError) {
        console.error('Error removing OneSignal tags:', osError);
      }

      return { success: true };

    } catch (error) {
      console.error('Error unenrolling student:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  // Helper: Format section data
  formatSection(section) {
    if (!section) return null;

    return {
      id: section.id,
      sectionKey: section.section_key,
      departmentName: section.department_name,
      batchNumber: section.batch_number,
      crId: section.cr_id,
      crName: section.cr_name,
      studentCount: section.student_count || 0,
      activityCount: section.activity_count || 0,
      createdAt: section.created_at,
      updatedAt: section.updated_at
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
          return 'Permission denied. Please make sure you are logged in and try again.';
        case 'PGRST116':
          return 'The requested data was not found.';
        case 'PGRST301':
          return 'Permission denied.';
        default:
          return error.message || 'An unexpected error occurred. Please try again.';
      }
    }

    return error.message || 'An unexpected error occurred. Please try again.';
  }
}

export default new SectionService();
