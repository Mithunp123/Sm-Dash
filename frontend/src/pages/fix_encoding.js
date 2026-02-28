const fs = require('fs');
['ManageInterviews.tsx', 'MentorInterviews.tsx'].forEach(f => {
    const path = 'd:/sm-dash-main/frontend/src/pages/' + f;
    let b = fs.readFileSync(path, 'utf8');
    // We are replacing garbled text using ANSI characters read as UTF-8
    b = b.replace(/âœ…/g, '✅')
        .replace(/âœ\\?\\.\\.\\./g, '✅')
        .replace(/âœ\.\.\./g, '✅')
        .replace(/â\s*³|â ³|â³/g, '⏳')
        .replace(/â\s*Œ|â Œ|âŒ/g, '❌')
        .replace(/â\s*‰¤|â‰¤/g, '≤')
        .replace(/â\s*€”|â€”/g, '—')
        .replace(/â˜€/g, '☀')
        .replace(/âœ&amp;/g, '✅')
        // Hardcoded replacements based on common corruption
        .replace(/âœ\.\.\. Selected/g, '✅ Selected')
        .replace(/â\x8f\x83 Waitlisted/g, '⏳ Waitlisted')
        .replace(/â\x9d\x8c Rejected/g, '❌ Rejected')
        .replace(/Marks > 5 â€” /g, 'Marks > 5 — ');

    // Some corrupted sequences from images
    b = b.replace(/âœ\.\.\./g, '✅');
    fs.writeFileSync(path, b, 'utf8');
    console.log("Fixed " + f);
});
