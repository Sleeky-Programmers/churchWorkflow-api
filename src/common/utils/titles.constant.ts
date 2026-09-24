// Canonical title catalog. This is now the seed source for each church's
// Title collection (see modules/titles/title.service.ts DEFAULT_TITLES) -
// New churches get these as their starting, editable list. It is not a
// Validation source: member/admin title fields accept any free text up to
// 50 chars (see CreateMemberDto, CreateAdminDto), so a title outside this
// List (or a church's edited list) is always allowed.
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
