import bcrypt from 'bcryptjs';
import pool from '../src/config/db.js';

async function seedDatabase() {
  const connection = await pool.getConnection();
  try {
    console.log('Seeding tour_marketplace_db with Phase 1 & Phase 2 data...');
    await connection.beginTransaction();

    const defaultPasswordHash = await bcrypt.hash('Password@123', 10);

    // 1. Seed Users (Admin, Operators, Travelers)
    await connection.query(
      `INSERT INTO users (id, full_name, email, phone, password_hash, role, is_phone_verified, is_email_verified)
       VALUES
         (1, 'Platform Admin', 'admin@tourmarketplace.in', '9000000001', ?, 'ADMIN', TRUE, TRUE),
         (2, 'Rohan Sharma (Himalayan Nomads)', 'rohan@himalayannomads.in', '9000000002', ?, 'OPERATOR', TRUE, TRUE),
         (3, 'Vikram Patel (Malwa Riders & Trails)', 'vikram@malwatrails.in', '9000000003', ?, 'OPERATOR', TRUE, TRUE),
         (4, 'Meera Rathore (Royal Desert Tours)', 'meera@royaldesert.in', '9000000004', ?, 'OPERATOR', TRUE, FALSE),
         (5, 'Aarav Verma', 'aarav@example.com', '9000000005', ?, 'TRAVELER', TRUE, TRUE)
       ON DUPLICATE KEY UPDATE full_name = VALUES(full_name)`,
      [
        defaultPasswordHash,
        defaultPasswordHash,
        defaultPasswordHash,
        defaultPasswordHash,
        defaultPasswordHash
      ]
    );

    // 2. Seed Traveler Compatibility Preferences
    await connection.query(
      `INSERT INTO traveler_preferences (
         user_id, pace_preference, morning_style, social_style,
         comfort_preference, preferred_trip_types, age_bracket, gender, home_city
       ) VALUES (
         5, 'HIGH_ADVENTURE', 'EARLY_BIRD', 'HIGH_ENERGY_GROUP',
         'STANDARD_COMFORT', JSON_ARRAY('STRANGER_GROUP', 'BIKE_CAR_EXPEDITION', 'WEEKEND_NICHE'),
         '25_30', 'MALE', 'Indore'
       )
       ON DUPLICATE KEY UPDATE home_city = VALUES(home_city)`
    );

    // 3. Seed Operators (2 Verified, 1 Pending KYC)
    await connection.query(
      `INSERT INTO operators (
         id, user_id, business_name, slug, tagline, bio, operator_type,
         base_city, operating_regions, instagram_handle, website_url,
         support_email, support_phone, emergency_contact_phone,
         gst_number, pan_number, kyc_status, verified_at, verified_by_admin_id,
         commission_rate_pct, rating_avg, reviews_count, total_completed_trips
       ) VALUES
         (
           1, 2, 'Himalayan Nomads Community', 'himalayan-nomads-community',
           'Curated stranger group trips & high-altitude motorcycle expeditions',
           'Over 120+ fixed-departure batches across Himachal, Kashmir, and Ladakh with trained trip captains and backup vehicles.',
           'TRAVEL_COMMUNITY', 'Delhi',
           JSON_ARRAY('Himachal Pradesh', 'Ladakh', 'Uttarakhand'),
           '@himalayannomads.in', 'https://himalayannomads.example.com',
           'support@himalayannomads.in', '9811122233', '9811122299',
           '07AABCU9603R1ZM', 'AABCU9603R', 'VERIFIED', NOW(), 1,
           10.00, 4.80, 94, 128
         ),
         (
           2, 3, 'Malwa Trails & Expeditions', 'malwa-trails-and-expeditions',
           'Weekend camping, forest treks & road trips from Indore & Bhopal',
           'Central India’s favorite outdoor community organizing weekend campfires, offbeat treks, and scenic road trips.',
           'BIKER_CLUB', 'Indore',
           JSON_ARRAY('Madhya Pradesh', 'Rajasthan', 'Maharashtra'),
           '@malwatrails_indore', 'https://malwatrails.example.com',
           'hello@malwatrails.in', '9755511122', '9755511199',
           '23BBBCU1234F1Z5', 'BBBCU1234F', 'VERIFIED', NOW(), 1,
           10.00, 4.70, 62, 85
         ),
         (
           3, 4, 'Royal Desert Heritage Journeys', 'royal-desert-heritage-journeys',
           'Customizable private family & group holidays across Rajasthan',
           'Bespoke private tours across Jaipur, Udaipur, Jodhpur, and Jaisalmer with verified chauffeurs and heritage stays.',
           'REGISTERED_AGENCY', 'Jaipur',
           JSON_ARRAY('Rajasthan', 'Gujarat'),
           '@royaldesertjourneys', 'https://royaldesert.example.com',
           'bookings@royaldesert.in', '9414055566', '9414055599',
           '08CCCCU5678G1Z2', 'CCCCU5678G', 'PENDING', NULL, NULL,
           10.00, 0.00, 0, 0
         )
       ON DUPLICATE KEY UPDATE business_name = VALUES(business_name)`
    );

    // 4. Seed Sample Trips across the 4 core categories from the business plan
    await connection.query(
      `INSERT INTO trips (
         id, operator_id, title, slug, trip_category, experience_type,
         origin_city, destination_city, duration_days, duration_nights,
         base_price, comfort_level, difficulty_level, accommodation_type,
         pace_tag, vibe_tags, highlights, inclusions, exclusions, cancellation_policy,
         safety_and_permits, is_customizable_private, status
       ) VALUES
         (
           1, 1,
           'Manali Solang & Atal Tunnel Stranger Group Escape',
           'manali-solang-atal-tunnel-stranger-group-escape',
           'STRANGER_GROUP', 'Backpacking & Group Adventure',
           'Delhi', 'Manali', 4, 3,
           9999.00, 'STANDARD', 'EASY', 'HOTEL',
           'BALANCED',
           JSON_ARRAY('Solo Friendly', 'Bonfire & Music', 'Stranger Group', 'Mountain Cafes'),
           JSON_ARRAY('Cross Atal Tunnel to Sissu Waterfall', 'Old Manali Cafe Hopping', 'Solang Valley Snow Point', 'Riverside Bonfire Mixer'),
           JSON_ARRAY('AC Volvo/Tempo Traveller from Delhi', '3 Nights stay in riverside boutique hotel', 'Breakfast & Dinner', 'Trip Captain'),
           JSON_ARRAY('Lunches', 'Paragliding / Adventure sport tickets', 'Personal expenses'),
           JSON_OBJECT('free_cancellation_days_before', 15, 'refund_7_to_15_days_pct', 50, 'refund_under_7_days_pct', 0, 'operator_cancellation_refund_pct', 100),
           JSON_OBJECT('first_aid_kit', true, 'verified_trip_captain', true),
           FALSE, 'PUBLISHED'
         ),
         (
           2, 1,
           'Leh-Ladakh 6-Day Motorcycle Expedition with Support Vehicle',
           'leh-ladakh-6-day-motorcycle-expedition',
           'BIKE_CAR_EXPEDITION', 'Motorcycle Expedition',
           'Leh', 'Leh (via Nubra & Pangong)', 6, 5,
           24999.00, 'STANDARD', 'CHALLENGING', 'MIXED',
           'HIGH_ADVENTURE',
           JSON_ARRAY('Royal Enfield Himalayan', 'Khardung La', 'Backup Van & Mechanic', 'Biker Brotherhood'),
           JSON_ARRAY('Ride over Khardung La (17,982 ft)', 'Nubra Valley Sand Dunes & Double Humped Camel', 'Pangong Tso Lake Stargazing Stay', 'Dedicated Backup Van & Mechanic'),
           JSON_ARRAY('Royal Enfield Himalayan 411/450 with Fuel', 'Backup Cargo Vehicle & Certified Mechanic', 'Oxygen Cylinder & Medical Kit', 'Inner Line Permits', 'Stay & MAP Meals'),
           JSON_ARRAY('Flights to Leh', 'Riding gear rental', 'Refundable bike security deposit'),
           JSON_OBJECT('free_cancellation_days_before', 21, 'refund_7_to_15_days_pct', 40, 'refund_under_7_days_pct', 0, 'operator_cancellation_refund_pct', 100),
           JSON_OBJECT('backup_vehicle', true, 'certified_mechanic', true, 'oxygen_cylinder', true, 'inner_line_permits_included', true),
           FALSE, 'PUBLISHED'
         ),
         (
           3, 2,
           'Choral River & Forest Starlight Camping near Indore',
           'choral-river-forest-starlight-camping-indore',
           'WEEKEND_NICHE', 'Camping & Stargazing',
           'Indore', 'Choral Dam / Mhow Forest', 2, 1,
           2499.00, 'BUDGET', 'EASY', 'CAMPING',
           'RELAXED',
           JSON_ARRAY('Weekend Getaway', 'Acoustic Jamming', 'Forest Trek', 'Indore Departure'),
           JSON_ARRAY('Sunset by Choral Backwaters', 'Live Acoustic Guitar & Bonfire', 'Guided Morning Forest Trail', 'Stargazing Session'),
           JSON_ARRAY('Dome Tent Stay on Twin/Triple Sharing', 'Evening High Tea, BBQ & Dinner', 'Morning Forest Trail & Breakfast', 'Campfire & Acoustic Session'),
           JSON_ARRAY('Transport to campsite (option available at ₹400)', 'Personal snacks'),
           JSON_OBJECT('free_cancellation_days_before', 5, 'refund_7_to_15_days_pct', 75, 'refund_under_7_days_pct', 0, 'operator_cancellation_refund_pct', 100),
           JSON_OBJECT('secured_private_campsite', true, 'female_friendly_washrooms', true),
           FALSE, 'PUBLISHED'
         ),
         (
           4, 3,
           'Royal Rajasthan 6-Day Private Family Heritage Tour',
           'royal-rajasthan-6-day-private-family-heritage-tour',
           'PRIVATE_GROUP', 'Family Heritage & Culture',
           'Jaipur', 'Udaipur (via Jodhpur & Jaisalmer)', 6, 5,
           18500.00, 'PREMIUM', 'EASY', 'BOUTIQUE_STAY',
           'RELAXED',
           JSON_ARRAY('Private SUV/Innova Crysta', 'Customizable Itinerary', 'Family & Senior Friendly', 'Desert Camp'),
           JSON_ARRAY('Amber Fort & City Palace Guided Tour', 'Mehrangarh Fort Blue City Walk', 'Sam Sand Dunes Private Swiss Tent & Folk Night', 'Lake Pichola Sunset Boat Ride'),
           JSON_ARRAY('Private AC Innova Crysta for 6 days', '5 Nights Heritage Hotels & Swiss Desert Tent', 'Daily Breakfast & Desert Cultural Dinner', 'Camel Safari'),
           JSON_ARRAY('Monument entry tickets', 'Airfare/Train tickets'),
           JSON_OBJECT('free_cancellation_days_before', 10, 'refund_7_to_15_days_pct', 60, 'refund_under_7_days_pct', 0, 'operator_cancellation_refund_pct', 100),
           JSON_OBJECT('verified_chauffeur', true, '24x7_on_trip_concierge', true),
           TRUE, 'PUBLISHED'
         ),
         (
           5, 2,
           'Pachmarhi Queen of Satpura 3-Day Weekend Road Trip from Indore',
           'pachmarhi-queen-of-satpura-weekend-road-trip-indore',
           'STRANGER_GROUP', 'Hill Station & Waterfall Trek',
           'Indore', 'Pachmarhi', 3, 2,
           6499.00, 'STANDARD', 'MODERATE', 'HOTEL',
           'BALANCED',
           JSON_ARRAY('Indore Pickup', 'Gypsy Forest Safari', 'Bee Falls Trek', 'Dhoopgarh Sunset'),
           JSON_ARRAY('4x4 Open Gypsy Safari in Satpura National Park', 'Bee Falls & Duchess Falls Trek', 'Dhoopgarh Highest Peak Sunset', 'Pandav Caves Exploration'),
           JSON_ARRAY('AC Traveller from Indore & Bhopal', '2 Nights Resort Stay', '4x4 Gypsy Safari & Forest Entry Permits', 'Breakfast & Dinner'),
           JSON_ARRAY('Lunches', 'Personal shopping'),
           JSON_OBJECT('free_cancellation_days_before', 10, 'refund_7_to_15_days_pct', 50, 'refund_under_7_days_pct', 0, 'operator_cancellation_refund_pct', 100),
           JSON_OBJECT('first_aid_kit', true, 'forest_guide_included', true),
           FALSE, 'PUBLISHED'
         )
       ON DUPLICATE KEY UPDATE
         title = VALUES(title),
         highlights = VALUES(highlights)`
    );

    // 5. Seed Day-by-Day Trip Itineraries
    await connection.query(
      `INSERT INTO trip_itineraries (trip_id, day_number, title, description, meals_included, accommodation_details, travel_distance_km)
       VALUES
         (1, 1, 'Arrival in Manali & Old Manali Cafe Walk', 'Check into riverside boutique hotel, group ice-breaker session, walk to Hadimba Temple and Jogini Waterfall trail.', 'Dinner', 'Riverside Boutique Hotel, Manali', 15),
         (1, 2, 'Solang Valley Adventure & Atal Tunnel to Sissu', 'Drive through Atal Tunnel into Lahaul Valley, visit Sissu Lake & Waterfall, snow activities at Solang Valley.', 'Breakfast, Dinner', 'Riverside Boutique Hotel, Manali', 85),
         (1, 3, 'Naggar Castle, Kullu Rafting & Farewell Bonfire', 'River rafting on Beas river, visit Naggar Castle & Nicholas Roerich Art Gallery, acoustic music night.', 'Breakfast, Dinner', 'Riverside Boutique Hotel, Manali', 50),
         (1, 4, 'Morning Cafe Hopping & Return Departure to Delhi', 'Lazy morning by the Beas river, souvenir shopping at Mall Road, board evening AC Volvo back to Delhi.', 'Breakfast', 'Overnight Volvo Transit', 530),
         (2, 1, 'Arrival in Leh & High-Altitude Acclimatization', 'Airport pickup, complete rest for acclimatization, evening riding briefing and Royal Enfield bike handover.', 'Dinner', 'Hotel in Leh', 10),
         (2, 2, 'Leh to Nubra Valley via Khardung La (17,982 ft)', 'Ride up the legendary Khardung La pass, descend into Nubra Valley, visit Diskit Monastery & Hunder sand dunes.', 'Breakfast, Dinner', 'Swiss Camps in Hunder, Nubra', 125),
         (2, 3, 'Nubra Valley to Pangong Tso via Shyok River Route', 'Scenic off-road adventure along the turquoise Shyok River, arriving at the iconic Pangong Lake by afternoon.', 'Breakfast, Dinner', 'Lakeside Cottages at Pangong', 160),
         (2, 4, 'Pangong Tso to Leh via Chang La Pass', 'Sunrise over Pangong Lake, ride back over Chang La pass, visit Thiksey Monastery and Rancho School.', 'Breakfast, Dinner', 'Hotel in Leh', 150),
         (2, 5, 'Leh to Sham Valley (Magnetic Hill & Sangam)', 'Tarmac ride along Indus river to Zanskar-Indus confluence, Pathar Sahib Gurudwara, and Hall of Fame.', 'Breakfast, Dinner', 'Hotel in Leh', 95),
         (2, 6, 'Departure from Leh with Biker Brotherhood Memories', 'Post-breakfast airport drop. Expedition concludes.', 'Breakfast', 'None', 10),
         (3, 1, 'Indore to Choral Forest Campsite, BBQ & Stargazing', 'Reach campsite by 4:30 PM, tent allocation, sunset walk by Choral backwaters, BBQ snacks, dinner, and acoustic jamming around the bonfire.', 'High Tea, BBQ, Dinner', 'Twin/Triple Dome Tents', 45),
         (3, 2, 'Guided Satpura Forest Trail & Return to Indore', 'Early morning birdwatching & forest trek, hot breakfast at camp, group games, and checkout by 11:00 AM.', 'Breakfast', 'None', 45)
       ON DUPLICATE KEY UPDATE
         title = VALUES(title),
         description = VALUES(description)`
    );

    // 6. Seed Upcoming Departures (with Departure-Confidence tracking)
    await connection.query(
      `INSERT INTO trip_departures (
         id, trip_id, batch_code, start_date, end_date,
         price_per_person, token_amount, total_seats, booked_seats,
         offline_blocked_seats, min_group_size, booking_deadline, departure_status
       ) VALUES
         (1, 1, 'MNL-NOV-01', '2026-11-05', '2026-11-08', 9999.00, 2500.00, 15, 6, 3, 8, '2026-11-02 23:59:59', 'GUARANTEED'),
         (2, 2, 'LEH-NOV-10', '2026-11-10', '2026-11-15', 24999.00, 5000.00, 12, 3, 2, 6, '2026-11-05 23:59:59', 'OPEN'),
         (3, 3, 'IND-CAMP-01', '2026-10-24', '2026-10-25', 2499.00, 999.00, 20, 11, 5, 10, '2026-10-23 18:00:00', 'FILLING_FAST'),
         (4, 1, 'MNL-NOV-19', '2026-11-19', '2026-11-22', 9999.00, 2500.00, 15, 2, 1, 8, '2026-11-16 23:59:59', 'OPEN'),
         (5, 5, 'IND-PACH-01', '2026-11-06', '2026-11-08', 6499.00, 1500.00, 14, 5, 4, 8, '2026-11-04 20:00:00', 'GUARANTEED')
       ON DUPLICATE KEY UPDATE
         trip_id = VALUES(trip_id),
         batch_code = VALUES(batch_code),
         start_date = VALUES(start_date),
         end_date = VALUES(end_date),
         price_per_person = VALUES(price_per_person),
         token_amount = VALUES(token_amount),
         total_seats = VALUES(total_seats),
         booked_seats = VALUES(booked_seats),
         offline_blocked_seats = VALUES(offline_blocked_seats),
         min_group_size = VALUES(min_group_size),
         booking_deadline = VALUES(booking_deadline),
         departure_status = VALUES(departure_status)`
    );

    // 7. Seed Sample Waitlist / Departure Interest
    await connection.query(
      `INSERT INTO departure_waitlist (departure_id, trip_id, user_id, seats_interested, interest_type, notes)
       VALUES
         (2, 2, 5, 2, 'WAIT_FOR_GUARANTEE', 'Me and my friend from Indore want to join once 1 more rider books to reach minimum group size of 6!')
       ON DUPLICATE KEY UPDATE notes = VALUES(notes)`
    );

    // 8. Seed Sample Confirmed Booking & Participant Manifest (Phase 3)
    await connection.query(
      `INSERT INTO bookings (
         id, booking_reference, user_id, trip_id, departure_id, operator_id,
         seats_count, unit_price, total_amount, payment_plan,
         token_amount_required, amount_paid, balance_due,
         commission_rate_pct, platform_commission_amount, operator_payout_amount,
         booking_status, special_requests, operator_remarks
       ) VALUES (
         1, 'BK-20261010-10001', 5, 1, 1, 1,
         2, 9999.00, 19998.00, 'TOKEN',
         5000.00, 5000.00, 14998.00,
         10.00, 1999.80, 17998.20,
         'CONFIRMED', 'Prefer twin-sharing riverside room with balcony', 'Token ₹5,000 verified via UPI'
       )
       ON DUPLICATE KEY UPDATE
         amount_paid = VALUES(amount_paid),
         booking_status = VALUES(booking_status)`
    );

    await connection.query(
      `INSERT INTO booking_participants (
         id, booking_id, full_name, age, gender, phone,
         id_proof_type, id_proof_number, blood_group,
         emergency_contact_name, emergency_contact_phone, is_primary_contact
       ) VALUES
         (1, 1, 'Aarav Verma', 27, 'MALE', '9000000005', 'AADHAAR', 'XXXX-XXXX-4521', 'O+', 'Rajesh Verma', '9826011122', TRUE),
         (2, 1, 'Riya Joshi', 26, 'FEMALE', '9826055544', 'AADHAAR', 'XXXX-XXXX-8832', 'B+', 'Sunita Joshi', '9826055500', FALSE)
       ON DUPLICATE KEY UPDATE
         full_name = VALUES(full_name)`
    );

    // 9. Seed Sample Private Family Trip Custom Enquiry (Category B)
    await connection.query(
      `INSERT INTO custom_trip_enquiries (
         id, enquiry_reference, user_id, trip_id, operator_id,
         preferred_start_date, group_size, budget_per_person,
         origin_city, customization_notes, contact_phone, status
       ) VALUES (
         1, 'ENQ-20261010-20001', 5, 4, 3,
         '2026-12-18', 6, 18000.00,
         'Indore', 'Family of 6 including 2 senior citizens. Need private Innova Crysta pickup from Jaipur and ground-floor rooms where possible.',
         '9000000005', 'OPEN'
       )
       ON DUPLICATE KEY UPDATE
         customization_notes = VALUES(customization_notes)`
    );

    // 10. Seed Sample Captured Payment & Operator Escrow Payout (Phase 4)
    await connection.query(
      `INSERT INTO payments (
         id, booking_id, user_id, payment_purpose, gateway_provider,
         gateway_order_id, gateway_payment_id, amount, currency,
         gateway_fee_amount, status, paid_at
       ) VALUES (
         1, 1, 5, 'INITIAL_BOOKING', 'RAZORPAY',
         'order_Rzp_Seed_10001', 'pay_Rzp_Seed_10001', 5000.00, 'INR',
         100.00, 'CAPTURED', NOW()
       )
       ON DUPLICATE KEY UPDATE
         status = VALUES(status)`
    );

    await connection.query(
      `INSERT INTO operator_payouts (
         id, payout_reference, booking_id, departure_id, operator_id,
         gross_booking_amount, amount_collected,
         platform_commission_pct, platform_commission_amount,
         gateway_fee_amount, net_operator_payable, payout_status
       ) VALUES (
         1, 'PO-20261010-10001', 1, 1, 1,
         19998.00, 5000.00,
         10.00, 1999.80,
         100.00, 17998.20, 'ESCROW_HELD'
       )
       ON DUPLICATE KEY UPDATE
         amount_collected = VALUES(amount_collected)`
    );

    // 11. Seed Sample Verified Booking Review (Phase 5)
    await connection.query(
      `INSERT INTO reviews (
         id, booking_id, user_id, trip_id, departure_id, operator_id,
         overall_rating, itinerary_accuracy_rating, safety_and_captain_rating,
         accommodation_and_food_rating, group_vibe_rating,
         review_title, review_text, operator_public_reply, operator_replied_at, is_verified_booking
       ) VALUES (
         1, 1, 5, 1, 1, 1,
         5, 5, 5, 4, 5,
         'Unforgettable Manali & Sissu Group Trip!',
         'Everything promised on the itinerary was delivered accurately. Our trip captain handled the Atal Tunnel snow drive safely and the riverside hotel bonfire vibe was 10/10!',
         'Thank you so much Aarav! Loved hosting you and Riya on the Manali batch.',
         NOW(), TRUE
       )
       ON DUPLICATE KEY UPDATE
         review_title = VALUES(review_title)`
    );

    // 12. Seed Trip Compatibility Profiles (Phase 6 - Model B Differentiator)
    await connection.query(
      `INSERT INTO trip_compatibility_profiles (
         trip_id, ideal_morning_style, ideal_social_style,
         solo_traveler_friendly, ideal_age_brackets,
         activity_intensity_level, group_vibe_summary
       ) VALUES
         (1, 'FLEXIBLE', 'HIGH_ENERGY_GROUP', TRUE, JSON_ARRAY('18_24', '25_30'), 3, 'Social backpacker mixer, riverside bonfires, cafe hopping & scenic snow drives'),
         (2, 'EARLY_BIRD', 'HIGH_ENERGY_GROUP', TRUE, JSON_ARRAY('25_30', '31_40'), 5, 'High-adrenaline motorcycle brotherhood with early mountain pass starts'),
         (3, 'LEISURELY', 'BALANCED_SOCIAL', TRUE, JSON_ARRAY('18_24', '25_30', '31_40'), 2, 'Relaxed acoustic campfire under the stars with easy morning forest walk'),
         (4, 'FLEXIBLE', 'QUIET_EXPLORATION', FALSE, JSON_ARRAY('25_30', '31_40', '40_PLUS'), 2, 'Private family & couple heritage holiday at your own custom pace'),
         (5, 'EARLY_BIRD', 'HIGH_ENERGY_GROUP', TRUE, JSON_ARRAY('18_24', '25_30', '31_40'), 4, 'Active waterfall treks, 4x4 Gypsy forest safari & Indore group road trip vibe')
       ON DUPLICATE KEY UPDATE
         group_vibe_summary = VALUES(group_vibe_summary)`
    );

    await connection.commit();
    console.log('✅ Database seeded successfully with All 6 Phases (1 to 6) sample data!');
  } catch (err) {
    await connection.rollback();
    console.error('❌ Seeding failed:', err.message);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
}

seedDatabase();
