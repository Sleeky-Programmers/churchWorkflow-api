// Canonical title catalog - kept in sync by hand with the frontend's copy
// (church-workflow/src/lib/titles.ts). The two apps are separate repos with
// No shared-package infrastructure today, so this is documentation/a
// Reference list, not a validation source: member/admin title fields accept
// Any free text up to 50 chars (see CreateMemberDto, CreateAdminDto), so a
// Title outside this list is always allowed.
export const TITLE_CATEGORIES: Record<string, string[]> = {
  General: [
    'Mr',
    'Mrs',
    'Miss',
    'Ms',
    'Dr',
    'Prof',
    'Engr',
    'Barr',
    'Arc',
    'Chief',
    'Hon',
    'Sir',
    'Lady',
  ],
  Pastoral: [
    'Pastor',
    'Senior Pastor',
    'Assistant Pastor',
    'Associate Pastor',
    'Youth Pastor',
    'Resident Pastor',
    'Pastor (Mrs)',
    'Minister',
    'Evangelist',
    'Missionary',
    'Overseer',
    'General Overseer',
  ],
  'Five-fold': ['Apostle', 'Prophet', 'Prophetess', 'Teacher'],
  Clergy: [
    'Rev',
    'Rev. Dr',
    'Very Rev',
    'Rt. Rev',
    'Most Rev',
    'Rev. Fr',
    'Fr',
    'Sr (Rev. Sister)',
    'Bishop',
    'Archbishop',
    'Canon',
    'Venerable (Ven.)',
  ],
  'Church Offices': [
    'Elder',
    'Deacon',
    'Deaconess',
    'Brother',
    'Sister',
    'Mother in Israel',
  ],
};

export const TITLE_MAX_LENGTH = 50;
