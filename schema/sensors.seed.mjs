// Swift Sensors units from the client sheet, tab "Temperature Sensors" (read 19 Nov 2026; docs/ENVIRONMENT_PLAN.md section 1).
// The sheet says 9 sensors but only 8 rows were readable; the 9th is still to be supplied (Q-E1).
// Q-E1 OPEN: two units share the sheet name "Complimentary Refrigerator 1" (A00L4N, A00JY1). They are told apart by the Swift id in the name until the client renames them.
const SS = 'SS3-102', FRIDGE = [36, 40], FREEZER = [-8, 0];
const ROWS = [
  ['A00L4N', 'Complimentary Refrigerator 1 (A00L4N)', 'Fridge', 'Sink Room'],
  ['A00JY1', 'Complimentary Refrigerator 1 (A00JY1)', 'Fridge', 'Sink Room'],
  ['A00JJL', 'Double Door Refrigerator #1', 'Fridge', 'Storage Room'],
  ['A00JN6', 'Double Door Refrigerator #2', 'Fridge', 'Storage Room'],
  ['A00JP7', 'Half Door Refrigerator Unit', 'Fridge', 'Storage Room'],
  ['A00JPK', 'Double Door Freezer #1', 'Freezer', 'Storage Room'],
  ['A00JQ4', 'Double Door Freezer #2', 'Freezer', 'Storage Room'],
  ['A00JRF', 'Half Door Freezer Unit', 'Freezer', 'Storage Room']
];

export function buildSensors() {
  return ROWS.map(([id, name, type, room]) => ({ key: id, fields: {
    Title: name, FacilityId: 'flavors-hyattsville', SensorId: id, Model: SS, UnitName: name, UnitType: type, Room: room,
    MinF: (type === 'Fridge' ? FRIDGE : FREEZER)[0], MaxF: (type === 'Fridge' ? FRIDGE : FREEZER)[1], Active: true } }));
}
