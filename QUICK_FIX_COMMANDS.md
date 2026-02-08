# Quick Typography Fixes - VS Code Find & Replace Commands

## Use VS Code Find & Replace (Ctrl+H) to Complete Remaining Fixes

### Phase 1: Pixel Size Replacements (Safe - No Review Needed)
These replacements are straightforward and safe to apply project-wide.

#### Command 1: `text-[10px]` → `text-xs`
```
Find: text-\[10px\]
Replace: text-xs
Files to include: src/pages/**/*.tsx
```
**Instances: ~35 remaining** (After already fixing ~15 in priority pages)

#### Command 2: `text-[11px]` → `text-sm`
```
Find: text-\[11px\]
Replace: text-sm
Files to include: src/pages/**/*.tsx
```
**Instances: ~2**

#### Command 3: `text-[9px]` → `text-xs`
```
Find: text-\[9px\]
Replace: text-xs
Files to include: src/pages/**/*.tsx
```
**Instances: ~8**

#### Command 4: `text-[8px]` → `text-xs`
```
Find: text-\[8px\]
Replace: text-xs
Files to include: src/pages/**/*.tsx
```
**Instances: ~7**

---

### Phase 2: Gray Color Replacements (Safe - No Review Needed)
Low volume and clear semantics.

#### Command 5: `text-gray-500` → `text-muted-foreground`
```
Find: text-gray-500
Replace: text-muted-foreground
Files to include: src/pages/**/*.tsx
```
**Instances: ~2 remaining**

#### Command 6: `text-gray-700` → `text-foreground`
```
Find: text-gray-700
Replace: text-foreground
Files to include: src/pages/**/*.tsx
```
**Instances: ~0 remaining**

#### Command 7: `text-gray-900` → `text-foreground`
```
Find: text-gray-900
Replace: text-foreground
Files to include: src/pages/**/*.tsx
```
**Instances: ~0 remaining**

---

### Phase 3: Text-White (Requires Review - Apply Selectively)

**Note**: `text-white` is often intentional in:
- Hero sections with dark backgrounds
- Buttons with colored backgrounds
- Icons over colored backgrounds
- Status badges with colored backgrounds

**Safe instances to replace automatically**:
- Page headings in admin panels (e.g., "Volunteer Submissions", "Student Database")
- General body text that isn't over a colored background

**For now, manually fix only these instances:**

1. **ManageVolunteers.tsx** - Line 450
   - Replace `text-white` with `text-foreground` in main heading
   
2. **ManageUsers.tsx** - Line 376
   - Replace `text-white` with `text-foreground` in main heading
   
3. **ManageTeams.tsx** - Line 443
   - Replace `text-white` with `text-foreground` in main heading
   
4. **ManageStudents.tsx** - Line 331
   - Replace `text-white` with `text-foreground` in main heading
   
5. **ManageStudentDatabase.tsx** - Line 368
   - Replace `text-white` with `text-foreground` in main heading
   
6. **ManageProjects.tsx** - Line 179
   - Replace `text-white` with `text-foreground` in main heading
   
7. **ManageQuestions.tsx** - Line 205
   - Replace `text-white` with `text-foreground` in main heading
   
8. **ManageMeetings.tsx** - Line 252
   - Replace `text-white` with `text-foreground` in main heading
   
9. **ManageEvents.tsx** - Line 721
   - Replace `text-white` with `text-foreground` in main heading
   
10. **ManageBills.tsx** - Line 362
    - Replace `text-white` with `text-foreground` in main heading
    
11. **ManageAwards.tsx** - Line 180
    - Replace `text-white` with `text-foreground` in main heading
    
12. **ManageAttendance.tsx** - Line 535
    - Replace `text-white` with `text-foreground` in main heading
    
13. **ManageActivityLogs.tsx** - Line 137
    - Replace `text-white` with `text-foreground` in main heading
    
14. **ManageOfficeBearers.tsx** - Line 324
    - Replace `text-white` with `text-foreground` in main heading

---

## Estimated Time to Complete

| Phase | Time | Instances |
|-------|------|-----------|
| Phase 1 (Pixel sizes) | 5 min | ~52 instances |
| Phase 2 (Gray colors) | 2 min | ~2 instances |
| Phase 3 (Manual text-white) | 10-15 min | ~14 instances |
| **Total** | **17-22 min** | **~68 instances** |

After these fixes, the project will have consistent typography using design system tokens across all pages.

---

## Verification After Fixes

1. Open a few random pages in browser
2. Check that:
   - All labels are readable and consistent size
   - Table headers have uniform size
   - No "jumpy" or unexpectedly small text
   - Color contrast is maintained
3. Quick visual scan for any obvious inconsistencies

---

## Files Status

✅ **Completed (12 files)**
- StudentProjects, StudentDashboard, StudentBills, StudentAttendance
- StudentReports, PhoneMentoringUpdate, OfficeBearerDashboard
- MentorManagement, ManageVolunteers, Login, ManageQuestions, ManageTeams
- ViewFeedbackReports

🟡 **Remaining (40 files)**
- High priority: ManageStudents, ManageStudentDatabase, ManageUsers
- Medium priority: ManageProjects, ManageOfficeBearers, ManageMeetings, etc.
- Low priority: StudentProfile, StudentFeedback, Settings, Resources, etc.
