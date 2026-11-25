import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defs } from './provision.mjs';

// Schema invariant tests asserted using ONLY facts written in docs/DATA_AND_ACCESS.md section 1

test('the access-class table matches defs.access exactly', () => {
  const expectedAccess = {
    catalog: {
      'Avenue Members': 'Read',
      'Avenue Flavors Staff': 'Contribute',
      'Avenue Flavors Owner': 'Contribute'
    },
    calendar: {
      'Avenue Members': 'Read',
      'Avenue Flavors Staff': 'Read',
      'Avenue Flavors Owner': 'Read'
    },
    private: {
      'Avenue Flavors Staff': 'Contribute',
      'Avenue Flavors Owner': 'Contribute'
    },
    intake: {
      'Avenue Members': 'Contribute',
      'Avenue Flavors Staff': 'Contribute',
      'Avenue Flavors Owner': 'Contribute'
    },
    ownerWrite: {
      'Avenue Flavors Staff': 'Read',
      'Avenue Flavors Owner': 'Contribute'
    }
  };

  assert.deepEqual(defs.access, expectedAccess);
});

test('the group "Avenue Members" appears in NO private and NO ownerWrite class', () => {
  assert.equal('Avenue Members' in defs.access.private, false);
  assert.equal('Avenue Members' in defs.access.ownerWrite, false);
});

test('no class grants "Avenue Flavors Owner" the role "Edit"', () => {
  for (const [className, roles] of Object.entries(defs.access)) {
    assert.notEqual(
      roles['Avenue Flavors Owner'],
      'Edit',
      `Class ${className} grants Avenue Flavors Owner the role Edit`
    );
  }
});

test('every list with access "intake" has itemLevel true, no unique field and no field named MemberId', () => {
  const intakeLists = defs.lists.filter((l) => l.access === 'intake');
  assert(intakeLists.length > 0, 'Must have at least one intake list');

  for (const l of intakeLists) {
    assert.equal(l.itemLevel, true, `${l.title} must have itemLevel true`);
    const uniqueFields = l.fields.filter((f) => f.unique);
    assert.equal(
      uniqueFields.length,
      0,
      `${l.title} has unexpected unique fields: ${uniqueFields.map((f) => f.name).join(', ')}`
    );
    const hasMemberId = l.fields.some((f) => f.name === 'MemberId');
    assert.equal(hasMemberId, false, `${l.title} must not have field named MemberId`);
  }
});

test('AvenueCalendar fields are exactly: FacilityId, BookingId, ResourceId, Space, EquipmentIds, MemberDisplayName, StartUtc, EndUtc', () => {
  const cal = defs.lists.find((l) => l.title === 'AvenueCalendar');
  assert(cal, 'AvenueCalendar list must exist');
  const expectedFields = [
    'FacilityId',
    'BookingId',
    'ResourceId',
    'Space',
    'EquipmentIds',
    'MemberDisplayName',
    'StartUtc',
    'EndUtc'
  ];
  const actualFields = cal.fields.map((f) => f.name);
  assert.deepEqual(actualFields, expectedFields);
});

test('AvenueHoursLedger has unique EntryId and unique ChargeKey, and Reason choices include Used, Credit back, Overage, Adjustment', () => {
  const ledger = defs.lists.find((l) => l.title === 'AvenueHoursLedger');
  assert(ledger, 'AvenueHoursLedger list must exist');

  const entryIdField = ledger.fields.find((f) => f.name === 'EntryId');
  assert(entryIdField, 'EntryId field must exist');
  assert.equal(entryIdField.unique, true, 'EntryId must be unique');

  const chargeKeyField = ledger.fields.find((f) => f.name === 'ChargeKey');
  assert(chargeKeyField, 'ChargeKey field must exist');
  assert.equal(chargeKeyField.unique, true, 'ChargeKey must be unique');

  const reasonField = ledger.fields.find((f) => f.name === 'Reason');
  assert(reasonField, 'Reason field must exist');
  const expectedChoices = ['Used', 'Credit back', 'Overage', 'Adjustment'];
  for (const choice of expectedChoices) {
    assert(
      reasonField.choices.includes(choice),
      `Reason choices must include '${choice}'`
    );
  }
});

test('AvenueNoticeDrafts exists with access "private"; AvenueRequiredDocTypes exists', () => {
  const noticeDrafts = defs.lists.find((l) => l.title === 'AvenueNoticeDrafts');
  assert(noticeDrafts, 'AvenueNoticeDrafts must exist');
  assert.equal(noticeDrafts.access, 'private');

  const reqDocTypes = defs.lists.find((l) => l.title === 'AvenueRequiredDocTypes');
  assert(reqDocTypes, 'AvenueRequiredDocTypes must exist');
});

test('the set of list titles equals the 43 named in DATA_AND_ACCESS.md section 1', () => {
  const expectedTitles = [
    // catalog
    'AvenueFacilities',
    'AvenueEquipment',
    'AvenueDiningTables',
    'AvenuePlans',
    'AvenueChecklistQuestions',
    'AvenueNotices',
    'AvenueRequiredDocTypes',
    'AvenueSupportCategories',
    // calendar
    'AvenueCalendar',
    // private
    'AvenueMembers',
    'AvenueBookings',
    'AvenueHoursLedger',
    'AvenueMemberDocuments',
    'AvenueCheckIns',
    'AvenueDocumentFiles',
    'AvenueMyMembership',
    'AvenueNoticeDrafts',
    'AvenueComplianceCases',
    'AvenueApplicants',
    'AvenueInvoices',
    'AvenueSensors',
    'AvenueSensorLatest',
    'AvenueSensorHourly',
    'AvenueTempExcursions',
    'AvenueSupportCases',
    'AvenueEventCases',
    'AvenueStorageCases',
    'AvenueSupportFiles',
    'AvenueMyDocuments',
    'AvenueMyHours',
    'AvenueMyBookings',
    // ownerWrite
    'AvenueComplianceOverrides',
    'AvenueStaffCapabilities',
    // intake
    'AvenueBookingRequests',
    'AvenueDocumentSubmissions',
    'AvenueCheckInSubmissions',
    'AvenueComplianceFlags',
    'AvenueHostRequests',
    'AvenueSupportMessages',
    'AvenueEventRequests',
    'AvenueStorageRequests',
    'AvenueTeamMembers',
    'AvenueNoticeReads'
  ];

  const actualTitles = defs.lists.map((l) => l.title);
  assert.equal(actualTitles.length, 43);
  assert.deepEqual(actualTitles.slice().sort(), expectedTitles.slice().sort());
});

test('member-visible mirrors (AvenueMy*) are private lists keyed by an indexed MemberId; members get item-level read from a flow only', () => {
  const mirrors = defs.lists.filter((l) => /^AvenueMy[A-Z]/.test(l.title));
  assert.deepEqual(mirrors.map((l) => l.title).sort(), ['AvenueMyBookings', 'AvenueMyDocuments', 'AvenueMyHours', 'AvenueMyMembership']);
  for (const l of mirrors) {
    assert.equal(l.access, 'private', `${l.title} must be private at list level`);
    const m = l.fields.find((f) => f.name === 'MemberId');
    assert.ok(m && m.indexed, `${l.title}.MemberId must exist and be indexed`);
    assert.ok(l.fields.some((f) => f.unique), `${l.title} needs a unique key for the mirror upsert`);
  }
});

test('support topics: AvenueSupportCategories is a catalog list; support Category is Text and cases can be Archived', () => {
  const cat = defs.lists.find((l) => l.title === 'AvenueSupportCategories');
  assert.equal(cat.access, 'catalog');
  assert.deepEqual(cat.fields.map((f) => f.name), ['FacilityId', 'SortOrder', 'Active']);
  for (const t of ['AvenueSupportMessages', 'AvenueSupportCases']) {
    assert.equal(defs.lists.find((l) => l.title === t).fields.find((f) => f.name === 'Category').type, 'Text');
  }
  assert.ok(defs.lists.find((l) => l.title === 'AvenueSupportCases').fields.find((f) => f.name === 'Status').choices.includes('Archived'));
  const files = defs.lists.find((l) => l.title === 'AvenueSupportFiles');
  assert.equal(files.access, 'private'); assert.equal(files.library, true);
});

test('applicants: staff-made applications and the recorded invite checklist', () => {
  const app = defs.lists.find((l) => l.title === 'AvenueApplicants');
  assert.ok(app.fields.find((f) => f.name === 'Source').choices.includes('Staff'));
  for (const n of ['InviteSent', 'InviteAccepted', 'GroupAdded']) assert.equal(app.fields.find((f) => f.name === n)?.type, 'Boolean');
});
