INSERT INTO leave_type (code, name, days_per_year, requires_advance_notice_days, info_note, applicable_employee_type) VALUES
('CL',               'Casual Leave',       '14 days/year',       NULL, 'Includes sick leave. CL + PL = 24 days.', NULL),
('PL',               'Privilege Leave',    '10 days/year',       NULL, '0.8 day/month, credited quarterly (Jan/Apr/Jul/Sep). Carry-forward capped at 5 days.', NULL),
('OPTIONAL_HOLIDAY', 'Optional Holiday',   '2 days/year',        NULL, 'Floating holiday for festivals not on the org calendar.', NULL),
('MARRIAGE',         'Marriage Leave',     '5 days',             30,   'Flat 5 days.', NULL),
('MATERNITY',        'Maternity Leave',    'Up to 26 weeks',     30,   'Up to 26 weeks, per policy.', NULL),
('PATERNITY',        'Paternity Leave',    '15 days',            30,   'Flat 15 calendar days.', NULL),
('SABBATICAL',       'Sabbatical',         '1 month',            NULL, '1 month, unpaid. Requires Manager and HR approval.', NULL),
('LOP',              'Loss of Pay',        'Up to 15 days/year', NULL, 'Only available once Casual Leave and Privilege Leave balances are both exhausted. Capped at 15 working days/year.', NULL),
('INTERN_STUDY',     'Intern Study Leave', 'Per policy',         NULL, 'Applicable to interns only (employee_type = INTERN).', 'INTERN'),
('PUBLIC_HOLIDAY',   'Public Holiday',     'Calendar-driven',    NULL, 'Not applied for — driven by the organization''s holiday calendar (see public_holiday table).', NULL);
