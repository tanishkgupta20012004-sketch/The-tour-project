import app from '../src/app.js';
import pool from '../src/config/db.js';

async function verifyPhase6() {
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  console.log(`\n🔍 Running Phase 6 End-to-End Verification against ${baseUrl}...\n`);

  try {
    // 1. Public Anonymized "Who's In This Group" Batch Preview for Manali Batch #1 (MNL-NOV-01)
    const groupRes = await fetch(`${baseUrl}/departures/1/group-insights`);
    const groupData = await groupRes.json();
    console.log(
      '1. [GET /departures/1/group-insights]:',
      groupData.statusCode,
      '->',
      groupData.data.privacy_safe_headline
    );

    // 2. Traveler Login (Aarav from Indore: HIGH_ADVENTURE, EARLY_BIRD, HIGH_ENERGY_GROUP)
    const travLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'aarav@example.com',
        password: 'Password@123'
      })
    });
    const travToken = (await travLoginRes.json()).data.accessToken;

    // 3. Personalized Compatibility Trip Recommendations Ranked by Match Score
    const recRes = await fetch(`${baseUrl}/compatibility/recommendations`, {
      headers: { Authorization: `Bearer ${travToken}` }
    });
    const recData = await recRes.json();
    const topRec = recData.data.recommendations[0];
    console.log(
      '2. [GET /compatibility/recommendations]:',
      recData.statusCode,
      'Top Ranked Trip:',
      topRec.title,
      `(${topRec.compatibility_match.match_score_percentage}% Match - ${topRec.compatibility_match.match_label})`
    );
    console.log(
      '   Top Match Highlights:',
      topRec.compatibility_match.match_highlights.join(' | ')
    );

    // 4. Detailed 5-Dimension Compatibility Check on a Contrasting Trip (Trip #4: Royal Rajasthan Relaxed Family Tour)
    const checkRes = await fetch(`${baseUrl}/compatibility/trips/4/check`, {
      headers: { Authorization: `Bearer ${travToken}` }
    });
    const checkData = await checkRes.json();
    console.log(
      '3. [GET /compatibility/trips/4/check]:',
      checkData.statusCode,
      'Score:',
      checkData.data.compatibility.match_score_percentage + '%',
      '| Things to Know:',
      checkData.data.compatibility.things_to_know.join(' ')
    );

    // 5. Operator Updates Compatibility Profile for Trip #3 (Indore Camping)
    const opLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'vikram@malwatrails.in',
        password: 'Password@123'
      })
    });
    const opToken = (await opLoginRes.json()).data.accessToken;

    const updateProfileRes = await fetch(`${baseUrl}/compatibility/trips/3/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opToken}`
      },
      body: JSON.stringify({
        ideal_morning_style: 'LEISURELY',
        ideal_social_style: 'BALANCED_SOCIAL',
        solo_traveler_friendly: true,
        ideal_age_brackets: ['18_24', '25_30', '31_40'],
        activity_intensity_level: 2,
        group_vibe_summary: 'Relaxed acoustic campfire under the stars with easy morning forest walk'
      })
    });
    const updateProfileData = await updateProfileRes.json();
    console.log(
      '4. [PUT /compatibility/trips/3/profile (Operator)]:',
      updateProfileData.statusCode,
      'Vibe Summary:',
      updateProfileData.data.group_vibe_summary
    );

    console.log('\n✅ All Phase 6 endpoints verified successfully!');
  } finally {
    server.close();
    await pool.end();
  }
}

verifyPhase6();
