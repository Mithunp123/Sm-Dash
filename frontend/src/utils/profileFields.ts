export type ProfileFieldDefinition = {
  field_name: string;
  label: string;
  field_type?: string;
  is_custom?: number;
  visible?: number;
  editable_by_student?: number;
};

const BASE_PROFILE_COLUMNS = new Set([
  'dept',
  'year',
  'phone',
  'blood_group',
  'gender',
  'dob',
  'address',
  'photo_url',
  'photo',
  'custom_fields',
]);

export const parseCustomFields = (customFields?: any): Record<string, any> => {
  if (!customFields) return {};
  if (typeof customFields === 'object' && !Array.isArray(customFields)) {
    return customFields as Record<string, any>;
  }
  try {
    return JSON.parse(customFields as string) || {};
  } catch {
    return {};
  }
};

export const mergeProfileWithCustom = (profile: any | null | undefined) => {
  if (!profile) {
    return { mergedProfile: {}, customValues: {} as Record<string, any> };
  }
  const customValues = parseCustomFields(profile.custom_fields);
  const mergedProfile = { ...profile, ...customValues };
  return { mergedProfile, customValues };
};

export const buildProfilePayload = (
  fields: ProfileFieldDefinition[] = [],
  data: Record<string, any>,
  extra: Record<string, any> = {}
) => {
  const payload: Record<string, any> = { ...extra };
  const customValues: Record<string, any> = {};

  fields.forEach((field) => {
    const value = data?.[field.field_name];
    if (field.is_custom) {
      customValues[field.field_name] = value ?? '';
    } else {
      payload[field.field_name] = value ?? '';
    }
  });

  // Ensure base columns are included even if not part of profile field definitions
  BASE_PROFILE_COLUMNS.forEach((column) => {
    if (column === 'custom_fields') return;
    if (data && data[column] !== undefined && payload[column] === undefined) {
      payload[column] = data[column];
    }
  });

  payload.custom_fields = JSON.stringify(customValues);
  return payload;
};

