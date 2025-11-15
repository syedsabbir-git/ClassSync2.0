// src/services/courseResourcesService.js - Migrated to Supabase
import { supabase } from '../config/supabase';

class CourseResourcesService {
  constructor() {
    this.tableName = 'course_resources';
  }

  // CREATE new course resource
  async createCourseResource({ sectionId, crId, courseCode, courseName, telegramLink = '', whatsappLink = '', blcLink = '', enrollmentKey = '' }) {
    try {
      console.log('Creating course resource:', { sectionId, courseCode });

      // Clean courseCode to ensure consistency
      const cleanCourseCode = courseCode.trim().replace(/\s+/g, '_');
      const resourceId = `${sectionId}_${cleanCourseCode}`;

      // Check if resource already exists
      const { data: existingResource, error: checkError } = await supabase
        .from(this.tableName)
        .select('id')
        .eq('id', resourceId)
        .single();

      if (existingResource) {
        return { success: false, error: 'Course resource already exists. Use update instead.' };
      }

      // Prepare resource data
      const resourceData = {
        id: resourceId,
        section_id: sectionId,
        cr_id: crId,
        course_code: courseCode.trim(),
        course_name: courseName.trim(),
        telegram_link: telegramLink.trim() || null,
        whatsapp_link: whatsappLink.trim() || null,
        blc_link: blcLink.trim() || null,
        enrollment_key: enrollmentKey.trim() || null
      };

      const { data, error } = await supabase
        .from(this.tableName)
        .insert([resourceData])
        .select()
        .single();

      if (error) {
        console.error('Supabase error creating course resource:', error);
        return { success: false, error: this.getErrorMessage(error) };
      }

      console.log('Course resource created successfully');
      return { 
        success: true, 
        resource: this.formatResource(data)
      };

    } catch (error) {
      console.error('Error creating course resource:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  // UPDATE existing course resource
  async updateCourseResource(resourceId, updateData) {
    try {
      console.log('Updating course resource:', resourceId, updateData);

      // Check if resource exists
      const { data: existingResource, error: checkError } = await supabase
        .from(this.tableName)
        .select('id')
        .eq('id', resourceId)
        .single();
      
      if (!existingResource) {
        return { success: false, error: 'Course resource not found' };
      }

      // Prepare update data (only include fields that are provided)
      const fieldsToUpdate = {};
      
      if (updateData.courseName !== undefined) {
        fieldsToUpdate.course_name = updateData.courseName.trim();
      }
      if (updateData.telegramLink !== undefined) {
        fieldsToUpdate.telegram_link = updateData.telegramLink.trim() || null;
      }
      if (updateData.whatsappLink !== undefined) {
        fieldsToUpdate.whatsapp_link = updateData.whatsappLink.trim() || null;
      }
      if (updateData.blcLink !== undefined) {
        fieldsToUpdate.blc_link = updateData.blcLink.trim() || null;
      }
      if (updateData.enrollmentKey !== undefined) {
        fieldsToUpdate.enrollment_key = updateData.enrollmentKey.trim() || null;
      }

      const { data, error } = await supabase
        .from(this.tableName)
        .update(fieldsToUpdate)
        .eq('id', resourceId)
        .select()
        .single();

      if (error) {
        console.error('Supabase error updating course resource:', error);
        return { success: false, error: this.getErrorMessage(error) };
      }

      console.log('Course resource updated successfully');
      return { success: true, resource: this.formatResource(data) };

    } catch (error) {
      console.error('Error updating course resource:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  // LEGACY: Update or create course resource (for backward compatibility)
  async updateCourseResources({ sectionId, crId, courseCode, courseName, telegramLink = '', whatsappLink = '', blcLink = '', enrollmentKey = '', resourceId = null }) {
    try {
      console.log('Update/Create course resources:', { sectionId, courseCode, resourceId });

      // If resourceId is provided, it's an update operation
      if (resourceId) {
        return await this.updateCourseResource(resourceId, {
          courseName,
          telegramLink,
          whatsappLink,
          blcLink,
          enrollmentKey
        });
      }

      // Otherwise, it's a create operation
      return await this.createCourseResource({
        sectionId,
        crId,
        courseCode,
        courseName,
        telegramLink,
        whatsappLink,
        blcLink,
        enrollmentKey
      });

    } catch (error) {
      console.error('Error in updateCourseResources:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  // Get course resource by ID
  async getCourseResourceById(resourceId) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('id', resourceId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: false, error: 'Resource not found' };
        }
        console.error('Supabase error getting course resource:', error);
        return { success: false, error: this.getErrorMessage(error) };
      }

      return {
        success: true,
        resource: this.formatResource(data)
      };

    } catch (error) {
      console.error('Error getting course resource by ID:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  // Get course resources for a section
  async getCourseResourcesBySection(sectionId) {
    try {
      console.log('Loading course resources for section:', sectionId);

      if (!sectionId) {
        return { success: true, resources: [] };
      }

      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('section_id', sectionId)
        .order('course_code', { ascending: true });

      if (error) {
        console.error('Supabase error getting course resources:', error);
        return { success: false, error: this.getErrorMessage(error), resources: [] };
      }

      const resources = data.map(resource => this.formatResource(resource));

      console.log('Found course resources:', resources.length);
      return { success: true, resources };

    } catch (error) {
      console.error('Error getting course resources:', error);
      return { success: false, error: this.getErrorMessage(error), resources: [] };
    }
  }

  // Delete course resources
  async deleteCourseResources(resourceId) {
    try {
      console.log('Deleting course resource:', resourceId);

      // Check if resource exists before deleting
      const { data: existingResource, error: checkError } = await supabase
        .from(this.tableName)
        .select('id')
        .eq('id', resourceId)
        .single();
      
      if (!existingResource) {
        return { success: false, error: 'Resource not found' };
      }

      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .eq('id', resourceId);

      if (error) {
        console.error('Supabase error deleting course resource:', error);
        return { success: false, error: this.getErrorMessage(error) };
      }

      console.log('Course resource deleted successfully');
      return { success: true };

    } catch (error) {
      console.error('Error deleting course resources:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  // Format resource from database format to frontend format
  formatResource(data) {
    if (!data) return null;

    return {
      id: data.id,
      sectionId: data.section_id,
      crId: data.cr_id,
      courseCode: data.course_code,
      courseName: data.course_name,
      telegramLink: data.telegram_link || '',
      whatsappLink: data.whatsapp_link || '',
      blcLink: data.blc_link || '',
      enrollmentKey: data.enrollment_key || '',
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  // Error handling
  getErrorMessage(error) {
    if (error.code) {
      switch (error.code) {
        case 'PGRST116':
          return 'Resource not found';
        case '23505':
          return 'A course resource with this code already exists';
        case '23503':
          return 'Invalid section or CR reference';
        case '42501':
          return 'Permission denied. Please make sure you are logged in and have the right permissions.';
        default:
          return `Database error: ${error.message || 'Unknown error'}`;
      }
    }
    return error.message || 'An unexpected error occurred. Please try again.';
  }
}

export default new CourseResourcesService();
